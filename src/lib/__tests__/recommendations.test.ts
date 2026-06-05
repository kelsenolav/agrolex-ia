import {
  buildRecommendedModules,
  countRecommendations,
  getRecommendedModuleIds,
  type BuildRecommendedModulesInput,
} from '../recommendations';
import { buildDocumentProfile } from '../auditModules';
import type { CaseFile, CaseFileRecommendedModule } from '../caseFile';

function makeEmptyCaseFile(): CaseFile {
  return {
    version: "1.0",
    status: "created",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    property_identification: {
      name: null, state: null, city: null, registry_number: null,
      registry_office: null, property_description: null, car_number: null
    },
    user_declared_data: { declared_area_ha: null, owner_name: null, owner_document: null },
    documents: [],
    extracted_text: { summary: null, chunks: [] },
    registry_acts: [], parties: [], areas: [], title_origin: {},
    encumbrances: [], lawsuits: [], environmental_flags: [], chain_summary: {},
    missing_documents: [], risks: [], module_results: {},
    recommended_modules: [], report_composition: {},
    processing_metrics: {}, retry_state: {}
  };
}

function completedCaseFile(overrides: Partial<CaseFile> = {}): CaseFile {
  return { ...makeEmptyCaseFile(), status: "completed", ...overrides };
}

function emptyDocProfile() {
  return buildDocumentProfile([]);
}

