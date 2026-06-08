import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPreference } from '@/lib/payments/mercadopago';
import { PLAN_PRICES, PLAN_CREDITS, type PlanType } from '@/lib/subscriptions';

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
    const { planType } = body;

    const planValidos: PlanType[] = ['starter', 'pro', 'premium', 'enterprise'];
    if (!planType || !planValidos.includes(planType as PlanType)) {
      return NextResponse.json({ error: 'Plano inválido ou não informado para assinatura' }, { status: 400 });
    }

    const targetPlan = planType as PlanType;
    // Preço calculado no backend (fonte da verdade)
    const price = PLAN_PRICES[targetPlan];
    const credits = PLAN_CREDITS[targetPlan];

    // Cliente admin para consultar e atualizar com segurança
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Criar preferência no Mercado Pago
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000';

    let checkoutUrl: string;
    let preferenceId: string;

    // Criar registro de ordem no banco antes
    const { data: order, error: orderInsertError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        amount: price,
        status: 'pending',
        sandbox: true,
        // Usamos metadata para salvar detalhes do plano na ordem
        payment_method: `plan_${targetPlan}`
      })
      .select()
      .single();

    if (orderInsertError || !order) {
      console.error('Erro ao criar ordem para assinatura:', orderInsertError);
      return NextResponse.json({ error: 'Erro interno ao iniciar pedido' }, { status: 500 });
    }

    try {
      const preference = await createPreference({
        items: [
          {
            id: order.id,
            title: `Assinatura AgroLex — Plano ${targetPlan.toUpperCase()}`,
            description: `Acesso a ${credits} créditos de auditorias fundiárias`,
            quantity: 1,
            unit_price: price,
            currency_id: 'BRL',
          },
        ],
        external_reference: order.id, // O external_reference é o id da ordem!
        payer: {
          name: user.user_metadata?.full_name || user.email || 'Cliente AgroLex',
          email: user.email || '',
        },
        notification_url: `${baseUrl}/api/webhook/mercadopago`,
        back_urls: {
          success: `${baseUrl}/dashboard/planos?payment=success&order=${order.id}`,
          failure: `${baseUrl}/dashboard/planos?payment=failure&order=${order.id}`,
          pending: `${baseUrl}/dashboard/planos?payment=pending&order=${order.id}`,
        },
        auto_return: 'approved',
      });

      preferenceId = preference.preferenceId;
      checkoutUrl = preference.checkoutUrl;

      // Atualiza a ordem com o preference_id gerado
      await supabaseAdmin
        .from('orders')
        .update({ preference_id: preferenceId })
        .eq('id', order.id);

    } catch (mpError: any) {
      console.error('Erro ao criar preferência de plano no Mercado Pago:', mpError);
      
      // Fallback: se MP falhar e não estiver configurado, simular aprovação automática
      const mpConfigured = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpConfigured) {
        console.warn('Mercado Pago não configurado — usando modo simulado (dev) para planos');
        
        const { activateSubscription } = await import('@/lib/subscriptions');
        await activateSubscription(user.id, targetPlan);
        
        await supabaseAdmin
          .from('orders')
          .update({
            status: 'approved',
            paid_at: new Date().toISOString()
          })
          .eq('id', order.id);

        return NextResponse.json({
          mode: 'simulated_dev',
          status: 'approved',
          orderId: order.id,
          planType: targetPlan,
          checkoutUrl: null,
          message: 'Mercado Pago não configurado. Assinatura simulada ativada automaticamente.',
        });
      }

      return NextResponse.json({ error: 'Erro ao processar pagamento do plano. Tente novamente.' }, { status: 502 });
    }

    return NextResponse.json({
      mode: 'mercadopago',
      status: 'pending',
      orderId: order.id,
      planType: targetPlan,
      checkoutUrl,
      preferenceId,
    });

  } catch (error: any) {
    console.error('Erro no checkout de planos:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}