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

// ─── WhatsApp manual (admin clica, sem API) ──────────────────────────────────
// Funções client-safe (sem `process.env`/Node) — usadas tanto pelo cron de
// e-mail quanto pela página /dashboard/leads.

/**
 * Normaliza um telefone brasileiro salvo em qualquer formato pro padrão que o
 * wa.me exige (só dígitos, com código do país). Nunca lança erro nem tenta
 * "corrigir" números tortos (ex: faltando o 9) — só garante o prefixo 55.
 * Retorna `null` só quando não há dígito nenhum pra normalizar.
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/**
 * Mesmo texto usado no e-mail (sendTrialReminderEmail), em versão texto puro
 * pronta pro wa.me — sem HTML, com saudação mais direta de conversa.
 */
export function getWhatsAppReminderMessage(
  segmento: TrialReminderSegment,
  nome: string | undefined,
  ctaUrl: string
): string {
  const primeiroNome = (nome ?? '').trim().split(/\s+/)[0] || 'tudo bem';
  const corpo = segmento === 'iniciou_sem_concluir'
    ? 'Notei que você começou uma análise gratuita no AgrolexI, mas ela não chegou a terminar — provavelmente foi uma instabilidade técnica pontual. Sua análise gratuita continua disponível, sem custo. Quer tentar de novo?'
    : 'Você se cadastrou no AgrolexI, mas ainda não usou sua análise gratuita de matrícula. Leva poucos minutos: envie o PDF da matrícula e receba um Índice de Segurança Fundiária (ISF) com os principais riscos da propriedade.';
  return `Oi, ${primeiroNome}! ${corpo} É só entrar aqui: ${ctaUrl}`;
}
