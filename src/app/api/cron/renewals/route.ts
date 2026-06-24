import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { daysUntilExpiry } from '@/lib/monitoring/radarRenewal';
import { sendRadarRenewalReminder } from '@/lib/monitoring/notificationService';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Dias-marco em que o lembrete é enviado (cron diário; cada assinatura cruza
// cada marco uma vez → sem spam diário, sem precisar de coluna nova).
const MILESTONES = new Set([7, 3, 1, 0, -1]);

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Configuração do Supabase incompleta' }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = Date.now();
  const janelaInicio = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
  const janelaFim = new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString();

  // Assinaturas ativas cuja expiração cai na janela de lembrete (−2d … +8d).
  const { data: subs, error } = await admin
    .from('radar_subscriptions')
    .select('user_id, expires_at, status')
    .eq('status', 'active')
    .gte('expires_at', janelaInicio)
    .lte('expires_at', janelaFim);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const renewUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agrolex-ia-qx32.vercel.app'}/dashboard/radar?checkout=true`;
  let enviados = 0;
  let pulados = 0;
  const falhas: string[] = [];

  for (const sub of subs || []) {
    const dias = daysUntilExpiry(sub.expires_at, now);
    if (dias === null || !MILESTONES.has(dias)) {
      pulados++;
      continue;
    }
    const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id);
    const email = authUser?.user?.email;
    if (!email) {
      pulados++;
      continue;
    }
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', sub.user_id)
      .maybeSingle();

    const r = await sendRadarRenewalReminder({
      user_email: email,
      user_name: profile?.full_name || undefined,
      days_until_expiry: dias,
      renew_url: renewUrl,
    });
    if (r.sent || r.method === 'log_only') enviados++;
    else falhas.push(`${sub.user_id}: ${r.error}`);
  }

  return NextResponse.json({
    success: true,
    avaliadas: subs?.length || 0,
    enviados,
    pulados,
    ...(falhas.length ? { falhas } : {}),
  });
}
