import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCalendarReminderJob } from '@/lib/calendar/taskReminderJob';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lembretes do Calendário Ambiental (marcos 7/3/0 dias antes do vencimento).
 *
 * Esta rota existia desde 2026-06 mas nunca esteve agendada (órfã) — a lógica
 * foi ressuscitada em src/lib/calendar/taskReminderJob.ts e roda diariamente
 * dentro do /api/cron/renewals. Este endpoint permanece como gatilho manual,
 * agora com a mesma autenticação por CRON_SECRET dos demais crons.
 */
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

  const result = await runCalendarReminderJob(admin);
  return NextResponse.json({ success: true, ...result });
}
