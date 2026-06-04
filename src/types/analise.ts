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