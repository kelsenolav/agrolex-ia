// Lógica pura de renovação/expiração de assinatura do Radar (Eixo 2 / 2.1).
// Sem I/O — testável e reutilizada pelo webhook (extensão), pelo cron de
// lembretes (detecção) e pelo dashboard (contagem regressiva).

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Nova data de expiração ao pagar uma assinatura de Radar.
 * Se a assinatura ainda está VIGENTE (renovação antecipada), estende a partir
 * do `expires_at` atual (não perde o tempo restante). Se expirada/nova, conta
 * a partir de agora. Sempre retorna ISO string.
 */
export function computeRenewalExpiry(
  currentExpiresAt: string | null | undefined,
  nowMs: number,
  days = 30,
): string {
  const base = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const start = Number.isFinite(base) && base > nowMs ? base : nowMs;
  return new Date(start + days * DIA_MS).toISOString();
}

/** Dias inteiros até expirar (negativo se já expirou; null se sem data). Arredonda p/ cima. */
export function daysUntilExpiry(expiresAt: string | null | undefined, nowMs: number): number | null {
  if (!expiresAt) return null;
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp)) return null;
  return Math.ceil((exp - nowMs) / DIA_MS);
}

/** true se expira dentro de `thresholdDays` e ainda NÃO expirou (janela de lembrete). */
export function isExpiringSoon(
  expiresAt: string | null | undefined,
  nowMs: number,
  thresholdDays = 7,
): boolean {
  const d = daysUntilExpiry(expiresAt, nowMs);
  return d !== null && d >= 0 && d <= thresholdDays;
}

/** true se a assinatura já passou da data de expiração. */
export function isExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  const d = daysUntilExpiry(expiresAt, nowMs);
  return d !== null && d < 0;
}

/** Extrai a quantidade de propriedades de um payment_method "radar_3_properties" → 3. */
export function parseRadarPropertyCount(paymentMethod: string | null | undefined): number {
  const m = /^radar_(\d+)_properties$/.exec(String(paymentMethod || ''));
  const n = m ? parseInt(m[1], 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 1;
}
