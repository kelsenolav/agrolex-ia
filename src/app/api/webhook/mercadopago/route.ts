import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Pega os parâmetros do Mercado Pago (via query ou body)
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic') || searchParams.get('type');
    const id = searchParams.get('id') || searchParams.get('data.id');

    if (topic === 'payment' && id) {
      // 1. Consultar a API do MP para verificar o status real do pagamento
      const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
      });
      const paymentData = await mpResponse.json();

      if (paymentData.status === 'approved') {
        const analysisId = paymentData.external_reference;
        
        if (analysisId) {
          // Atualiza a análise no banco para processing
          await supabaseAdmin
            .from('analyses')
            .update({ status: 'processing' })
            .eq('id', analysisId)
            .eq('status', 'payment_pending'); // Só atualiza se estava aguardando pagamento
            
          // Aqui idealmente dispararíamos um background job para chamar a API do Gemini.
          // Como o Next.js serverless não suporta background jobs nativos de longa duração facilmente,
          // uma arquitetura comum é ter um cron job ou o próprio frontend polling (neste MVP) chamar a IA
          // quando o status for 'processing'. Para este MVP, deixamos a análise como processing, 
          // e o cliente que já está na tela aguardando fará o disparo para /api/analyze assim que a tela detectar 'processing'.
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
