/**
 * Tipos compartilhados para o módulo de análise fundiária do AgroLex.
 * Define o contrato entre backend (findings jsonb) e frontend.
 */

export interface ReportProblem {
  titulo: string;
  descricao: string;
  criticidade?: string;
  baseDocumental?: string;
  documentoNecessario?: string;
  recomendacao?: string;
}

export interface TimelineEvent {
  data: string;
  evento: string;
  detalhe: string;
}

export interface ChecklistItem {
  quesito: string;
  status: string;
  justificativa: string;
}

export interface AnalysisFindings {
  resumo: string;
  isHtmlResumo?: boolean;
  problemas?: ReportProblem[];
  documentosFaltantes?: string[];
  recomendacoes?: string[];
  linhaDoTempo?: TimelineEvent[];
  checklist?: ChecklistItem[];
  pecaJuridica?: string;
  retry_exhausted?: boolean;
  retry_available?: boolean;
  technical_error_type?: string;
  retry_reason?: string;
  current_step?: string;
  userMessage?: string;
  estimated_total?: number;
  client_estimated_total?: number;
  price_source?: string;
  price_checked_at?: string;
  selected_modules?: string[];
  parent_analysis_id?: string;
  analysis_depth?: number;
  complementary_modules?: string[];
  parent_findings_summary?: {
    completed_at: string | null;
    risk_level: string | null;
    original_modules: string[];
  };
  complementary_children?: ComplementaryChild[];
  case_file?: any;
  matricula_rules?: import('@/lib/isf/matriculaRules').MatriculaRulesResult;
}

export interface ComplementaryChild {
  child_analysis_id: string;
  created_at: string;
  modules: string[];
  total: number;
}

export interface AnalysisProperty {
  id: string;
  name: string;
  city: string;
  state: string;
  risk_score?: number;
}

export interface AnalysisDocument {
  document_type?: string;
  file_path?: string;
}

export interface Analysis {
  id: string;
  status: string;
  risk_level?: string;
  findings: AnalysisFindings;
  properties?: AnalysisProperty;
  documents?: AnalysisDocument[];
  created_at?: string;
  user_id?: string;
  isf_score?: number;
  isf_version?: number | string;
  isf_faixa?: string;
  isf_eixos?: any;
  isf_explainer?: any;
  isf_achados?: any;
}

export type AnalysisStatusType = 'pending' | 'ready_for_processing' | 'processing' | 'completed' | 'error';

export interface NormalizedStatus {
  text: string;
  colorClass: string;
  type: AnalysisStatusType;
}

export function normalizeStatus(rawStatus: string): NormalizedStatus {
  const s = rawStatus.toLowerCase().trim();

  if (s === 'pending' || s === 'payment_pending') {
    return { text: 'Pendente', colorClass: 'bg-amber-100 text-amber-700', type: 'pending' };
  }
  if (s === 'ready_for_processing') {
    return { text: 'Liberada', colorClass: 'bg-purple-100 text-purple-700', type: 'ready_for_processing' };
  }
  if (s === 'processing' || s === 'analisando') {
    return { text: 'Analisando', colorClass: 'bg-blue-100 text-blue-700 animate-pulse', type: 'processing' };
  }
  if (s === 'completed' || s === 'done' || s === 'concluido') {
    return { text: 'Concluído', colorClass: 'bg-green-100 text-green-700', type: 'completed' };
  }
  if (s === 'error' || s === 'failed') {
    return { text: 'Falha', colorClass: 'bg-red-100 text-red-700', type: 'error' };
  }

  return { text: 'Pendente', colorClass: 'bg-gray-100 text-gray-700', type: 'pending' };
}

/**
 * Score AgroLex — Índice de Segurança Fundiária
 *
 * Fonte única de verdade para classificação de risco derivada do score numérico.
 * Suporta duas versões de taxonomia:
 *
 * v2.1 (legado — usado para análises com isf_version 1 ou 2):
 *   0-39   → CRÍTICO
 *   40-59  → ALTO RISCO
 *   60-79  → ATENÇÃO
 *   80-89  → SEGURO
 *   90-100 → MUITO SEGURO
 *
 * v2.2 (metodologia 6 dimensões — isf_version '2.2'):
 *   0-24   → INVÁLIDO
 *   25-39  → CRÍTICO
 *   40-54  → ALTO RISCO
 *   55-69  → ATENÇÃO
 *   70-84  → REGULAR
 *   85-100 → SEGURO
 */
