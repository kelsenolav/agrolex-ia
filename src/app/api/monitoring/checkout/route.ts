import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPreference } from '@/lib/payments/mercadopago';
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

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert({
        user_id: user.id,
        amount: totalPrice,
        status: 'pending',
        sandbox: true,
        payment_method: `radar_${count}_properties`,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000';

    try {
      const preference = await createPreference({
        items: [{
          id: order.id,
          title: `AgrolexI Radar — ${count} propriedade${count > 1 ? 's' : ''}/mês`,
          description: `Monitoramento fundiário contínuo para ${count} propriedade${count > 1 ? 's' : ''}`,
          quantity: 1,
          unit_price: totalPrice,
          currency_id: 'BRL',
        }],
        external_reference: order.id,
        payer: {
          name: user.user_metadata?.full_name || user.email || 'Cliente AgrolexI',
          email: user.email || '',
        },
        notification_url: `${baseUrl}/api/webhook/mercadopago`,
        back_urls: {
          success: `${baseUrl}/dashboard/radar?payment=success&order=${order.id}`,
          failure: `${baseUrl}/dashboard/radar?payment=failure&order=${order.id}`,
          pending: `${baseUrl}/dashboard/radar?payment=pending&order=${order.id}`,
        },
        auto_return: 'approved',
      });

      await adminClient.from('orders').update({ preference_id: preference.preferenceId }).eq('id', order.id);

      return NextResponse.json({
        mode: 'mercadopago',
        checkoutUrl: preference.checkoutUrl,
        orderId: order.id,
        totalPrice,
        propertyCount: count,
      });
    } catch (mpError) {
      const mpConfigured = !!(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN);
      if (!mpConfigured) {
        await adminClient.from('radar_subscriptions').upsert({
          user_id: user.id,
          status: 'active',
          max_properties: count,
          price_per_property: RADAR_PRICE_PER_PROPERTY,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'user_id' });

        await adminClient.from('orders').update({
          status: 'approved',
          paid_at: new Date().toISOString(),
        }).eq('id', order.id);

        return NextResponse.json({
          mode: 'simulated_dev',
          status: 'approved',
          message: 'Mercado Pago não configurado — assinatura simulada ativada',
        });
      }

      return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 502 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
