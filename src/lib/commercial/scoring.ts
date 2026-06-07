/**
 * scoring.ts — Lead Scoring Comercial AgroLex
 *
 * SPRINT COMERCIAL P0 — FASE 3: Lead Scoring + Eventos Comerciais + Ranking de Leads Quentes
 *
 * Funções PURE de scoring. Nenhuma dependência de banco ou API.
 * Persistência: via leads.metadata.commercial_events (campo JSON existente).
 * Se metadata não existir, scoring é derivado de dados existentes (sem alterar schema).
 */

// ─── TIPOS ────────────────────────────────────────────────────────────────────

/**
 * Tipos de eventos comerciais rastreados no funil AgroLex.
 */
export type CommercialEventType =
  | 'signup'
  | 'lead_completed'
  | 'trial_started'
  | 'analysis_completed'
  | 'result_viewed'
  | 'plan_clicked'
  | 'blocked_pdf_clicked'
  | 'blocked_chain_clicked'
  | 'blocked_premium_clicked'
  | 'trial_blocked'
  | 'upgrade_cta_view'
  | 'upgrade_cta_click'
  | 'result_partial_view'
  | 'result_upgrade_click'
  | 'interest_modal_open'
  | 'interest_form_started'
  | 'interest_form_completed'
  | 'interest_plan_selected'
  | 'interest_volume_selected';

/**
 * Nível de temperatura do lead.
 */
export type CommercialScoreLevel = 'frio' | 'morno' | 'quente' | 'muito_quente';

/**
 * Estrutura de um evento comercial registrado.
 */
export interface CommercialEvent {
  type: CommercialEventType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Metadados opcionais do evento */
  meta?: Record<string, unknown>;
}

// ─── PONTUAÇÃO POR EVENTO ─────────────────────────────────────────────────────

/**
 * Mapa de pontuação por tipo de evento.
 * Eventos de maior intenção de compra recebem pontuação maior.
 */
export const COMMERCIAL_EVENT_SCORES: Record<CommercialEventType, number> = {
  signup: 10,
  lead_completed: 20,
  trial_started: 30,
  analysis_completed: 40,
  result_viewed: 50,
  plan_clicked: 70,
  blocked_pdf_clicked: 80,
  blocked_chain_clicked: 90,
  blocked_premium_clicked: 90,
  trial_blocked: 15,
  upgrade_cta_view: 10,
  upgrade_cta_click: 30,
  result_partial_view: 20,
  result_upgrade_click: 35,
  interest_modal_open: 5,
  interest_form_started: 10,
  interest_form_completed: 40,
  interest_plan_selected: 15,
  interest_volume_selected: 15,
};

// ─── FUNÇÕES CORE ─────────────────────────────────────────────────────────────

/**
 * Retorna a pontuação de um único evento comercial.
 * Retorna 0 para eventos desconhecidos (fallback seguro).
 *
 * @param event - Tipo do evento ou objeto CommercialEvent
 */
export function getCommercialEventScore(event: CommercialEventType | CommercialEvent): number {
  const type = typeof event === 'string' ? event : event.type;
  return COMMERCIAL_EVENT_SCORES[type as CommercialEventType] ?? 0;
}

/**
 * Calcula o score comercial total a partir de uma lista de eventos.
 * Soma todos os pontos de todos os eventos (sem teto — pode ultrapassar 100).
 *
 * @param events - Lista de eventos comerciais
 */
export function calculateCommercialScore(events: CommercialEvent[]): number {
  if (!Array.isArray(events) || events.length === 0) return 0;
  return events.reduce((total, event) => total + getCommercialEventScore(event), 0);
}

/**
 * Classifica o score em nível de temperatura do lead.
 *
 * Faixas:
 *   0–30:    frio
 *   31–60:   morno
 *   61–100:  quente
 *   > 100:   muito_quente
 *
 * @param score - Score numérico calculado
 */
export function getCommercialScoreLevel(score: number): CommercialScoreLevel {
  if (score <= 30) return 'frio';
  if (score <= 60) return 'morno';
  if (score <= 100) return 'quente';
  return 'muito_quente';
}

/**
 * Retorna o label legível em português para o nível de score.
 *
 * @param score - Score numérico calculado
 */
export function getCommercialScoreLabel(score: number): string {
  const level = getCommercialScoreLevel(score);
  const labels: Record<CommercialScoreLevel, string> = {
    frio: 'Frio',
    morno: 'Morno',
    quente: 'Quente',
    muito_quente: 'Muito Quente',
  };
  return labels[level];
}

/**
 * Retorna o badge visual (emoji + label) para o nível de score.
 * Usado em tabelas e KPIs do dashboard comercial.
 *
 * @param score - Score numérico calculado
 */
