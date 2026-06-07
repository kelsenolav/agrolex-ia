/**
 * radarNormalizer.ts — Camada única de normalização do Radar v2
 *
 * SPRINT 2 — RADAR v2 BASEADO EM DADOS REAIS
 *
 * Transforma findings.isf_v2 em dados prontos para renderização do radar.
 * Proibido: score legado, mock, fallback fake, valor aleatório.
 *
 * Fluxo:
 *   findings.isf_v2
 *   ↓
 *   normalizarRadarISF()
 *   ↓
 *   Radar v2 (5 eixos: Registral, Dominial, Litígio, Possessório, Fraude)
 */

import type { Eixo, FaixaRisco } from './isfV2';

// ─── THRESHOLDS VISUAIS (FASE 5) ───────────────────────────────────────

/**
 * Thresholds de classificação visual do radar.
 * Cada eixo tem seu próprio threshold configurável.
 * 0–29     Crítico
 * 30–49    Alto Risco
 * 50–69    Atenção
 * 70–84    Seguro
 * 85–100   Muito Seguro
 */
export const RADAR_THRESHOLDS = {
  REG: { baixo: 25, medio: 50, alto: 70 },
  DOM: { baixo: 25, medio: 50, alto: 70 },
  LIT: { baixo: 25, medio: 50, alto: 70 },
  POS: { baixo: 25, medio: 50, alto: 70 },
  FRA: { baixo: 25, medio: 50, alto: 70 },
} as const;

export type RadarNivel = 'baixo' | 'medio' | 'alto' | 'critico';

export const RADAR_NIVEL_THRESHOLDS: { nivel: RadarNivel; min: number }[] = [
  { nivel: 'critico',   min: 70 },
  { nivel: 'alto',      min: 50 },
  { nivel: 'medio',     min: 25 },
  { nivel: 'baixo',     min: 0 },
];

/** Mapeamento de nível para cor hexadecimal */
export const RADAR_CORES: Record<RadarNivel, string> = {
  baixo:  '#059669',   // verde
  medio:  '#F59E0B',   // amarelo
  alto:   '#F97316',   // laranja
  critico:'#DC2626',   // vermelho
};

/** Rótulos legíveis para cada nível */
export const RADAR_LABEL_NIVEL: Record<RadarNivel, string> = {
  baixo:  'Baixo',
  medio:  'Médio',
  alto:   'Alto',
  critico:'Crítico',
};

// ─── INTERFACES DE SAÍDA ───────────────────────────────────────────────

export interface RadarEixoNormalizado {
  eixo: string;           // "Registral"
  codigo: Eixo;           // "REG"
  valor: number;          // 0-100 (normalizado)
  nivel: RadarNivel;
  cor: string;
  labelNivel: string;
}

export interface ISFEixosInput {
  isf_score?: number;
  registral_score?: number;
  dominial_score?: number;
  litigio_score?: number;
  possessorio_score?: number;
  fraude_score?: number;
  [key: string]: unknown;
}

// ─── FUNÇÃO PRINCIPAL (FASE 4) ─────────────────────────────────────────

/**
 * Normaliza os dados do ISF v2 para o formato do radar.
 *
 * @param isfV2 - Objeto findings.isf_v2 (pode ser null/undefined)
 * @returns Array de 5 eixos normalizados, ou null se ISF não existir
 */
export function normalizarRadarISF(isfV2: ISFEixosInput | null | undefined): RadarEixoNormalizado[] | null {
  // Se ISF não existir, retornar null (FASE 6 — mensagem amigável)
  if (!isfV2 || typeof isfV2 !== 'object') {
    return null;
  }

  // Extrair scores dos 5 eixos
  const scores: { codigo: Eixo; label: string; valor: number }[] = [
    { codigo: 'REG', label: 'Registral',   valor: isfV2.registral_score ?? -1 },
    { codigo: 'DOM', label: 'Dominial',    valor: isfV2.dominial_score ?? -1 },
    { codigo: 'LIT', label: 'Litígio',     valor: isfV2.litigio_score ?? -1 },
    { codigo: 'POS', label: 'Possessório', valor: isfV2.possessorio_score ?? -1 },
    { codigo: 'FRA', label: 'Fraude',      valor: isfV2.fraude_score ?? -1 },
  ];

  // Validar se todos os eixos têm valores válidos (0-100)
  const temDadosValidos = scores.every(s => typeof s.valor === 'number' && s.valor >= 0 && s.valor <= 100);

  if (!temDadosValidos) {
    return null;
  }

  // Normalizar cada eixo
  return scores.map(s => {
    const nivel = classificarNivelRadar(s.valor);
    return {
      eixo: s.label,
      codigo: s.codigo,
      valor: s.valor,
      nivel,
      cor: RADAR_CORES[nivel],
      labelNivel: RADAR_LABEL_NIVEL[nivel],
    };
  });
}

/**
 * Classifica um valor numérico (0-100) em um nível de radar.
 */
export function classificarNivelRadar(valor: number): RadarNivel {
  for (const threshold of RADAR_NIVEL_THRESHOLDS) {
    if (valor >= threshold.min) {
      return threshold.nivel;
    }
  }
  return 'baixo';
}

/**
 * Retorna a porcentagem para a barra de progresso do radar.
 * Quanto MAIOR o score, MELHOR (inverte: 100 = seguro = barra cheia).
 * Usado para exibir "100 - valor" como largura da barra de risco.
 */
export function pctBarraRadar(valor: number): number {
  return Math.max(0, Math.min(100, valor));
}

/**
 * Valida se a estrutura do ISF v2 está completa e correta.
 */
export function validarEstruturaISF(isfV2: unknown): isfV2 is ISFEixosInput {
  if (!isfV2 || typeof isfV2 !== 'object') return false;
  const obj = isfV2 as Record<string, unknown>;
  return (
    typeof obj.registral_score === 'number' &&
    typeof obj.dominial_score === 'number' &&
    typeof obj.litigio_score === 'number' &&
    typeof obj.possessorio_score === 'number' &&
    typeof obj.fraude_score === 'number' &&
    (obj.isf_score === undefined || typeof obj.isf_score === 'number')
  );
}