export type ScoreFaixa = 'critico' | 'alto_risco' | 'atencao' | 'seguro' | 'muito_seguro' | 'invalido' | 'regular';

export interface ScoreAgroLexData {
  score: number;
  faixa: ScoreFaixa;
  label: string;
  cor: string;
  bgCor: string;
  acaoSugerida: string;
}

/**
 * Classificação v2.1 (legado — motor isfEngine.ts).
 * Mantém Muito Seguro.
 */
function buildScoreAgroLexDataV2_1(score: number): ScoreAgroLexData {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  if (clampedScore <= 39) {
    return {
      score: clampedScore,
      faixa: 'critico',
      label: 'Crítico',
      cor: '#DC2626',
      bgCor: 'bg-red-500',
      acaoSugerida: 'Requer auditoria complementar urgente',
    };
  }
  if (clampedScore <= 59) {
    return {
      score: clampedScore,
      faixa: 'alto_risco',
      label: 'Alto Risco',
      cor: '#F97316',
      bgCor: 'bg-orange-500',
      acaoSugerida: 'Recomenda-se ação prioritária de regularização',
    };
  }
  if (clampedScore <= 79) {
    return {
      score: clampedScore,
      faixa: 'atencao',
      label: 'Atenção',
      cor: '#F59E0B',
      bgCor: 'bg-amber-500',
      acaoSugerida: 'Recomenda-se monitoramento contínuo',
    };
  }
  if (clampedScore <= 89) {
    return {
      score: clampedScore,
      faixa: 'seguro',
      label: 'Seguro',
      cor: '#059669',
      bgCor: 'bg-emerald-500',
      acaoSugerida: 'Propriedade com documentação adequada',
    };
  }
  return {
    score: clampedScore,
    faixa: 'muito_seguro',
    label: 'Muito Seguro',
    cor: '#10B981',
    bgCor: 'bg-emerald-500',
    acaoSugerida: 'Propriedade dentro dos padrões fundiários',
  };
}

/**
 * Classificação v2.2 (metodologia 6 dimensões — isfEngineV2_2.ts).
 * SEM 'Muito Seguro'. Com 'Inválido' e 'Regular'.
 */
export function buildScoreAgroLexDataV2_2(score: number): ScoreAgroLexData {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  if (clampedScore <= 24) {
    return {
      score: clampedScore,
      faixa: 'invalido',
      label: 'Inválido',
      cor: '#A32D2D',
      bgCor: 'bg-red-700',
      acaoSugerida: 'Título presumivelmente nulo. Não negociar.',
    };
  }
  if (clampedScore <= 39) {
    return {
      score: clampedScore,
      faixa: 'critico',
      label: 'Crítico',
      cor: '#DC2626',
      bgCor: 'bg-red-500',
      acaoSugerida: 'Título gravemente comprometido. Análise judicial completa necessária.',
    };
  }
  if (clampedScore <= 54) {
    return {
      score: clampedScore,
      faixa: 'alto_risco',
      label: 'Alto Risco',
      cor: '#BA7517',
      bgCor: 'bg-orange-500',
      acaoSugerida: 'Título contestável. Regularização urgente recomendada.',
    };
  }
  if (clampedScore <= 69) {
    return {
      score: clampedScore,
      faixa: 'atencao',
      label: 'Atenção',
      cor: '#EF9F27',
      bgCor: 'bg-amber-500',
      acaoSugerida: 'Vulnerabilidades identificadas. Exige regularização prévia.',
    };
  }
  if (clampedScore <= 84) {
    return {
      score: clampedScore,
      faixa: 'regular',
      label: 'Regular',
      cor: '#639922',
      bgCor: 'bg-emerald-600',
      acaoSugerida: 'Título razoável. Due diligence complementar recomendada.',
    };
  }
  return {
    score: clampedScore,
    faixa: 'seguro',
    label: 'Seguro',
    cor: '#1D9E75',
    bgCor: 'bg-emerald-500',
    acaoSugerida: 'Título sólido. Apto para garantia e investimento.',
  };
}

