import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPayment, isSandbox } from '@/lib/payments/mercadopago';

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

    // Ler o corpo da requisição
    const body = await req.json().catch(() => ({}));

    // Mercado Pago pode enviar notificações de dois tipos:
    // 1. Tipo 'payment' com data.id (notificação de pagamento)
    // 2. Tipo 'merchant_order' (notificação de ordem)

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

    console.log(`Webhook MP: processing payment ${paymentId} (sandbox: ${isSandbox()})`);

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
      transaction_amount,
      external_reference: analysisId,
      date_approved,
      date_created,
    } = paymentData;

    console.log(`Pagamento ${providerPaymentId}: status=${status}, detail=${status_detail}, analysis=${analysisId}`);

    // Buscar a ordem associada
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, user_id')
      .eq('preference_id', analysisId ? undefined : undefined)
      .or(analysisId ? `analysis_id.eq.${analysisId}` : `preference_id.eq.${providerPaymentId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const orderId = order?.id;

    // Registrar payment no banco
    await supabaseAdmin
      .from('payments')
      .insert({
        order_id: orderId || undefined,
        provider: 'mercadopago',
        provider_payment_id: String(providerPaymentId),
        status,
        status_detail,
        payment_type_id,
        installments: installments || 1,
        raw_response: paymentData,
      });

    // Se o pagamento foi aprovado
    if (status === 'approved' && analysisId) {
      // Atualizar ordem
      if (orderId) {
        await supabaseAdmin
          .from('orders')
          .update({
            status: 'approved',
            payment_id: String(providerPaymentId),
            payment_method: payment_type_id,
            paid_at: date_approved ? new Date(date_approved).toISOString() : new Date().toISOString(),
          })
          .eq('id', orderId);
      }

      // Atualizar análise: payment_pending → ready_for_processing
      const { data: analysis } = await supabaseAdmin
        .from('analyses')
        .select('id, status, findings')
        .eq('id', analysisId)
        .single();

      if (analysis) {
        const currentStatus = (analysis.status || '').toLowerCase().trim();
        if (currentStatus === 'payment_pending' || currentStatus === 'pending') {
          const findings = analysis.findings || {};
          const updatedFindings = {
            ...findings,
            payment_mode: 'mercadopago',
            payment_status: 'approved',
            payment_id: String(providerPaymentId),
            payment_approved_at: date_approved || new Date().toISOString(),
            current_step: 'Pagamento aprovado. Aguardando início da análise.',
            ready_for_processing_at: new Date().toISOString(),
          };

          await supabaseAdmin
            .from('analyses')
            .update({
              status: 'ready_for_processing',
              findings: updatedFindings,
            })
            .eq('id', analysisId);

          console.log(`✅ Análise ${analysisId} liberada para processamento`);
        }
      }
    }

    // Se o pagamento foi rejeitado ou cancelado
    if ((status === 'rejected' || status === 'cancelled' || status === 'refunded') && analysisId) {
      if (orderId) {
        await supabaseAdmin
          .from('orders')
          .update({
            status,
            payment_id: String(providerPaymentId),
          })
          .eq('id', orderId);
      }

      // Atualizar análise com status de pagamento rejeitado
      const { data: analysis } = await supabaseAdmin
        .from('analyses')
        .select('id, findings')
        .eq('id', analysisId)
        .single();

      if (analysis) {
        const findings = analysis.findings || {};
        const updatedFindings = {
          ...findings,
          payment_status: status,
          payment_status_detail: status_detail,
          current_step: `Pagamento ${status}. Reenvie o pagamento para continuar.`,
        };

        await supabaseAdmin
          .from('analyses')
          .update({
            findings: updatedFindings,
          })
          .eq('id', analysisId);

        console.log(`⚠️ Pagamento ${providerPaymentId} ${status} para análise ${analysisId}`);
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}