export function getCommercialScoreBadge(score: number): {
  emoji: string;
  label: string;
  level: CommercialScoreLevel;
  colorClass: string;
} {
  const level = getCommercialScoreLevel(score);

  const badges: Record<CommercialScoreLevel, { emoji: string; label: string; colorClass: string }> = {
    frio: {
      emoji: '🧊',
      label: 'Frio',
      colorClass: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    morno: {
      emoji: '🌤️',
      label: 'Morno',
      colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    },
    quente: {
      emoji: '🔥',
      label: 'Quente',
      colorClass: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    muito_quente: {
      emoji: '🚀',
      label: 'Muito Quente',
      colorClass: 'bg-red-100 text-red-700 border-red-200',
    },
  };

  return { ...badges[level], level };
}

// ─── HELPERS DE PERSISTÊNCIA ──────────────────────────────────────────────────

/**
 * Cria um novo evento comercial com timestamp atual.
 *
 * @param type - Tipo do evento
 * @param meta - Metadados opcionais
 */
export function createCommercialEvent(
  type: CommercialEventType,
  meta?: Record<string, unknown>
): CommercialEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };
}

/**
 * Extrai eventos comerciais do campo metadata de um lead.
 * Retorna array vazio se metadata não existir ou não tiver commercial_events.
 *
 * @param metadata - Campo metadata do lead (JSON)
 */
export function extractEventsFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): CommercialEvent[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const events = (metadata as Record<string, unknown>).commercial_events;
  if (!Array.isArray(events)) return [];
  return events as CommercialEvent[];
}

/**
 * Adiciona um evento ao array de eventos existentes.
 * Retorna novo array (imutável).
 *
 * @param existingEvents - Eventos já registrados
 * @param newEvent - Novo evento a adicionar
 */
export function appendCommercialEvent(
  existingEvents: CommercialEvent[],
  newEvent: CommercialEvent
): CommercialEvent[] {
  return [...existingEvents, newEvent];
}

/**
 * Monta o payload de metadata atualizado com o novo evento.
 * Seguro para upsert em leads.metadata sem alterar outros campos.
 *
 * @param currentMetadata - Metadata atual do lead
 * @param newEvent - Novo evento a registrar
 */
export function buildMetadataWithEvent(
  currentMetadata: Record<string, unknown> | null | undefined,
  newEvent: CommercialEvent
): Record<string, unknown> {
  const existing = extractEventsFromMetadata(currentMetadata);
  const updated = appendCommercialEvent(existing, newEvent);
  return {
    ...(currentMetadata ?? {}),
    commercial_events: updated,
  };
}

/**
 * Calcula o score de um lead a partir do seu campo metadata.
 * Fallback seguro: retorna 0 se não houver eventos.
 *
 * @param metadata - Campo metadata do lead
 */
export function calculateLeadScore(
  metadata: Record<string, unknown> | null | undefined
): number {
  const events = extractEventsFromMetadata(metadata);
  return calculateCommercialScore(events);
}

/**
 * Retorna o último evento registrado no metadata do lead.
 * Retorna null se não houver eventos.
 *
 * @param metadata - Campo metadata do lead
 */
export function getLastCommercialEvent(
  metadata: Record<string, unknown> | null | undefined
): CommercialEvent | null {
  const events = extractEventsFromMetadata(metadata);
  if (events.length === 0) return null;
  return events[events.length - 1];
}

// ─── ORDENAÇÃO DE LEADS ───────────────────────────────────────────────────────

/**
 * Peso de ordenação por nível (maior = mais prioritário).
 */
const LEVEL_ORDER_WEIGHT: Record<CommercialScoreLevel, number> = {
  muito_quente: 4,
  quente: 3,
  morno: 2,
  frio: 1,
};

/**
 * Compara dois scores para ordenação decrescente (muito_quente primeiro).
 * Uso: array.sort(compareLeadScores)
 */
export function compareLeadScores(scoreA: number, scoreB: number): number {
  const levelA = getCommercialScoreLevel(scoreA);
  const levelB = getCommercialScoreLevel(scoreB);
  const weightDiff = LEVEL_ORDER_WEIGHT[levelB] - LEVEL_ORDER_WEIGHT[levelA];
  if (weightDiff !== 0) return weightDiff;
  // Mesmo nível: ordena por score numérico decrescente
  return scoreB - scoreA;
}

/**
 * Calcula a pontuação baseada em plano e volume de interesse comercial (FASE 6).
 */
export function calculateInterestScore(plan?: string | null, volume?: string | null): number {
  const planClean = String(plan || '').toLowerCase().trim();
  const volumeClean = String(volume || '').toLowerCase().trim();

  // Empresarial + Mais de 100 análises
  if (planClean.includes('empresarial') && (volumeClean.includes('mais de 100') || volumeClean.includes('> 100') || volumeClean.includes('mais de 100 análises/mês'))) {
    return 100;
  }
  // Profissional + Até 25 análises
  if (planClean.includes('profissional') && (volumeClean.includes('até 25') || volumeClean.includes('25'))) {
    return 70;
  }
  // Usuário Ocasional/Starter + Até 5 análises
  if ((planClean.includes('ocasional') || planClean.includes('starter')) && (volumeClean.includes('até 5') || volumeClean.includes('5'))) {
    return 30;
  }

  // Fallback padrão
  return 10;
}

