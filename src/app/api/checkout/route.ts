import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateAuditModulesTotal, MODULE_PRICES } from '@/lib/auditModules';
import { createPreference } from '@/lib/payments/mercadopago';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Cabeçalho de autorização ausente' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do Supabase incompleta no servidor' }, { status: 500 });
    }

    // Cliente com token do usuário para validar autenticação
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 });
    }

    const body = await req.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId não informado' }, { status: 400 });
    }

    // Cliente admin para consultar e atualizar com segurança
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from('analyses')
      .select('id, user_id, status, findings, property_id, properties(name, city, state)')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 });
    }

    // Validação de ownership
    if (analysis.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado: a análise não pertence ao usuário' }, { status: 403 });
    }

    // Validação de status atual
    const currentStatus = (analysis.status || '').toLowerCase().trim();
    if (currentStatus !== 'payment_pending' && currentStatus !== 'pending') {
      return NextResponse.json({ error: 'Status atual inválido para pagamento' }, { status: 400 });
    }

    // Validação de selected_modules em findings
    const findings = analysis.findings || {};
    const selectedModules: string[] = findings.selected_modules || [];
    if (!Array.isArray(selectedModules) || selectedModules.length === 0) {
      return NextResponse.json({ error: 'A análise não possui módulos de auditoria válidos' }, { status: 400 });
    }

    // Validar que todos os módulos selecionados existem e têm preço válido
    for (const moduleId of selectedModules) {
      if (typeof moduleId !== 'string' || !moduleId.trim()) {
        return NextResponse.json({ error: 'Módulo de auditoria inválido ou vazio' }, { status: 400 });
      }
      if (MODULE_PRICES[moduleId.trim()] === undefined) {
        return NextResponse.json({ error: `Módulo de auditoria desconhecido: ${moduleId}` }, { status: 400 });
      }
    }

    // Recalcular o preço no servidor (fonte da verdade)
    const serverEstimatedTotal = calculateAuditModulesTotal(selectedModules);
    const clientEstimatedTotal = typeof findings.estimated_total === 'number' ? findings.estimated_total : null;

    // Informações da propriedade para o item do checkout
    const propertyName = (analysis.properties as any)?.name || 'Análise Fundiária';
    const moduleNames = selectedModules.map((mId: string) => {
      const price = MODULE_PRICES[mId];
      return `${mId.replace(/_/g, ' ')} (R$ ${price?.toFixed(2)})`;
    }).join(' + ');

    // Criar preferência no Mercado Pago
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000';

    let checkoutUrl: string;
    let preferenceId: string;

    try {
      const preference = await createPreference({
        items: [
          {
            id: analysisId,
            title: `AgroLex — Auditoria Fundiária: ${propertyName}`,
            description: `Módulos: ${moduleNames}`,
            quantity: 1,
            unit_price: serverEstimatedTotal,
            currency_id: 'BRL',
          },
        ],
        external_reference: analysisId,
        payer: {
          name: user.user_metadata?.full_name || user.email || 'Cliente AgroLex',
          email: user.email || '',
        },
        notification_url: `${baseUrl}/api/webhook/mercadopago`,
        back_urls: {
          success: `${baseUrl}/dashboard?payment=success&analysis=${analysisId}`,
          failure: `${baseUrl}/dashboard?payment=failure&analysis=${analysisId}`,
          pending: `${baseUrl}/dashboard?payment=pending&analysis=${analysisId}`,
        },
        auto_return: 'approved',
      });

      preferenceId = preference.preferenceId;
      checkoutUrl = preference.checkoutUrl;
    } catch (mpError: any) {
      console.error('Erro ao criar preferência no Mercado Pago:', mpError);
      
      // Fallback: se MP falhar, ainda permitir simulação para desenvolvimento
      const mpConfigured = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpConfigured) {
        // Sem token MP configurado, usar simulação (modo dev)
        console.warn('Mercado Pago não configurado — usando modo simulado (dev)');
        const updatedFindings = {
          ...findings,
          estimated_total: serverEstimatedTotal,
          client_estimated_total: clientEstimatedTotal,
          price_source: 'server',
          price_checked_at: new Date().toISOString(),
          payment_mode: 'simulated_dev',
          payment_status: 'approved',
          current_step: 'Pagamento simulado aprovado (Mercado Pago não configurado).',
          ready_for_processing_at: new Date().toISOString(),
        };

        await supabaseAdmin
          .from('analyses')
          .update({
            status: 'ready_for_processing',
            findings: updatedFindings,
          })
          .eq('id', analysisId);

        return NextResponse.json({
          mode: 'simulated_dev',
          status: 'approved',
          analysisStatus: 'ready_for_processing',
          analysisId,
          serverEstimatedTotal,
          clientEstimatedTotal,
          checkoutUrl: null,
          message: 'Mercado Pago não configurado. Pagamento simulado aprovado automaticamente.',
        });
      }

      return NextResponse.json({ error: 'Erro ao processar pagamento. Tente novamente.' }, { status: 502 });
    }

    // Criar registro de ordem no banco
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        analysis_id: analysisId,
        amount: serverEstimatedTotal,
        status: 'pending',
        preference_id: preferenceId,
        sandbox: true,
      });

    if (orderError) {
      console.error('Erro ao criar ordem:', orderError);
      // Não bloquear — a preferência já foi criada no MP
    }

    // Atualizar findings da análise com info do pagamento
    const updatedFindings = {
      ...findings,
      estimated_total: serverEstimatedTotal,
      client_estimated_total: clientEstimatedTotal,
      price_source: 'server',
      price_checked_at: new Date().toISOString(),
      payment_mode: 'mercadopago',
      payment_status: 'pending',
      preference_id: preferenceId,
      current_step: 'Aguardando pagamento via Mercado Pago.',
    };

    await supabaseAdmin
      .from('analyses')
      .update({
        findings: updatedFindings,
      })
      .eq('id', analysisId);

    return NextResponse.json({
      mode: 'mercadopago',
      status: 'pending',
      analysisStatus: 'payment_pending',
      analysisId,
      serverEstimatedTotal,
      clientEstimatedTotal,
      checkoutUrl,
      preferenceId,
    });

  } catch (error: any) {
    console.error('Erro no checkout:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}