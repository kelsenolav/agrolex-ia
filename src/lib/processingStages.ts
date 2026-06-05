/**
 * FASE 5 — Processamento em Etapas (Anti-Timeout)
 * 
 * Helper centralizado para gerenciamento de processing_stages dentro de findings.case_file.
 * NÃO altera endpoints, UI, dashboard, resultado, schema do banco ou pagamento.
 * 
 * Estrutura persistida em findings.case_file.processing_stages:
 * {
 *   enabled: boolean,
 *   total_stages: number,
 *   stages: Array<{
 *     stage_id: string,
 *     stage_name: string,
 *     status: 'pending' | 'processing' | 'completed' | 'error',
 *     started_at?: string,
 *     completed_at?: string,
 *     summary?: string,
 *     error_message?: string
 *   }>
 * }
 */

export type ProcessingStageStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ProcessingStage {
  stage_id: string;
  stage_name: string;
  status: ProcessingStageStatus;
  started_at?: string;
  completed_at?: string;
  summary?: string;
  error_message?: string;
}

export interface ProcessingStages {
  enabled: boolean;
  total_stages: number;
  stages: ProcessingStage[];
}

// Módulos de auditoria que podem ser processados em etapas
export const STAGE_MODULE_MAP: Record<string, string> = {
  matricula_individual: 'Análise de Matrícula Individual',
  cruzamento_matriculas: 'Cruzamento de Matrículas',
  cadeia_dominial: 'Cadeia Dominial Registral',
  origem_publica: 'Auditoria de Origem Pública / Título Fundiário',
  geoespacial: 'Auditoria Geoespacial',
  nulidades_fraudes: 'Mapeamento de Nulidades e Indícios de Fraude',
  cruzamento_total: 'Cruzamento Total',
};

/**
 * Inicializa a estrutura processing_stages a partir de selected_modules.
 * Cria um stage para cada módulo selecionado, todos com status 'pending'.
 */
export function initializeProcessingStages(selectedModules: string[]): ProcessingStages {
  const stages: ProcessingStage[] = selectedModules.map((moduleId) => ({
    stage_id: moduleId,
    stage_name: STAGE_MODULE_MAP[moduleId] || moduleId,
    status: 'pending' as ProcessingStageStatus,
  }));

  return {
    enabled: stages.length > 0,
    total_stages: stages.length,
    stages,
  };
}

/**
 * Retorna o stage atual (primeiro com status 'pending' ou 'processing').
 * Retorna null se nenhum stage estiver pendente ou em processamento.
 */
export function getCurrentStage(stages: ProcessingStages | null | undefined): ProcessingStage | null {
  if (!stages || !stages.enabled || !Array.isArray(stages.stages)) {
    return null;
  }

  // Prioridade: primeiro 'processing', depois primeiro 'pending'
  const processing = stages.stages.find((s) => s.status === 'processing');
  if (processing) return processing;

  const pending = stages.stages.find((s) => s.status === 'pending');
  if (pending) return pending;

  return null;
}

/**
 * Retorna o próximo stage pendente (primeiro com status 'pending').
 * Retorna null se todos já foram iniciados/concluídos/erro.
 */
export function getNextPendingStage(stages: ProcessingStages | null | undefined): ProcessingStage | null {
  if (!stages || !stages.enabled || !Array.isArray(stages.stages)) {
    return null;
  }

  return stages.stages.find((s) => s.status === 'pending') || null;
}

/**
 * Atualiza um stage para status 'processing' com timestamp started_at.
 * Retorna uma NOVA cópia do array de stages (não muta o original).
 */
export function markStageProcessing(
  stages: ProcessingStages | null | undefined,
  stageId: string,
  now?: string
): ProcessingStage[] {
  if (!stages || !Array.isArray(stages.stages)) {
    return [];
  }

  const timestamp = now || new Date().toISOString();

  return stages.stages.map((stage) => {
    if (stage.stage_id !== stageId) return stage;
    return {
      ...stage,
      status: 'processing' as ProcessingStageStatus,
      started_at: timestamp,
      // Limpa campos de execução anterior se houver
      completed_at: undefined,
      summary: undefined,
      error_message: undefined,
    };
  });
}

/**
 * Atualiza um stage para status 'completed' com timestamp completed_at e summary opcional.
 * Retorna uma NOVA cópia do array de stages (não muta o original).
 */
export function markStageCompleted(
  stages: ProcessingStages | null | undefined,
  stageId: string,
  summary?: string,
  now?: string
): ProcessingStage[] {
  if (!stages || !Array.isArray(stages.stages)) {
    return [];
  }

  const timestamp = now || new Date().toISOString();

  return stages.stages.map((stage) => {
    if (stage.stage_id !== stageId) return stage;
    return {
      ...stage,
      status: 'completed' as ProcessingStageStatus,
      completed_at: timestamp,
      summary: summary || stage.summary || undefined,
      error_message: undefined,
    };
  });
}

/**
 * Atualiza um stage para status 'error' com mensagem de erro.
 * Retorna uma NOVA cópia do array de stages (não muta o original).
 */
export function markStageError(
  stages: ProcessingStages | null | undefined,
  stageId: string,
  errorMessage: string,
  now?: string
): ProcessingStage[] {
  if (!stages || !Array.isArray(stages.stages)) {
    return [];
  }

  const timestamp = now || new Date().toISOString();

  return stages.stages.map((stage) => {
    if (stage.stage_id !== stageId) return stage;
    return {
      ...stage,
      status: 'error' as ProcessingStageStatus,
      completed_at: timestamp,
      error_message: errorMessage,
    };
  });
}

/**
 * Verifica se TODOS os stages foram concluídos (status 'completed').
 */
export function isProcessingFinished(stages: ProcessingStages | null | undefined): boolean {
  if (!stages || !stages.enabled || !Array.isArray(stages.stages) || stages.stages.length === 0) {
    return false;
  }

  return stages.stages.every((s) => s.status === 'completed');
}

/**
 * Verifica se algum stage está com erro.
 * Retorna o primeiro stage com erro, ou null se nenhum.
 */
export function getFirstErrorStage(stages: ProcessingStages | null | undefined): ProcessingStage | null {
  if (!stages || !Array.isArray(stages.stages)) {
    return null;
  }

  return stages.stages.find((s) => s.status === 'error') || null;
}

/**
 * Conta quantos stages estão em cada status.
 */
export function countStagesByStatus(stages: ProcessingStages | null | undefined): Record<ProcessingStageStatus, number> {
  const counts: Record<ProcessingStageStatus, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    error: 0,
  };

  if (!stages || !Array.isArray(stages.stages)) {
    return counts;
  }

  for (const stage of stages.stages) {
    counts[stage.status] = (counts[stage.status] || 0) + 1;
  }

  return counts;
}

/**
 * Mescla processing_stages preservando dados existentes.
 * Se newStages for fornecido, atualiza o array de stages.
 * Se apenas o container for atualizado (ex: enabled, total_stages), mantém os stages existentes.
 */
export function mergeProcessingStages(
  existing: ProcessingStages | null | undefined,
  updates: Partial<ProcessingStages>
): ProcessingStages {
  const base = existing || { enabled: false, total_stages: 0, stages: [] };

  return {
    enabled: updates.enabled !== undefined ? updates.enabled : base.enabled,
    total_stages: updates.total_stages !== undefined ? updates.total_stages : base.total_stages,
    stages: updates.stages !== undefined ? updates.stages : base.stages,
  };
}