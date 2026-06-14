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

    const planValidos: string[] = ['starter', 'pro', 'premium', 'enterprise', 'extra_100_pages', 'extra_500_pages', 'extra_1000_pages'];
    if (!planType || !planValidos.includes(planType)) {
      return NextResponse.json({ error: 'Plano ou pacote inválido' }, { status: 400 });
    }

    let price: number;
    let credits: number;
    let title: string;

    if (planType.startsWith('extra_')) {
      const extraPacks: Record<string, { pages: number; price: number; label: string }> = {
        extra_100_pages: { pages: 100, price: 49.9, label: 'Pacote 100 Páginas' },
        extra_500_pages: { pages: 500, price: 199.9, label: 'Pacote 500 Páginas' },
        extra_1000_pages: { pages: 1000, price: 349.9, label: 'Pacote 1000 Páginas' },
      };
      const pack = extraPacks[planType];
      price = pack.price;
      credits = pack.pages;
      title = `AgroLex — ${pack.label}`;
    } else {
      const targetPlan = planType as PlanType;
      price = PLAN_PRICES[targetPlan];
      credits = PLAN_CREDITS[targetPlan];
      title = `Assinatura AgroLex — Plano ${targetPlan.toUpperCase()}`;
    }

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
        payment_method: planType.startsWith('extra_') ? `pack_${planType}` : `plan_${planType}`
      })
      .select()
      .single();

    if (orderInsertError || !order) {
      console.error('Erro ao criar ordem para assinatura:', orderInsertError);
      return NextResponse.json({ error: orderInsertError?.message ? `Erro interno ao iniciar pedido: ${orderInsertError.message}` : 'Erro interno ao iniciar pedido' }, { status: 500 });
    }

    try {
      const preference = await createPreference({
        items: [
          {
            id: order.id,
            title,
            description: `Acesso a ${credits} páginas de auditorias fundiárias`,
            quantity: 1,
            unit_price: price,
            currency_id: 'BRL',
          },
        ],
        external_reference: order.id,
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
      
      const mpConfigured = !!(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN);
      if (!mpConfigured) {
        console.warn('Mercado Pago não configurado — usando modo simulado (dev) para planos/créditos');
        
        if (planType.startsWith('extra_')) {
          const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('credits_available')
            .eq('user_id', user.id)
            .maybeSingle();
          if (sub) {
            await supabaseAdmin
              .from('subscriptions')
              .update({
                credits_available: sub.credits_available + credits,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);
          }
        } else {
          const targetPlan = planType as PlanType;
          const { activateSubscription } = await import('@/lib/subscriptions');
          await activateSubscription(user.id, targetPlan);
        }
        
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
          planType,
          checkoutUrl: null,
          message: 'Mercado Pago não configurado. Compra simulada ativada automaticamente.',
        });
      }

      return NextResponse.json({ error: 'Erro ao processar pagamento. Tente novamente.' }, { status: 502 });
    }

    return NextResponse.json({
      mode: 'mercadopago',
      status: 'pending',
      orderId: order.id,
      planType,
      checkoutUrl,
      preferenceId,
    });

  } catch (error: any) {
    console.error('Erro no checkout de planos:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}