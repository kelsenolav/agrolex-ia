import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseUserClient } from '@/lib/supabaseServerUser';

const PAYMENT_UNAVAILABLE_MESSAGE = 'Pagamento indisponível no momento. A configuração do provedor de pagamento ainda não está ativa. Tente usar créditos ou contate o suporte.';
const SIMULATED_PAYMENT_MESSAGE = 'Pagamento simulado aprovado para validacao interna do laudo.';
const MODULE_PRICES: Record<string, number> = {
  titulos_incra: 99.90,
  registros: 149.90,
  geoespacial: 199.90,
  nulidades: 249.90,
  forense: 299.90,
  cruzamento: 499.90,
};
const MODULE_TITLES: Record<string, string> = {
  titulos_incra: 'Consulta e Validação de Títulos INCRA',
  registros: 'Auditoria Registral e Averbações',
  geoespacial: 'Auditoria Geoespacial e SIGEF',
  nulidades: 'Mapeamento de Nulidades',
  forense: 'Investigação Forense',
  cruzamento: 'Cruzamento Total',
};
const MASTER_MODULE = 'cruzamento';
const PIX_EXCLUDED_PAYMENT_TYPES = [
  'credit_card',
  'debit_card',
  'prepaid_card',
  'ticket',
];

type PaymentProvider = 'simulated' | 'mercadopago';

function getPaymentProvider(): PaymentProvider {
  const configuredProvider = (process.env.PAYMENT_PROVIDER || 'simulated').trim().toLowerCase();

  if (configuredProvider === 'mercadopago') return 'mercadopago';
  if (configuredProvider !== 'simulated') {
    console.warn('[Checkout] Unknown PAYMENT_PROVIDER. Using safe simulated beta mode.');
  }

  return 'simulated';
}

function resolveModuleSelection(selectedModules: unknown[]) {
  if (selectedModules.some(moduleId => typeof moduleId !== 'string' || !MODULE_PRICES[moduleId])) return null;

  const modules = [...new Set(selectedModules)]
    .filter((moduleId): moduleId is string => typeof moduleId === 'string' && Boolean(MODULE_PRICES[moduleId]));

  if (modules.length === 0) return null;
  if (modules.includes(MASTER_MODULE)) {
    return { modules: [MASTER_MODULE], amountPaid: MODULE_PRICES[MASTER_MODULE] };
  }

  const total = modules.reduce((sum, moduleId) => sum + MODULE_PRICES[moduleId], 0);
  return total > MODULE_PRICES[MASTER_MODULE]
    ? { modules: [MASTER_MODULE], amountPaid: MODULE_PRICES[MASTER_MODULE] }
    : { modules, amountPaid: total };
}

function hasValidDevFallbackSecret(req: Request) {
  const configuredSecret = process.env.CHECKOUT_DEV_SECRET;
  const providedSecret = req.headers.get('x-checkout-dev-secret');

  if (!configuredSecret || !providedSecret) return false;

  const configuredBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(providedSecret);

  return configuredBuffer.length === providedBuffer.length
    && timingSafeEqual(configuredBuffer, providedBuffer);
}

export async function GET() {
  return NextResponse.json({ mode: getPaymentProvider() });
}

