/**
 * ISF Taxonomy — Fonte Única de Verdade para classificação, cores, labels e estilos
 *
 * Versão: 1.0
 * Escopo: Dashboard, Laudo, PDF, Filtros
 * Regra: Nenhuma tela pode possuir cores/labels/faixas hardcoded
 *
 * Taxonomia Oficial:
 *   critico:       0–39  | vermelho    | Severidade 5
 *   alto_risco:   40–59  | laranja     | Severidade 4
 *   atencao:      60–79  | amarelo     | Severidade 3
 *   seguro:       80–89  | verde       | Severidade 2
 *   muito_seguro: 90–100 | verde forte | Severidade 1
 */

// ─── KEY TYPE ────────────────────────────────────────────────────────────

export type ISFLevel = 'critico' | 'alto_risco' | 'atencao' | 'seguro' | 'muito_seguro';

export type RiskLevel =
  | 'CRITICO'
  | 'ALTO_RISCO'
  | 'ATENCAO'
  | 'SEGURO'
  | 'MUITO_SEGURO';

/**
 * Função central de classificação de risco fundiário.
 * Fonte única de verdade para derivar nível de risco a partir do score numérico.
 *
 * Regras de negócio:
 *   0-39   → CRITICO
 *   40-59  → ALTO_RISCO
 *   60-79  → ATENCAO
 *   80-89  → SEGURO
 *   90-100 → MUITO_SEGURO
 */
export function classifyFundiaryRisk(score: number): RiskLevel {
  if (!Number.isFinite(score)) return 'CRITICO';
  if (score <= 39) return 'CRITICO';
  if (score <= 59) return 'ALTO_RISCO';
  if (score <= 79) return 'ATENCAO';
  if (score <= 89) return 'SEGURO';
  return 'MUITO_SEGURO';
}

// ─── TAXONOMY ENTRY ──────────────────────────────────────────────────────

export interface ISFTaxonomyEntry {
  label: string;
  severity: number;
  min: number;
  max: number;
  hex: string;
  uiClass: string;           // Tailwind classes for badge/background/text
  pdfClass: string;          // Class for PDF output (globals.css @media print)
  description: string;
}

// ─── TAXONOMY MAP ────────────────────────────────────────────────────────

export const ISF_TAXONOMY: Record<ISFLevel, ISFTaxonomyEntry> = {
  critico: {
    label: 'Crítico',
    severity: 5,
    min: 0,
    max: 39,
    hex: '#DC2626',
    uiClass: 'bg-red-50 text-red-700 border-red-200',
    pdfClass: 'isf-critico',
    description: 'Risco crítico — requer auditoria complementar urgente',
  },
  alto_risco: {
    label: 'Alto risco',
    severity: 4,
    min: 40,
    max: 59,
    hex: '#F97316',
    uiClass: 'bg-orange-50 text-orange-700 border-orange-200',
    pdfClass: 'isf-alto-risco',
    description: 'Alto risco — atenção prioritária',
  },
  atencao: {
    label: 'Atenção',
    severity: 3,
    min: 60,
    max: 79,
    hex: '#F59E0B',
    uiClass: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    pdfClass: 'isf-atencao',
    description: 'Atenção recomendada',
  },
  seguro: {
    label: 'Seguro',
    severity: 2,
    min: 80,
    max: 89,
    hex: '#059669',
    uiClass: 'bg-green-50 text-green-700 border-green-200',
    pdfClass: 'isf-seguro',
    description: 'Baixo risco — documentação adequada',
  },
  muito_seguro: {
    label: 'Muito seguro',
    severity: 1,
    min: 90,
    max: 100,
    hex: '#10B981',
    uiClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pdfClass: 'isf-muito-seguro',
    description: 'Excelente segurança fundiária',
  },
};

// ─── FALLBACK ────────────────────────────────────────────────────────────

