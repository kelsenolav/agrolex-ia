import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { daysUntilExpiry, radarLifecycleState, shouldSkipManualRenewalReminder } from '@/lib/monitoring/radarRenewal';
import { sendRadarRenewalReminder } from '@/lib/monitoring/notificationService';
import { runTrialReminderJob } from '@/lib/trial/trialReminderJob';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Dias-marco do lembrete/dunning (cron diário; cada assinatura cruza cada marco
// uma vez → sem spam diário, sem coluna nova). Positivos = pré-vencimento;
// negativos = dunning durante a graça.
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
  // Janela ampla (−45d … +8d) p/ alcançar tanto pré-vencimento quanto expiradas
  // que ainda estão marcadas 'active' e precisam ser fechadas.
  const janelaInicio = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString();
  const janelaFim = new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString();

  // 'paused' (Preapproval com cobrança automática falhada) entra na varredura:
  // recebe dunning por marco e fecha como expired pós-graça, igual à ativa.
  const { data: subs, error } = await admin
    .from('radar_subscriptions')
    .select('user_id, expires_at, status, mp_preapproval_id')
    .in('status', ['active', 'paused'])
    .gte('expires_at', janelaInicio)
    .lte('expires_at', janelaFim);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const renewUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agrolex-ia-qx32.vercel.app'}/dashboard/radar?checkout=true`;
  let enviados = 0;
  let expiradas = 0;
  let pulados = 0;
  const falhas: string[] = [];

  for (const sub of subs || []) {
    const dias = daysUntilExpiry(sub.expires_at, now);
    const estado = radarLifecycleState(sub.expires_at, now);
    const ehMilestone = dias !== null && MILESTONES.has(dias);

    // Fora de marco e ainda não expirou de fato → nada a fazer.
    if (estado !== 'expired' && !ehMilestone) {
      pulados++;
      continue;
    }

    // Preapproval ativo (renovação automática): o MP cobra sozinho — pedir
    // "renove manualmente" confundiria. Só o fechamento pós-graça permanece
    // (se chegou a expirar, a cobrança automática não veio — win-back se aplica).
    if (shouldSkipManualRenewalReminder(sub.status, sub.mp_preapproval_id, estado)) {
      pulados++;
      continue;
    }

    // Resolve e-mail/nome (necessário tanto para lembrete quanto para win-back).
    const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id);
    const email = authUser?.user?.email;
    const { data: profile } = email
      ? await admin.from('profiles').select('full_name').eq('id', sub.user_id).maybeSingle()
      : { data: null };

    if (estado === 'expired') {
      // Passou da graça: fecha a assinatura (status='expired') — fim do vazamento
      // de monitoramento grátis — e envia win-back (uma vez; o flip evita reprocesso).
      await admin
        .from('radar_subscriptions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('user_id', sub.user_id)
        .in('status', ['active', 'paused']);
      expiradas++;
      if (email) {
        const r = await sendRadarRenewalReminder({
          user_email: email,
          user_name: profile?.full_name || undefined,
          days_until_expiry: dias ?? -1,
          renew_url: renewUrl,
        });
        if (r.sent || r.method === 'log_only') enviados++;
        else falhas.push(`${sub.user_id}: ${r.error}`);
      }
      continue;
    }

    // Marco de lembrete/dunning (pré-vencimento ou dentro da graça).
    if (!email) {
      pulados++;
      continue;
    }
    const r = await sendRadarRenewalReminder({
      user_email: email,
      user_name: profile?.full_name || undefined,
      days_until_expiry: dias as number,
      renew_url: renewUrl,
    });
    if (r.sent || r.method === 'log_only') enviados++;
    else falhas.push(`${sub.user_id}: ${r.error}`);
  }

  // Lembrete de trial abandonado (funil de ativação) — reaproveita este cron
  // diário em vez de registrar um 3º job em vercel.json (evita depender do
  // limite de crons do plano Vercel). Falha aqui não afeta o resultado do
  // Radar acima (bloco isolado, sempre reportado à parte).
  //
  // GATE EXPLÍCITO: só envia de verdade com TRIAL_REMINDER_ENABLED=true. Sem
  // essa flag, o código roda (deploy seguro) mas não dispara nenhum e-mail —
  // decisão consciente para não começar a mandar e-mail automático a leads
  // reais só porque o código foi implantado. Ativar exige o operador setar a
  // env var no Vercel (mesmo padrão de RESEND_API_KEY/CRON_SECRET/MP prod).
  const trialReminderEnabled = process.env.TRIAL_REMINDER_ENABLED === 'true';
  let trialReminders: (Awaited<ReturnType<typeof runTrialReminderJob>> & { enabled: boolean }) | null = null;
  if (!trialReminderEnabled) {
    trialReminders = { avaliados: 0, enviados: 0, pulados: 0, falhas: [], enabled: false };
  } else {
    try {
      const jobResult = await runTrialReminderJob(admin);
      trialReminders = { ...jobResult, enabled: true };
    } catch (err: unknown) {
      trialReminders = {
        avaliados: 0,
        enviados: 0,
        pulados: 0,
        falhas: [err instanceof Error ? err.message : String(err)],
        enabled: true,
      };
    }
  }

  return NextResponse.json({
    success: true,
    avaliadas: subs?.length || 0,
    enviados,
    expiradas,
    pulados,
    ...(falhas.length ? { falhas } : {}),
    trial_reminders: trialReminders,
  });
}