export async function POST(req: Request) {
  try {
    const supabaseUser = createSupabaseUserClient(req.headers.get('Authorization'));
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const { analysisId, propertyId, paymentMethod } = body;
    const selectedModules = Array.isArray(body.selectedModules) ? body.selectedModules : [];

    if (!analysisId || !propertyId) {
      return NextResponse.json({ error: 'Análise inválida.' }, { status: 400 });
    }

    const moduleSelection = resolveModuleSelection(selectedModules);
    if (!moduleSelection) {
      return NextResponse.json({ error: 'Selecione ao menos um foco de auditoria válido.' }, { status: 400 });
    }

    if (!['pix', 'cartao'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 });
    }

    const { data: analysis, error: analysisError } = await supabaseUser
      .from('analyses')
      .select('id')
      .eq('id', analysisId)
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .eq('status', 'payment_pending')
      .maybeSingle();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Análise pendente de pagamento não encontrada.' }, { status: 403 });
    }

    const { modules, amountPaid } = moduleSelection;
    const checkoutTitle = modules.includes(MASTER_MODULE)
      ? MODULE_TITLES[MASTER_MODULE]
      : modules.map(moduleId => MODULE_TITLES[moduleId]).join(' + ');
    const paymentProvider = getPaymentProvider();

    if (paymentProvider === 'simulated') {
      const { data: updatedAnalysis, error: updateError } = await supabaseUser
        .from('analyses')
        .update({
          status: 'processing',
          findings: {
            current_step: SIMULATED_PAYMENT_MESSAGE,
            payment_mode: 'simulated',
            selected_modules: modules,
          },
        })
        .eq('id', analysisId)
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .eq('status', 'payment_pending')
        .select('id')
        .maybeSingle();

      if (updateError || !updatedAnalysis) {
        return NextResponse.json({ error: 'Nao foi possivel confirmar o pagamento simulado.' }, { status: 409 });
      }

      return NextResponse.json({
        success: true,
        mode: 'simulated',
        status: 'approved',
        message: SIMULATED_PAYMENT_MESSAGE,
        paymentUrl: null,
        checkoutUrl: null,
        amountPaid,
        selectedModules: modules,
      });
    }

    const { error: metadataError } = await supabaseUser
      .from('analyses')
      .update({
        findings: {
          current_step: 'Aguardando confirmação do Mercado Pago.',
          payment_mode: 'mercadopago',
          selected_modules: modules,
        },
      })
      .eq('id', analysisId)
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .eq('status', 'payment_pending');

    if (metadataError) {
      return NextResponse.json({ error: 'Não foi possível preparar a análise para pagamento.' }, { status: 409 });
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('[Checkout] Provider not configured: missing MERCADO_PAGO_ACCESS_TOKEN');
      return NextResponse.json({ error: PAYMENT_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
    const preference = new Preference(client);
    
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    let checkoutUrl = '';
    let preferenceId = '';
    let sandboxInitPoint = '';

    try {
      // Gera o link de pagamento do Mercado Pago
      const response = await preference.create({
        body: {
          items: [
            {
              id: analysisId,
              title: `${checkoutTitle} - AgroLex`,
              description: 'Processamento de análise de risco e extração de dados com IA',
              quantity: 1,
              unit_price: Number(amountPaid),
              currency_id: 'BRL',
            }
          ],
          payer: {
            email: user.email || 'comprador@teste.com',
            name: user.user_metadata?.full_name || 'Cliente AgroLex',
          },
          back_urls: {
            success: `${protocol}://${host}/dashboard?payment_status=success&analysisId=${analysisId}`,
            failure: `${protocol}://${host}/dashboard?payment_status=failure`,
            pending: `${protocol}://${host}/dashboard?payment_status=pending`,
          },
          auto_return: 'approved',
          statement_descriptor: 'AGROLEX',
          external_reference: analysisId,
          ...(paymentMethod === 'pix' && {
            payment_methods: {
              excluded_payment_types: PIX_EXCLUDED_PAYMENT_TYPES.map(id => ({ id })),
            },
          }),
        }
      });
      checkoutUrl = response.init_point!;
      preferenceId = response.id!;
      sandboxInitPoint = response.sandbox_init_point!;
    } catch (mpError: any) {
      if (mpError.message?.toLowerCase().includes('token') || mpError.message?.toLowerCase().includes('unauthorized')) {
        if (process.env.NODE_ENV === 'production' || !hasValidDevFallbackSecret(req)) {
          console.error('[Checkout] Mercado Pago authentication failed');
          return NextResponse.json({ error: PAYMENT_UNAVAILABLE_MESSAGE }, { status: 503 });
        }

        console.warn('[Checkout] Mercado Pago authentication failed. Using authorized local fallback.');
        
        // Simula o comportamento do Webhook (atualiza para processing)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
        await supabaseAdmin.from('analyses').update({
          status: 'processing',
          findings: {
            current_step: 'Fallback local autorizado para checkout.',
            payment_mode: 'simulated',
            selected_modules: modules,
          },
        }).eq('id', analysisId);
        
        // [CORREÇÃO] Dispara a IA em background para o teste local não travar!
        fetch(`${protocol}://${host}/api/analyze`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('authorization') || ''
          },
          body: JSON.stringify({ propertyId, analysisId })
        }).catch(err => console.error("Erro ao disparar IA no mock do checkout:", err));

        checkoutUrl = `${protocol}://${host}/dashboard/resultado?id=${analysisId}`;
        preferenceId = 'SIMULATED';
        sandboxInitPoint = checkoutUrl;
      } else {
        console.error(`[Checkout] Mercado Pago request failed: status=${mpError.status || 'unknown'} code=${mpError.code || 'unknown'}`);
        return NextResponse.json({ error: 'Pagamento indisponível no momento. Não foi possível consultar o provedor de pagamento. Tente novamente mais tarde ou use créditos.' }, { status: 502 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      mode: 'mercadopago',
      checkoutUrl, 
      sandboxInitPoint,
      preferenceId 
    });
  } catch (error: any) {
    console.error(`[Checkout] Unexpected failure: ${error instanceof Error ? error.name : 'unknown'}`);
    return NextResponse.json({ error: 'Pagamento indisponível no momento. Tente novamente mais tarde ou use créditos.' }, { status: 500 });
  }
}
