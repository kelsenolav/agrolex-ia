import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPreapproval } from '@/lib/payments/mercadopagoPreapproval';
import { RADAR_PRICE_PER_PROPERTY } from '@/lib/monitoring/radarSubscription';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

    const body = await req.json();
    const { propertyCount = 1 } = body;

    const count = Math.max(1, Math.min(50, Number(propertyCount) || 1));
    const totalPrice = RADAR_PRICE_PER_PROPERTY * count;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000';

    // Preapproval (assinatura recorrente): o cliente autoriza uma vez e o MP
    // cobra sozinho todo mês. `orders` sai do fluxo do Radar — a assinatura
    // pertence ao usuário e é correlacionada por `mp_preapproval_id` no webhook.
    try {
      const preapproval = await createPreapproval({
        reason: `AgrolexI Radar — ${count} propriedade${count > 1 ? 's' : ''}/mês`,
        external_reference: user.id,
        payer_email: user.email || '',
        transaction_amount: totalPrice,
        back_url: `${baseUrl}/dashboard/radar?subscription=pending`,
      });

      // Grava o vínculo ANTES do redirect: quando o webhook
      // subscription_preapproval chegar, já sabemos de quem é a assinatura.
      const { error: subError } = await adminClient.from('radar_subscriptions').upsert({
        user_id: user.id,
        status: 'pending',
        max_properties: count,
        price_per_property: RADAR_PRICE_PER_PROPERTY,
        mp_preapproval_id: preapproval.preapprovalId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (subError) {
        console.error('[monitoring/checkout] falha ao gravar assinatura pending:', subError.message);
        return NextResponse.json({ error: 'Erro ao registrar assinatura' }, { status: 500 });
      }

      return NextResponse.json({
        mode: 'mercadopago_preapproval',
        checkoutUrl: preapproval.initPoint,
        preapprovalId: preapproval.preapprovalId,
        totalPrice,
        propertyCount: count,
      });
    } catch (mpError) {
      const mpConfigured = !!(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN);
      if (!mpConfigured) {
        // Dev local sem MP: assinatura simulada (mesmo fallback de antes).
        await adminClient.from('radar_subscriptions').upsert({
          user_id: user.id,
          status: 'active',
          max_properties: count,
          price_per_property: RADAR_PRICE_PER_PROPERTY,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'user_id' });

        return NextResponse.json({
          mode: 'simulated_dev',
          status: 'approved',
          message: 'Mercado Pago não configurado — assinatura simulada ativada',
        });
      }

      console.error('[monitoring/checkout] erro MP preapproval:', mpError);
      return NextResponse.json({ error: 'Erro ao processar assinatura' }, { status: 502 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