/** Alias para compatibilidade: buildScoreAgroLexData chama v2.1 */
function buildScoreAgroLexData(score: number): ScoreAgroLexData {
  return buildScoreAgroLexDataV2_1(score);
}

/**
 * Calcula o Score AgroLex a partir dos findings e risk_level.
 *
 * @param isfVersion - Versão do motor ISF usada na persistência ('2.1', '2.2', 1, 2, etc.).
 *   Se '2.2', usa a taxonomia v2.2 (6 dimensões, sem Muito Seguro, com Inválido/Regular).
 *   Caso contrário, usa a taxonomia legada v2.1.
 * @param overriddenScore - Se fornecido, usa este valor como score e deriva a classificação dele.
 *   Isso garante que a UI use o score do ISF como fonte única de verdade.
 */
export function calcularScoreAgroLex(
  findings?: AnalysisFindings | null,
  riskLevel?: string | null,
  overriddenScore?: number | null,
  isfVersion?: number | string | null,
): ScoreAgroLexData {
  // Se temos um score override (ex: ISF v2 calculado no backend), usa direto
  if (overriddenScore !== null && overriddenScore !== undefined && Number.isFinite(overriddenScore)) {
    const version = String(isfVersion ?? '');
    if (version === '2.2' || version.startsWith('2.2')) {
      return buildScoreAgroLexDataV2_2(overriddenScore);
    }
    return buildScoreAgroLexDataV2_1(overriddenScore);
  }

  // Fallback: cálculo legado baseado nos findings
  let score = 70; // base neutra

  if (!findings) {
    return buildScoreAgroLexDataV2_1(score);
  }

  const problemas = findings.problemas || [];
  const docsFaltantes = findings.documentosFaltantes || [];
  const recomendacoes = findings.recomendacoes || [];
  const checklist = (findings as any)?.checklist || [];

  // Penalidades
  const criticos = problemas.filter(p => {
    const c = (p.criticidade || '').toLowerCase();
    return c.includes('critico') || c.includes('crítico');
  }).length;
  const altos = problemas.filter(p => {
    const c = (p.criticidade || '').toLowerCase();
    return c.includes('alto') && !c.includes('critico') && !c.includes('crítico');
  }).length;
  const medios = problemas.filter(p => {
    const c = (p.criticidade || '').toLowerCase();
    return c.includes('medio') || c.includes('médio');
  }).length;

  // Checklist reprovado/violado
  const reprovados = checklist.filter((i: any) =>
    (i.status || '').toLowerCase().includes('reprovado') || (i.status || '').toLowerCase().includes('violado')
  ).length;

  score -= criticos * 12;
  score -= altos * 6;
  score -= medios * 3;
  score -= docsFaltantes.length * 2;
  score -= reprovados * 5;

  // Bônus por recomendações (indica completude)
  score += Math.min(recomendacoes.length, 5) * 2;

  // Risk level do banco
  if (riskLevel) {
    const rl = riskLevel.toLowerCase();
    if (rl === 'alto') score -= 10;
    else if (rl === 'medio' || rl === 'médio') score -= 5;
    else if (rl === 'baixo') score += 5;
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  return buildScoreAgroLexDataV2_1(score);
}

/**
 * Mapa de nomes de módulos (ID → nome legível)
 */
export const MODULE_NAMES: Record<string, string> = {
  matricula_individual: 'Matrícula Individual',
  cruzamento_matriculas: 'Cruzamento de Matrículas',
  cadeia_dominial: 'Cadeia Dominial',
  origem_publica: 'Origem Pública (INCRA)',
  geoespacial: 'Geoespacial (SIGEF/CAR)',
  nulidades_fraudes: 'Nulidades e Fraudes',
  cruzamento_total: 'Cruzamento Total',
};
