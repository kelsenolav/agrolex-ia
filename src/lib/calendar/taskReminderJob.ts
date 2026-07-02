import type { SupabaseClient } from '@supabase/supabase-js';
import { sendCalendarTaskReminder } from '@/lib/monitoring/notificationService';

// Marcos de aviso antes do vencimento (o cron roda 1x/dia — cada tarefa cruza
// cada marco uma única vez, sem precisar de coluna de estado).
export const MARCOS_CALENDARIO = [7, 3, 0] as const;

/**
 * Dias corridos até o vencimento (data no formato YYYY-MM-DD, interpretada em
 * fuso local — evita que 00:00 UTC vire véspera no Brasil). Negativo = vencida.
 */
export function diasAteVencimento(dueDate: string, agora = Date.now()): number | null {
  const [y, m, d] = dueDate.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d);
  due.setHours(0, 0, 0, 0);
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export interface CalendarReminderJobResult {
  avaliadas: number;
  enviados: number;
  pulados: number;
  falhas: string[];
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  profiles: { email: string | null; name: string | null } | { email: string | null; name: string | null }[] | null;
  properties: { name: string | null } | { name: string | null }[] | null;
}

function first<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Avisa por e-mail obrigações ambientais pendentes nos marcos de 7/3/0 dias
 * antes do vencimento. Ressuscitado do cron órfão de 2026-06 (nunca esteve
 * agendado; remetente era o demo do Resend e o "WhatsApp" era um console.log
 * de simulação — removido). Fail-safe: erro em uma tarefa não bloqueia as demais.
 */
export async function runCalendarReminderJob(admin: SupabaseClient, agora = Date.now()): Promise<CalendarReminderJobResult> {
  const result: CalendarReminderJobResult = { avaliadas: 0, enviados: 0, pulados: 0, falhas: [] };

  const { data: tasks, error } = await admin
    .from('environmental_tasks')
    .select('id, title, due_date, profiles(email, name), properties(name)')
    .eq('status', 'Pendente');

  if (error) {
    result.falhas.push(`query environmental_tasks: ${error.message}`);
    return result;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agrolexi.com.br';

  for (const task of (tasks ?? []) as TaskRow[]) {
    result.avaliadas++;

    const dias = diasAteVencimento(task.due_date, agora);
    if (dias === null || !MARCOS_CALENDARIO.includes(dias as (typeof MARCOS_CALENDARIO)[number])) {
      result.pulados++;
      continue;
    }

    const profile = first(task.profiles);
    const email = profile?.email;
    if (!email) {
      result.pulados++;
      continue;
    }

    const r = await sendCalendarTaskReminder({
      user_email: email,
      user_name: profile?.name || undefined,
      task_title: task.title,
      property_name: first(task.properties)?.name || undefined,
      dias_restantes: dias,
      cta_url: `${siteUrl}/dashboard/calendario`,
    });

    if (r.sent || r.method === 'log_only') result.enviados++;
    else result.falhas.push(`${task.id} (${task.title}): ${r.error}`);
  }

  return result;
}
