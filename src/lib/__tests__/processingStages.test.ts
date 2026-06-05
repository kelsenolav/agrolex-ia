import {
  initializeProcessingStages,
  getCurrentStage,
  getNextPendingStage,
  markStageProcessing,
  markStageCompleted,
  markStageError,
  isProcessingFinished,
  getFirstErrorStage,
  countStagesByStatus,
  mergeProcessingStages,
  STAGE_MODULE_MAP,
  type ProcessingStages,
  type ProcessingStage,
} from '../processingStages';

const FIXED_DATE = '2026-06-05T20:00:00.000Z';

describe('processingStages', () => {
  describe('initializeProcessingStages', () => {
    it('should create stages from selected modules', () => {
      const stages = initializeProcessingStages(['matricula_individual', 'cadeia_dominial']);
      expect(stages.enabled).toBe(true);
      expect(stages.total_stages).toBe(2);
      expect(stages.stages).toHaveLength(2);
      expect(stages.stages[0]).toEqual({
        stage_id: 'matricula_individual',
        stage_name: 'Análise de Matrícula Individual',
        status: 'pending',
      });
      expect(stages.stages[1]).toEqual({
        stage_id: 'cadeia_dominial',
        stage_name: 'Cadeia Dominial Registral',
        status: 'pending',
      });
    });

    it('should handle empty modules array', () => {
      const stages = initializeProcessingStages([]);
      expect(stages.enabled).toBe(false);
      expect(stages.total_stages).toBe(0);
      expect(stages.stages).toEqual([]);
    });

    it('should handle unknown module IDs with fallback name', () => {
      const stages = initializeProcessingStages(['unknown_module']);
      expect(stages.enabled).toBe(true);
      expect(stages.total_stages).toBe(1);
      expect(stages.stages[0].stage_name).toBe('unknown_module');
    });

    it('should create stages for all known modules', () => {
      const allModuleIds = Object.keys(STAGE_MODULE_MAP);
      const stages = initializeProcessingStages(allModuleIds);
      expect(stages.total_stages).toBe(allModuleIds.length);
      for (const stage of stages.stages) {
        expect(stage.status).toBe('pending');
        expect(stage.stage_name).toBeTruthy();
      }
    });

    it('should create stages with cruzamento_total (exclusive module)', () => {
      const stages = initializeProcessingStages(['cruzamento_total']);
      expect(stages.enabled).toBe(true);
      expect(stages.total_stages).toBe(1);
      expect(stages.stages[0]).toEqual({
        stage_id: 'cruzamento_total',
        stage_name: 'Cruzamento Total',
        status: 'pending',
      });
    });
  });

  describe('getCurrentStage', () => {
    it('should return the first processing stage', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 3,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'processing' },
          { stage_id: 'm3', stage_name: 'M3', status: 'pending' },
        ],
      };
      expect(getCurrentStage(stages)).toEqual(stages.stages[1]);
    });

    it('should return the first pending stage if none is processing', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 3,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'completed' },
          { stage_id: 'm3', stage_name: 'M3', status: 'pending' },
        ],
      };
      expect(getCurrentStage(stages)).toEqual(stages.stages[2]);
    });

    it('should return null if all stages are completed', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'completed' },
        ],
      };
      expect(getCurrentStage(stages)).toBeNull();
    });

    it('should return null for null input', () => {
      expect(getCurrentStage(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(getCurrentStage(undefined)).toBeNull();
    });

    it('should return null when disabled', () => {
      const stages: ProcessingStages = {
        enabled: false,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'pending' },
        ],
      };
      expect(getCurrentStage(stages)).toBeNull();
    });

    it('should return null for empty stages array', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 0,
        stages: [],
      };
      expect(getCurrentStage(stages)).toBeNull();
    });

    it('should prioritize processing over pending', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 3,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'pending' },
          { stage_id: 'm2', stage_name: 'M2', status: 'processing' },
          { stage_id: 'm3', stage_name: 'M3', status: 'pending' },
        ],
      };
      expect(getCurrentStage(stages)).toEqual(stages.stages[1]);
    });
  });

  describe('getNextPendingStage', () => {
    it('should return the first pending stage', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 3,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
          { stage_id: 'm3', stage_name: 'M3', status: 'pending' },
        ],
      };
      expect(getNextPendingStage(stages)).toEqual(stages.stages[1]);
    });

    it('should return null if all are completed', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'completed' },
        ],
      };
      expect(getNextPendingStage(stages)).toBeNull();
    });

    it('should return null for null input', () => {
      expect(getNextPendingStage(null)).toBeNull();
    });
  });

  describe('markStageProcessing', () => {
    it('should mark a pending stage as processing with started_at', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'pending' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
        ],
      };
      const updated = markStageProcessing(stages, 'm1', FIXED_DATE);
      expect(updated).toHaveLength(2);
      expect(updated[0].status).toBe('processing');
      expect(updated[0].started_at).toBe(FIXED_DATE);
      expect(updated[0].completed_at).toBeUndefined();
      expect(updated[0].error_message).toBeUndefined();
      expect(updated[1].status).toBe('pending');
    });

    it('should not mutate the original array', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 1,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'pending' },
        ],
      };
      const original = stages.stages[0];
      markStageProcessing(stages, 'm1', FIXED_DATE);
      expect(stages.stages[0].status).toBe('pending');
      expect(original.status).toBe('pending');
    });

    it('should clear previous completion/error data on re-processing', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 1,
        stages: [
          {
            stage_id: 'm1',
            stage_name: 'M1',
            status: 'error',
            completed_at: '2026-01-01',
            error_message: 'Old error',
            summary: 'Old summary',
          },
        ],
      };
      const updated = markStageProcessing(stages, 'm1', FIXED_DATE);
      expect(updated[0].status).toBe('processing');
      expect(updated[0].started_at).toBe(FIXED_DATE);
      expect(updated[0].completed_at).toBeUndefined();
      expect(updated[0].error_message).toBeUndefined();
      expect(updated[0].summary).toBeUndefined();
    });

    it('should return empty array for null stages', () => {
      expect(markStageProcessing(null, 'm1')).toEqual([]);
    });

    it('should not modify non-matching stage IDs', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'pending' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
        ],
      };
      const updated = markStageProcessing(stages, 'non_existent', FIXED_DATE);
      expect(updated[0].status).toBe('pending');
      expect(updated[1].status).toBe('pending');
    });
  });

  describe('markStageCompleted', () => {
    it('should mark a processing stage as completed with timestamp and summary', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 1,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'processing', started_at: FIXED_DATE },
        ],
      };
      const updated = markStageCompleted(stages, 'm1', 'Paracer concluído', FIXED_DATE);
      expect(updated[0].status).toBe('completed');
      expect(updated[0].completed_at).toBe(FIXED_DATE);
      expect(updated[0].summary).toBe('Paracer concluído');
      expect(updated[0].error_message).toBeUndefined();
    });

    it('should preserve existing summary if no new summary provided', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 1,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'processing', summary: 'Existing' },
        ],
      };
      const updated = markStageCompleted(stages, 'm1', undefined, FIXED_DATE);
      expect(updated[0].summary).toBe('Existing');
    });

    it('should clear error_message on completion', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 1,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'processing', error_message: 'Had error' },
        ],
      };
      const updated = markStageCompleted(stages, 'm1');
      expect(updated[0].error_message).toBeUndefined();
    });

    it('should return empty array for null stages', () => {
      expect(markStageCompleted(null, 'm1')).toEqual([]);
    });
  });

  describe('markStageError', () => {
    it('should mark a stage as error with message', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 1,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'processing', started_at: FIXED_DATE },
        ],
      };
      const updated = markStageError(stages, 'm1', 'Timeout excedido', FIXED_DATE);
      expect(updated[0].status).toBe('error');
      expect(updated[0].completed_at).toBe(FIXED_DATE);
      expect(updated[0].error_message).toBe('Timeout excedido');
    });

    it('should return empty array for null stages', () => {
      expect(markStageError(null, 'm1', 'Erro')).toEqual([]);
    });

    it('should not modify non-matching stage IDs', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'processing' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
        ],
      };
      const updated = markStageError(stages, 'm2', 'Erro');
      expect(updated[0].status).toBe('processing');
      expect(updated[1].status).toBe('error');
    });
  });

  describe('isProcessingFinished', () => {
    it('should return true when all stages are completed', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'completed' },
        ],
      };
      expect(isProcessingFinished(stages)).toBe(true);
    });

    it('should return false when any stage is pending', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
        ],
      };
      expect(isProcessingFinished(stages)).toBe(false);
    });

    it('should return false when any stage is in error', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'error', error_message: 'Fail' },
        ],
      };
      expect(isProcessingFinished(stages)).toBe(false);
    });

    it('should return false when any stage is processing', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'processing' },
        ],
      };
      expect(isProcessingFinished(stages)).toBe(false);
    });

    it('should return false for null input', () => {
      expect(isProcessingFinished(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(isProcessingFinished(undefined)).toBe(false);
    });

    it('should return false when disabled', () => {
      const stages: ProcessingStages = {
        enabled: false,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
        ],
      };
      expect(isProcessingFinished(stages)).toBe(false);
    });

    it('should return false for empty stages array', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 0,
        stages: [],
      };
      expect(isProcessingFinished(stages)).toBe(false);
    });
  });

  describe('getFirstErrorStage', () => {
    it('should return the first stage with error status', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 3,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'error', error_message: 'Fail 1' },
          { stage_id: 'm3', stage_name: 'M3', status: 'error', error_message: 'Fail 2' },
        ],
      };
      expect(getFirstErrorStage(stages)).toEqual(stages.stages[1]);
    });

    it('should return null if no errors', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'completed' },
        ],
      };
      expect(getFirstErrorStage(stages)).toBeNull();
    });

    it('should return null for null input', () => {
      expect(getFirstErrorStage(null)).toBeNull();
    });
  });

  describe('countStagesByStatus', () => {
    it('should count stages by status correctly', () => {
      const stages: ProcessingStages = {
        enabled: true,
        total_stages: 5,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'pending' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
          { stage_id: 'm3', stage_name: 'M3', status: 'processing' },
          { stage_id: 'm4', stage_name: 'M4', status: 'completed' },
          { stage_id: 'm5', stage_name: 'M5', status: 'error', error_message: 'Fail' },
        ],
      };
      const counts = countStagesByStatus(stages);
      expect(counts).toEqual({
        pending: 2,
        processing: 1,
        completed: 1,
        error: 1,
      });
    });

    it('should return all zeros for null input', () => {
      const counts = countStagesByStatus(null);
      expect(counts).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        error: 0,
      });
    });

    it('should return all zeros for empty stages', () => {
      const counts = countStagesByStatus({ enabled: true, total_stages: 0, stages: [] });
      expect(counts).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        error: 0,
      });
    });
  });

  describe('mergeProcessingStages', () => {
    it('should merge updates into existing stages', () => {
      const existing: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
        ],
      };
      const merged = mergeProcessingStages(existing, { enabled: false });
      expect(merged.enabled).toBe(false);
      expect(merged.total_stages).toBe(2);
      expect(merged.stages).toEqual(existing.stages);
    });

    it('should replace stages when provided', () => {
      const existing: ProcessingStages = {
        enabled: true,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'pending' },
        ],
      };
      const newStages = [{ stage_id: 'm2', stage_name: 'M2', status: 'completed' as const }];
      const merged = mergeProcessingStages(existing, { stages: newStages, total_stages: 1 });
      expect(merged.stages).toEqual(newStages);
      expect(merged.total_stages).toBe(1);
    });

    it('should create default structure from null', () => {
      const merged = mergeProcessingStages(null, { enabled: true, total_stages: 1 });
      expect(merged.enabled).toBe(true);
      expect(merged.total_stages).toBe(1);
      expect(merged.stages).toEqual([]);
    });

    it('should create default structure from undefined', () => {
      const merged = mergeProcessingStages(undefined, {});
      expect(merged.enabled).toBe(false);
      expect(merged.total_stages).toBe(0);
      expect(merged.stages).toEqual([]);
    });

    it('should preserve stages when only enabled is updated', () => {
      const existing: ProcessingStages = {
        enabled: false,
        total_stages: 2,
        stages: [
          { stage_id: 'm1', stage_name: 'M1', status: 'completed' },
          { stage_id: 'm2', stage_name: 'M2', status: 'pending' },
        ],
      };
      const merged = mergeProcessingStages(existing, { enabled: true });
      expect(merged.enabled).toBe(true);
      expect(merged.total_stages).toBe(2);
      expect(merged.stages).toHaveLength(2);
      expect(merged.stages).toEqual(existing.stages);
    });
  });

  describe('end-to-end workflow', () => {
    it('should simulate a complete processing flow', () => {
      let stages = initializeProcessingStages(['matricula_individual', 'cadeia_dominial']);
      expect(stages.total_stages).toBe(2);
      expect(getCurrentStage(stages)!.stage_id).toBe('matricula_individual');
      expect(isProcessingFinished(stages)).toBe(false);

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'matricula_individual', FIXED_DATE),
      };
      expect(getCurrentStage(stages)!.status).toBe('processing');

      stages = {
        ...stages,
        stages: markStageCompleted(stages, 'matricula_individual', 'OK', FIXED_DATE),
      };
      expect(stages.stages[0].status).toBe('completed');
      expect(isProcessingFinished(stages)).toBe(false);

      const next = getNextPendingStage(stages);
      expect(next!.stage_id).toBe('cadeia_dominial');

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'cadeia_dominial', FIXED_DATE),
      };

      stages = {
        ...stages,
        stages: markStageCompleted(stages, 'cadeia_dominial', 'OK 2', FIXED_DATE),
      };

      expect(isProcessingFinished(stages)).toBe(true);
      expect(getCurrentStage(stages)).toBeNull();
      expect(getNextPendingStage(stages)).toBeNull();
    });

    it('should handle stage error and continue', () => {
      let stages = initializeProcessingStages(['matricula_individual', 'cadeia_dominial', 'nulidades_fraudes']);

      stages = { ...stages, stages: markStageProcessing(stages, 'matricula_individual', FIXED_DATE) };
      stages = { ...stages, stages: markStageCompleted(stages, 'matricula_individual', 'OK', FIXED_DATE) };

      stages = { ...stages, stages: markStageProcessing(stages, 'cadeia_dominial', FIXED_DATE) };
      stages = { ...stages, stages: markStageError(stages, 'cadeia_dominial', 'Timeout', FIXED_DATE) };

      expect(getFirstErrorStage(stages)!.stage_id).toBe('cadeia_dominial');
      expect(isProcessingFinished(stages)).toBe(false);

      const next = getNextPendingStage(stages);
      expect(next!.stage_id).toBe('nulidades_fraudes');

      const counts = countStagesByStatus(stages);
      expect(counts.completed).toBe(1);
      expect(counts.error).toBe(1);
      expect(counts.pending).toBe(1);
      expect(counts.processing).toBe(0);
    });

    it('should handle empty stages at every step', () => {
      const stages = initializeProcessingStages([]);
      expect(stages.enabled).toBe(false);
      expect(getCurrentStage(stages)).toBeNull();
      expect(getNextPendingStage(stages)).toBeNull();
      expect(isProcessingFinished(stages)).toBe(false);
      expect(getFirstErrorStage(stages)).toBeNull();
      const counts = countStagesByStatus(stages);
      expect(counts.pending + counts.processing + counts.completed + counts.error).toBe(0);
    });
  });

  describe('FASE 5 — BLOCO 2: Integration flow (API simulation)', () => {
    const NOW = '2026-06-05T20:00:00.000Z';

    it('F5-INT-01: etapa 1 concluída — volta para ready_for_processing', () => {
      const modulesToProcess = ['matricula_individual', 'cadeia_dominial', 'riscos_nulidades'];
      let stages = initializeProcessingStages(modulesToProcess);
      expect(stages.enabled).toBe(true);
      expect(stages.total_stages).toBe(3);

      const currentStage = getCurrentStage(stages);
      expect(currentStage).not.toBeNull();
      expect(currentStage!.stage_id).toBe('matricula_individual');

      stages = {
        ...stages,
        stages: markStageProcessing(stages, currentStage!.stage_id, NOW),
      };
      expect(stages.stages[0].status).toBe('processing');

      const effectiveModules = modulesToProcess.filter((m) => m === currentStage!.stage_id);
      expect(effectiveModules).toEqual(['matricula_individual']);

      stages = {
        ...stages,
        stages: markStageCompleted(stages, currentStage!.stage_id, 'Matrícula analisada com sucesso', NOW),
      };

      const allCompleted = isProcessingFinished(stages);
      const hasMoreStages = !allCompleted && getCurrentStage(stages) !== null;
      expect(allCompleted).toBe(false);
      expect(hasMoreStages).toBe(true);

      const nextStage = getCurrentStage(stages);
      expect(nextStage).not.toBeNull();
      expect(nextStage!.stage_id).toBe('cadeia_dominial');
      expect(nextStage!.status).toBe('pending');

      const counts = countStagesByStatus(stages);
      expect(counts.completed).toBe(1);
      expect(counts.pending).toBe(2);
    });

    it('F5-INT-02: retomada etapa 2 — processa segunda etapa após primeira concluída', () => {
      let stages = initializeProcessingStages(['matricula_individual', 'cadeia_dominial', 'riscos_nulidades']);

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'matricula_individual', NOW),
      };
      stages = {
        ...stages,
        stages: markStageCompleted(stages, 'matricula_individual', 'OK', NOW),
      };

      const currentStage = getCurrentStage(stages);
      expect(currentStage).not.toBeNull();
      expect(currentStage!.stage_id).toBe('cadeia_dominial');

      const modulesToProcess = ['matricula_individual', 'cadeia_dominial', 'riscos_nulidades'];
      const effectiveModules = modulesToProcess.filter((m) => m === currentStage!.stage_id);
      expect(effectiveModules).toEqual(['cadeia_dominial']);

      stages = {
        ...stages,
        stages: markStageProcessing(stages, currentStage!.stage_id, '2026-06-05T20:05:00.000Z'),
      };
      expect(stages.stages[1].status).toBe('processing');

      stages = {
        ...stages,
        stages: markStageCompleted(stages, 'cadeia_dominial', 'Cadeia dominial analisada', '2026-06-05T20:06:00.000Z'),
      };

      const counts = countStagesByStatus(stages);
      expect(counts.completed).toBe(2);
      expect(counts.pending).toBe(1);
      expect(isProcessingFinished(stages)).toBe(false);

      const nextStage = getCurrentStage(stages);
      expect(nextStage!.stage_id).toBe('riscos_nulidades');
    });

    it('F5-INT-03: erro preservando etapa anterior — markStageError não afeta etapas já concluídas', () => {
      let stages = initializeProcessingStages(['matricula_individual', 'cadeia_dominial', 'riscos_nulidades']);

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'matricula_individual', NOW),
      };
      stages = {
        ...stages,
        stages: markStageCompleted(stages, 'matricula_individual', 'Análise completa', NOW),
      };

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'cadeia_dominial', '2026-06-05T20:10:00.000Z'),
      };

      stages = {
        ...stages,
        stages: markStageError(stages, 'cadeia_dominial', 'Timeout excedido na análise da cadeia dominial', '2026-06-05T20:11:00.000Z'),
      };

      expect(stages.stages[0].status).toBe('completed');
      expect(stages.stages[0].summary).toBe('Análise completa');
      expect(stages.stages[0].error_message).toBeUndefined();

      expect(stages.stages[1].status).toBe('error');
      expect(stages.stages[1].error_message).toBe('Timeout excedido na análise da cadeia dominial');

      expect(stages.stages[2].status).toBe('pending');

      const counts = countStagesByStatus(stages);
      expect(counts.completed).toBe(1);
      expect(counts.error).toBe(1);
      expect(counts.pending).toBe(1);
      expect(counts.processing).toBe(0);

      expect(isProcessingFinished(stages)).toBe(false);

      const errorStage = getFirstErrorStage(stages);
      expect(errorStage).not.toBeNull();
      expect(errorStage!.stage_id).toBe('cadeia_dominial');
    });

    it('F5-INT-04: conclusão total — todas as etapas completadas marcam isProcessingFinished=true', () => {
      const allModules = ['matricula_individual', 'cadeia_dominial', 'riscos_nulidades', 'parecer_consolidado'];
      let stages = initializeProcessingStages(allModules);

      const timestamps = [
        '2026-06-05T20:00:00.000Z',
        '2026-06-05T20:05:00.000Z',
        '2026-06-05T20:10:00.000Z',
        '2026-06-05T20:15:00.000Z',
      ];

      for (let i = 0; i < allModules.length; i++) {
        const stageId = allModules[i];
        const currentStage = getCurrentStage(stages);
        expect(currentStage!.stage_id).toBe(stageId);

        stages = {
          ...stages,
          stages: markStageProcessing(stages, stageId, timestamps[i]),
        };
        expect(stages.stages[i].status).toBe('processing');

        stages = {
          ...stages,
          stages: markStageCompleted(stages, stageId, `Concluído: ${stageId}`, timestamps[i]),
        };
        expect(stages.stages[i].status).toBe('completed');
      }

      expect(isProcessingFinished(stages)).toBe(true);
      expect(getCurrentStage(stages)).toBeNull();

      const counts = countStagesByStatus(stages);
      expect(counts.completed).toBe(4);
      expect(counts.pending).toBe(0);
      expect(counts.processing).toBe(0);
      expect(counts.error).toBe(0);

      for (const stage of stages.stages) {
        expect(stage.completed_at).toBeTruthy();
        expect(stage.summary).toBeTruthy();
        expect(stage.error_message).toBeUndefined();
      }
    });

    it('F5-INT-05: fluxo de retry — etapa com erro é re-processada com sucesso', () => {
      let stages = initializeProcessingStages(['matricula_individual', 'cadeia_dominial']);

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'matricula_individual', NOW),
      };
      stages = {
        ...stages,
        stages: markStageCompleted(stages, 'matricula_individual', 'OK', NOW),
      };

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'cadeia_dominial', '2026-06-05T20:10:00.000Z'),
      };
      stages = {
        ...stages,
        stages: markStageError(stages, 'cadeia_dominial', 'Timeout', '2026-06-05T20:11:00.000Z'),
      };

      expect(stages.stages[1].status).toBe('error');
      expect(getCurrentStage(stages)).toBeNull();

      stages = {
        ...stages,
        stages: markStageProcessing(stages, 'cadeia_dominial', '2026-06-05T20:20:00.000Z'),
      };

      expect(stages.stages[1].status).toBe('processing');
      expect(stages.stages[1].error_message).toBeUndefined();
      expect(stages.stages[1].started_at).toBe('2026-06-05T20:20:00.000Z');
      expect(stages.stages[1].completed_at).toBeUndefined();

      stages = {
        ...stages,
        stages: markStageCompleted(stages, 'cadeia_dominial', 'Sucesso após retry', '2026-06-05T20:22:00.000Z'),
      };

      expect(stages.stages[1].status).toBe('completed');
      expect(stages.stages[1].summary).toBe('Sucesso após retry');
      expect(isProcessingFinished(stages)).toBe(true);
    });
  });
});