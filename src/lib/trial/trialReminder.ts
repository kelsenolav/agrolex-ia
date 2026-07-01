// ─── Lembrete de trial abandonado (funil) ────────────────────────────────────
// Funções puras — sem I/O — para decidir SE e COMO lembrar um lead que se
// cadastrou mas não concluiu (ou nunca iniciou) sua análise gratuita.

export type TrialReminderSegment = 'nunca_iniciou' | 'iniciou_sem_concluir';

export interface CommercialEventLike {
  type: string;
}

// Dias após o cadastro em que um lembrete é elegível (cada marco dispara no
// máximo uma vez — controlado por `marcosJaEnviados`, persistido fora daqui).
export const MILESTONES_DIAS = [3, 10] as const;

export function classificarSegmentoTrial(events: CommercialEventLike[]): TrialReminderSegment {
  const iniciou = events.some((e) => e.type === 'trial_started');
  const concluiu = events.some((e) => e.type === 'trial_completed');
  return iniciou && !concluiu ? 'iniciou_sem_concluir' : 'nunca_iniciou';
}

export function diasDesde(dataIso: string, agora = Date.now()): number {
  const d = new Date(dataIso).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((agora - d) / (1000 * 60 * 60 * 24));
}

/**
 * Retorna o primeiro marco (em dias) já alcançado e ainda não enviado, ou
 * `null` se nenhum marco se aplica agora. Iterar em ordem crescente garante
 * que, se o cron ficar um tempo sem rodar, os marcos sejam recuperados um por
 * vez (nunca dois lembretes na mesma execução).
 */
export function proximoMarcoLembrete(diasCadastro: number, marcosJaEnviados: number[]): number | null {
  for (const marco of MILESTONES_DIAS) {
    if (diasCadastro >= marco && !marcosJaEnviados.includes(marco)) {
      return marco;
    }
  }
  return null;
}
