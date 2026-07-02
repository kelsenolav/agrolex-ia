import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cancelPreapproval } from '@/lib/payments/mercadopagoPreapproval';

export const dynamic = 'force-dynamic';

/**
 * Cancela a renovação automática do Radar do PRÓPRIO usuário autenticado.
 * Postura CDC: cancelar tão fácil quanto assinar — e o acesso permanece até
 * o fim do período já pago (expires_at), quem corta depois é o cron.
 */
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: sub } = await adminClient
      .from('radar_subscriptions')
      .select('status, expires_at, mp_preapproval_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub || !sub.mp_preapproval_id) {
      return NextResponse.json({ error: 'Nenhuma assinatura com renovação automática encontrada' }, { status: 404 });
    }
    if (sub.status === 'cancelled') {
      return NextResponse.json({ ok: true, message: 'Assinatura já cancelada', expires_at: sub.expires_at });
    }

    // Cancela no MP primeiro; só marca no banco se o MP confirmou (se falhar
    // aqui, o cliente ainda seria cobrado — melhor erro explícito que estado mentiroso).
    try {
      await cancelPreapproval(sub.mp_preapproval_id);
    } catch (mpError) {
      console.error('[subscription/cancel] falha ao cancelar no MP:', mpError);
      return NextResponse.json(
        { error: 'Não foi possível cancelar junto ao Mercado Pago. Tente novamente em instantes.' },
        { status: 502 },
      );
    }

    await adminClient
      .from('radar_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return NextResponse.json({
      ok: true,
      message: 'Renovação automática cancelada. Seu acesso permanece até o fim do período já pago.',
      expires_at: sub.expires_at,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
