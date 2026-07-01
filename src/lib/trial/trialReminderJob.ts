import type { SupabaseClient } from '@supabase/supabase-js';
import { classificarSegmentoTrial, diasDesde, proximoMarcoLembrete } from './trialReminder';
import { sendTrialReminderEmail } from '@/lib/monitoring/notificationService';

export interface TrialReminderJobResult {
  avaliados: number;
  enviados: number;
  pulados: number;
  falhas: string[];
}

interface MarketingLeadRow {
  id: string;
  email: string;
  nome: string | null;
  user_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Lembra leads que criaram conta mas não têm nenhuma análise concluída —
 * cobre tanto quem nunca iniciou quanto quem começou e não terminou (achado
 * real: usuário com 3 eventos trial_started e zero linhas em `analyses`,
 * porque o trial nunca chega a `trial_used=true` até a análise concluir —
 * ver AGENTS.md). Cada lead recebe no máximo 1 lembrete por marco (3 e 10
 * dias após o cadastro), estado persistido em `metadata.trial_reminder`
 * (sem migration — mesmo padrão já usado por `interest_info`/`commercial_events`).
 *
 * Fail-safe: erro em qualquer lead não interrompe os demais.
 */
export async function runTrialReminderJob(admin: SupabaseClient): Promise<TrialReminderJobResult> {
  const result: TrialReminderJobResult = { avaliados: 0, enviados: 0, pulados: 0, falhas: [] };

  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: leads, error } = await admin
    .from('marketing_leads')
    .select('id, email, nome, user_id, created_at, metadata')
    .not('user_id', 'is', null)
    .eq('converteu', false)
    .lte('created_at', cutoff);

  if (error) {
    result.falhas.push(`query marketing_leads: ${error.message}`);
    return result;
  }

  const candidatos = (leads ?? []) as MarketingLeadRow[];
  if (candidatos.length === 0) return result;

  const userIds = Array.from(new Set(candidatos.map((l) => l.user_id)));
  const { data: analises, error: analisesError } = await admin
    .from('analyses')
    .select('user_id, status')
    .in('user_id', userIds);

  if (analisesError) {
    result.falhas.push(`query analyses: ${analisesError.message}`);
    return result;
  }

  const concluidasPorUsuario = new Set<string>();
  for (const a of analises ?? []) {
    if (a.status === 'completed') concluidasPorUsuario.add(a.user_id as string);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agrolex-ia-qx32.vercel.app';
  const ctaUrl = `${siteUrl}/dashboard/nova-analise`;

  for (const lead of candidatos) {
    result.avaliados++;

    const metadata = lead.metadata ?? {};
    const events = Array.isArray(metadata.commercial_events)
      ? (metadata.commercial_events as Array<{ type: string }>)
      : [];

    // Gate duplo: a tabela `analyses` pode não refletir uma conclusão antiga
    // se a análise foi deletada depois (achado real — lead com trial_completed
    // no histórico mas 0 linhas concluídas hoje). O evento trial_completed é
    // a fonte mais confiável de "já teve sucesso alguma vez" — nunca mandar
    // "você ainda não usou sua análise gratuita" pra quem já usou.
    const jaCompletouTrialHistoricamente = events.some((e) => e.type === 'trial_completed');
    if (concluidasPorUsuario.has(lead.user_id) || jaCompletouTrialHistoricamente) {
      result.pulados++;
      continue;
    }

    const reminderState = (metadata.trial_reminder as { milestones_sent?: number[] } | undefined) ?? {};
    const marcosEnviados = reminderState.milestones_sent ?? [];

    const dias = diasDesde(lead.created_at);
    const marco = proximoMarcoLembrete(dias, marcosEnviados);
    if (marco === null) {
      result.pulados++;
      continue;
    }

    const segmento = classificarSegmentoTrial(events);
    const r = await sendTrialReminderEmail({
      user_email: lead.email,
      user_name: lead.nome || undefined,
      segmento,
      cta_url: ctaUrl,
    });

    if (r.sent || r.method === 'log_only') {
      result.enviados++;
      const { error: updateErr } = await admin
        .from('marketing_leads')
        .update({
          metadata: {
            ...metadata,
            trial_reminder: {
              milestones_sent: [...marcosEnviados, marco],
              last_sent_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', lead.id);
      if (updateErr) {
        result.falhas.push(`${lead.email}: falha ao persistir marco enviado (${updateErr.message})`);
      }
    } else {
      result.falhas.push(`${lead.email}: ${r.error}`);
    }
  }

  return result;
}
