import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPayment, verifyWebhookSignature } from '@/lib/payments/mercadopago';
import { activateSubscription, type PlanType } from '@/lib/subscriptions';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do Supabase incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Validar origem / assinatura do webhook
    const rawBody = await req.clone().text();
    const headers = req.headers;
    if (!verifyWebhookSignature(headers, rawBody)) {
      console.warn('Webhook MP: assinatura inválida detectada.');
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 403 });
    }

    // Ler o corpo da requisição
    const body = JSON.parse(rawBody || '{}');

    let paymentId: string | null = null;

    // Extrair ID do pagamento da notificação
    if (body.topic === 'payment' || body.type === 'payment') {
      paymentId = body.data?.id || body.id || null;
    }

    // Também suporta o formato de query params via URL
    if (!paymentId) {
      const { searchParams } = new URL(req.url);
      const topic = searchParams.get('topic') || searchParams.get('type');
      const id = searchParams.get('id') || searchParams.get('data.id');
      if (topic === 'payment' && id) {
        paymentId = id;
      }
    }

    if (!paymentId) {
      console.warn('Webhook MP: notification without payment ID — body:', body);
      return NextResponse.json({ success: true, message: 'No payment ID found' });
    }

    // Consultar status real do pagamento na API do Mercado Pago
    let paymentData;
    try {
      paymentData = await getPayment(paymentId);
    } catch (mpError: any) {
      console.error('Erro ao consultar pagamento no MP:', mpError);
      return NextResponse.json({ error: 'Erro ao consultar pagamento' }, { status: 502 });
    }

    const {
      id: providerPaymentId,
      status,
      status_detail,
      payment_type_id,
      installments,
      external_reference: orderId, // Aqui o external_reference agora é o orderId!
      date_approved,
    } = paymentData;

    console.log(`Pagamento ${providerPaymentId}: status=${status}, detail=${status_detail}, order=${orderId}`);

    if (!orderId) {
      console.warn('Webhook MP: pagamento sem orderId (external_reference).');
      return NextResponse.json({ success: true, message: 'No orderId' });
    }

    // Buscar a ordem associada
    const { data: order, error: fetchOrderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchOrderError || !order) {
      console.warn(`Ordem ${orderId} não encontrada.`);
      return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 });
    }

    // Registrar payment no banco
    await supabaseAdmin
      .from('payments')
      .insert({
        order_id: order.id,
        provider: 'mercadopago',
        provider_payment_id: String(providerPaymentId),
        status,
        status_detail,
        payment_type_id,
        installments: installments || 1,
        raw_response: paymentData,
      });

    // Se o pagamento foi aprovado
    if (status === 'approved') {
      if (order.status === 'approved') {
        console.log(`[webhook] Ordem ${order.id} já está aprovada. Evento já processado.`);
        return NextResponse.json({ success: true, message: 'Evento já processado' });
      }

      // Atualizar ordem
      await supabaseAdmin
        .from('orders')
        .update({
          status: 'approved',
          payment_id: String(providerPaymentId),
          payment_method: payment_type_id,
          paid_at: date_approved ? new Date(date_approved).toISOString() : new Date().toISOString(),
        })
        .eq('id', order.id);

      // Determinar o plano ou pacote comprado através do campo payment_method salvo na ordem ('plan_starter', 'pack_extra_100_pages', etc)
      const paymentMethod = order.payment_method || '';
      if (paymentMethod.startsWith('plan_')) {
        const planType = paymentMethod.replace('plan_', '') as PlanType;
        
        // Ativar a assinatura do usuário!
        await activateSubscription(order.user_id, planType);
        console.log(`✅ Assinatura do usuário ${order.user_id} para o plano ${planType} ativada via Webhook`);
      } else if (paymentMethod.startsWith('pack_')) {
        const packType = paymentMethod.replace('pack_', '');
        const extraPacks: Record<string, number> = {
          extra_100_pages: 100,
          extra_500_pages: 500,
          extra_1000_pages: 1000,
        };
        const pagesToAdd = extraPacks[packType] || 0;
        
        if (pagesToAdd > 0) {
          const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('credits_available')
            .eq('user_id', order.user_id)
            .maybeSingle();
            
          if (sub) {
            await supabaseAdmin
              .from('subscriptions')
              .update({
                credits_available: sub.credits_available + pagesToAdd,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', order.user_id);
            console.log(`✅ Adicionado ${pagesToAdd} páginas avulsas para o usuário ${order.user_id} via Webhook`);
          }
        }
      }
    }

    // Se o pagamento foi rejeitado ou cancelado
    if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
      await supabaseAdmin
        .from('orders')
        .update({
          status,
          payment_id: String(providerPaymentId),
        })
        .eq('id', order.id);
      
      console.log(`⚠️ Pagamento ${providerPaymentId} ${status} para ordem ${order.id}`);
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}