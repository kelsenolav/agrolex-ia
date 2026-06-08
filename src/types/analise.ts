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
  isf_version?: number;
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
 */
export type ScoreFaixa = 'critico' | 'atencao' | 'seguro';

export interface ScoreAgroLexData {
  score: number;
  faixa: ScoreFaixa;
  label: string;
  cor: string;
  bgCor: string;
  acaoSugerida: string;
}

export function calcularScoreAgroLex(findings?: AnalysisFindings | null, riskLevel?: string | null): ScoreAgroLexData {
  // Regra simples baseada em riscos existentes
  let score = 70; // base neutra

  if (!findings) {
    return {
      score,
      faixa: 'seguro',
      label: 'Seguro',
      cor: '#059669',
      bgCor: 'bg-emerald-500',
      acaoSugerida: 'Propriedade dentro dos padrões fundiários',
    };
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

  if (score < 40) {
    return {
      score,
      faixa: 'critico',
      label: 'Crítico',
      cor: '#DC2626',
      bgCor: 'bg-red-500',
      acaoSugerida: 'Requer auditoria complementar urgente',
    };
  }
  if (score < 70) {
    return {
      score,
      faixa: 'atencao',
      label: 'Atenção',
      cor: '#F59E0B',
      bgCor: 'bg-amber-500',
      acaoSugerida: 'Recomenda-se monitoramento contínuo',
    };
  }
  return {
    score,
    faixa: 'seguro',
    label: 'Seguro',
    cor: '#059669',
    bgCor: 'bg-emerald-500',
    acaoSugerida: 'Propriedade dentro dos padrões fundiários',
  };
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