describe('recommendations', () => {
  describe('buildRecommendedModules', () => {
    it('should return empty array when caseFile is null/undefined', () => {
      expect(buildRecommendedModules({ caseFile: null, docProfile: emptyDocProfile(), selectedModules: [] }).length).toBe(0);
      expect(buildRecommendedModules({ caseFile: undefined, docProfile: emptyDocProfile(), selectedModules: [] }).length).toBe(0);
    });

    it('should return empty array when caseFile status is created (not completed)', () => {
      const result = buildRecommendedModules({
        caseFile: makeEmptyCaseFile(),
        docProfile: emptyDocProfile(),
        selectedModules: []
      });
      expect(result.length).toBe(0);
    });

    it('should return empty array when cruzamento_total is selected (exclusive)', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile({ risks: [{ title: 'Critico', severity: 'critico' }] }),
        docProfile: buildDocumentProfile([{ name: 'm.pdf', type: 'Outro' }]),
        selectedModules: ['cruzamento_total']
      });
      expect(result.length).toBe(0);
    });

    it('should recommend nulidades_fraudes when critical risk is detected', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile({ risks: [{ title: 'Grilagem', description: 'Teste', severity: 'critico' }] }),
        docProfile: emptyDocProfile(),
        selectedModules: []
      });
      expect(result.some(r => r.module_id === 'nulidades_fraudes')).toBe(true);
      expect(result[0].priority).toBe('critica');
      expect(result[0].price).toBe(249.90);
    });

    it('should recommend cruzamento_matriculas when multiple matriculas', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile(),
        docProfile: buildDocumentProfile([
          { name: 'm1.pdf', type: 'Matrícula' }, { name: 'm2.pdf', type: 'Matrícula' }
        ]),
        selectedModules: []
      });
      expect(result.some(r => r.module_id === 'cruzamento_matriculas')).toBe(true);
      expect(result.find(r => r.module_id === 'cruzamento_matriculas')?.price).toBe(149.90);
    });

    it('should recommend geoespacial when CAR is present but not selected', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile(),
        docProfile: buildDocumentProfile([{ name: 'CAR.pdf', type: 'CAR' }]),
        selectedModules: []
      });
      expect(result.some(r => r.module_id === 'geoespacial')).toBe(true);
      expect(result.find(r => r.module_id === 'geoespacial')?.price).toBe(199.90);
    });

    it('should NOT recommend geoespacial when already selected', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile(),
        docProfile: buildDocumentProfile([{ name: 'CAR.pdf', type: 'CAR' }]),
        selectedModules: ['geoespacial']
      });
      expect(result.some(r => r.module_id === 'geoespacial')).toBe(false);
    });

    it('should recommend origem_publica when title_origin is empty', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile(),
        docProfile: emptyDocProfile(),
        selectedModules: []
      });
      expect(result.some(r => r.module_id === 'origem_publica')).toBe(true);
      expect(result.find(r => r.module_id === 'origem_publica')?.price).toBe(199.90);
    });

    it('should NOT recommend origem_publica when already selected', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile(),
        docProfile: emptyDocProfile(),
        selectedModules: ['origem_publica']
      });
      expect(result.some(r => r.module_id === 'origem_publica')).toBe(false);
    });

    it('should recommend cadeia_dominial when missing documents mention cadeia', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile({ missing_documents: [{ description: 'Certidão de cadeia dominial', source: 'report', status: 'missing' }] }),
        docProfile: emptyDocProfile(),
        selectedModules: []
      });
      expect(result.some(r => r.module_id === 'cadeia_dominial')).toBe(true);
      expect(result.find(r => r.module_id === 'cadeia_dominial')?.price).toBe(199.90);
    });

    it('should recommend cadeia_dominial when missing doc string mentions cartorio', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile({ missing_documents: ['Certidão de inteiro teor do cartório'] }),
        docProfile: emptyDocProfile(),
        selectedModules: []
      });
      expect(result.some(r => r.module_id === 'cadeia_dominial')).toBe(true);
    });

    it('should not duplicate module_id', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile({
          risks: [{ title: 'Critico', severity: 'critico' }],
          missing_documents: [{ description: 'Cadeia dominial', source: 'report', status: 'missing' }]
        }),
        docProfile: buildDocumentProfile([
          { name: 'm1.pdf', type: 'Matrícula' }, { name: 'm2.pdf', type: 'Matrícula' }, { name: 'CAR.pdf', type: 'CAR' }
        ]),
        selectedModules: []
      });
      const ids = result.map(r => r.module_id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should respect max 5 recommendations', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile({
          risks: [{ title: 'Critico1', severity: 'critico' }, { title: 'Critico2', severity: 'critico' }],
          missing_documents: [{ description: 'Cadeia dominial', source: 'report', status: 'missing' }]
        }),
        docProfile: buildDocumentProfile([
          { name: 'm1.pdf', type: 'Matrícula' }, { name: 'm2.pdf', type: 'Matrícula' }, { name: 'CAR.pdf', type: 'CAR' }
        ]),
        selectedModules: []
      });
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should sort by priority (critica first)', () => {
      const result = buildRecommendedModules({
        caseFile: completedCaseFile({ risks: [{ title: 'Critico', severity: 'critico' }] }),
        docProfile: buildDocumentProfile([
          { name: 'm1.pdf', type: 'Matrícula' }, { name: 'm2.pdf', type: 'Matrícula' }, { name: 'CAR.pdf', type: 'CAR' }
        ]),
        selectedModules: []
      });
      if (result.length >= 2) {
        expect(result[0].priority).toBe('critica');
      }
    });
  });

  describe('countRecommendations', () => {
    it('should return 0 for null/undefined', () => {
      expect(countRecommendations(null)).toBe(0);
      expect(countRecommendations(undefined)).toBe(0);
    });

    it('should return correct count', () => {
      expect(countRecommendations([{ module_id: 'a', title: 'A', reason: 'Test' }] as any)).toBe(1);
    });
  });

  describe('getRecommendedModuleIds', () => {
    it('should extract module IDs', () => {
      const recs = [{ module_id: 'nulidades_fraudes', title: 'Nulidades', reason: 'Test' } as any];
      expect(getRecommendedModuleIds(recs)).toEqual(['nulidades_fraudes']);
    });

    it('should return empty for null', () => {
      expect(getRecommendedModuleIds(null)).toEqual([]);
    });
  });
});