export const ISF_FALLBACK: ISFTaxonomyEntry = {
  label: 'Indefinido',
  severity: 0,
  min: 0,
  max: 0,
  hex: '#94A3B8',
  uiClass: 'bg-slate-50 text-slate-700 border-slate-200',
  pdfClass: 'isf-indefinido',
  description: 'Sem classificação de risco',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────

/**
 * Normaliza um nível de risco textual para o formato oficial da taxonomy.
 * Aceita: 'critico', 'alto', 'alto_risco', 'medio', 'médio', 'baixo',
 *         'seguro', 'muito_seguro', 'atencao', etc.
 */
export function normalizeISFLevel(level: string | null | undefined): ISFLevel | null {
  if (!level) return null;

  const raw = level.trim();

  // Mapeamento direto (case-sensitive, acentos)
  const exactMap: Record<string, ISFLevel> = {
    'Crítico': 'critico',
    'Critico': 'critico',
    'Alto Risco': 'alto_risco',
    'Alto risco': 'alto_risco',
    'Atenção': 'atencao',
    'Atencao': 'atencao',
    'Seguro': 'seguro',
    'Muito Seguro': 'muito_seguro',
    'Muito seguro': 'muito_seguro',
  };
  if (exactMap[raw]) return exactMap[raw];

  // Normalizado (NFD, lowercase, sem underscore)
  const lvl = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '_')
    .trim();

  const map: Record<string, ISFLevel> = {
    critico: 'critico',
    alto_risco: 'alto_risco',
    atencao: 'atencao',
    seguro: 'seguro',
    muito_seguro: 'muito_seguro',
  };

  if (map[lvl]) return map[lvl];

  // Mapeamento de alias legados
  if (lvl === 'alto') return 'alto_risco';
  if (lvl === 'medio' || lvl === 'médio') return 'atencao';
  if (lvl === 'baixo') return 'seguro';
  if (lvl === 'muito_baixo') return 'muito_seguro';

  return null;
}

/**
 * Retorna a entrada completa da taxonomy para um nível de risco.
 * Fallback para ISF_FALLBACK se nível não reconhecido.
 */
export function getISFTaxonomy(level: string | null | undefined): ISFTaxonomyEntry {
  const normalized = normalizeISFLevel(level);
  if (normalized && ISF_TAXONOMY[normalized]) {
    return ISF_TAXONOMY[normalized];
  }
  return ISF_FALLBACK;
}

/**
 * Retorna as classes Tailwind UI para o badge de risco.
 */
export function getISFStyle(level: string | null | undefined): string {
  return getISFTaxonomy(level).uiClass;
}

/**
 * Retorna o label legível do nível de risco.
 */
export function getISFLabel(level: string | null | undefined): string {
  return getISFTaxonomy(level).label;
}

/**
 * Retorna a cor hexadecimal do nível de risco.
 */
export function getISFHex(level: string | null | undefined): string {
  return getISFTaxonomy(level).hex;
}

/**
 * Retorna a classe CSS para PDF.
 */
export function getISFPDFClass(level: string | null | undefined): string {
  return getISFTaxonomy(level).pdfClass;
}

/**
 * Retorna a descrição do nível de risco.
 */
export function getISFDescription(level: string | null | undefined): string {
  return getISFTaxonomy(level).description;
}

/**
 * Classifica um score numérico (0-100) em um nível ISF.
 */
export function classifyISFScore(score: number): ISFLevel {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  for (const level of ['critico', 'alto_risco', 'atencao', 'seguro', 'muito_seguro'] as ISFLevel[]) {
    const entry = ISF_TAXONOMY[level];
    if (clampedScore >= entry.min && clampedScore <= entry.max) {
      return level;
    }
  }

  // Fallback
  if (clampedScore >= 91) return 'muito_seguro';
  if (clampedScore >= 76) return 'seguro';
  if (clampedScore >= 51) return 'atencao';
  if (clampedScore >= 26) return 'alto_risco';
  return 'critico';
}

/**
 * Lista todos os níveis ordenados por severidade (crescente).
 */
export const ISF_LEVELS_ORDERED: ISFLevel[] = [
  'muito_seguro',
  'seguro',
  'atencao',
  'alto_risco',
  'critico',
];

/**
 * Retorna a cor de fundo sem opacidade para tooltip/kpi (ex: bg-red-100, bg-green-100).
 */
export function getISFBgTint(level: string | null | undefined): string {
  const entry = getISFTaxonomy(level);
  switch (entry.severity) {
    case 5: return 'bg-red-100';
    case 4: return 'bg-orange-100';
    case 3: return 'bg-yellow-100';
    case 2: return 'bg-green-100';
    case 1: return 'bg-emerald-100';
    default: return 'bg-slate-100';
  }
}

/**
 * Retorna a cor de texto para tooltip/kpi (ex: text-red-600).
 */
export function getISFTextTint(level: string | null | undefined): string {
  const entry = getISFTaxonomy(level);
  switch (entry.severity) {
    case 5: return 'text-red-600';
    case 4: return 'text-orange-600';
    case 3: return 'text-yellow-600';
    case 2: return 'text-green-600';
    case 1: return 'text-emerald-600';
    default: return 'text-slate-600';
  }
}