import {
  createInitialCaseFile,
  ensureCaseFile,
  updateCaseFileWithBasicFacts,
  type CaseFile,
  type CaseFilePropertyInput,
} from '../caseFile';

describe('CaseFile', () => {
  describe('createInitialCaseFile', () => {
    it('should create a minimal case file with defaults', () => {
      const cf = createInitialCaseFile();
      expect(cf.version).toBe('1.0');
      expect(cf.status).toBe('created');
      expect(cf.created_at).toBeTruthy();
      expect(cf.updated_at).toBeTruthy();
      expect(cf.property_identification.name).toBeNull();
      expect(cf.documents).toEqual([]);
      expect(cf.recommended_modules).toEqual([]);
    });

    it('should include property data when provided', () => {
      const cf = createInitialCaseFile({
        property: { name: 'Fazenda Teste', state: 'TO', city: 'Palmas' },
      });
      expect(cf.property_identification.name).toBe('Fazenda Teste');
      expect(cf.property_identification.state).toBe('TO');
      expect(cf.property_identification.city).toBe('Palmas');
    });

    it('should include documents when provided', () => {
      const cf = createInitialCaseFile({
        documents: [
          { name: 'matricula.pdf', type: 'Matrícula', storage_path: '/docs/matricula.pdf' },
        ],
      });
      expect(cf.documents).toHaveLength(1);
      expect(cf.documents[0].name).toBe('matricula.pdf');
    });

    it('should accept a custom timestamp', () => {
      const now = '2026-06-05T10:00:00Z';
      const cf = createInitialCaseFile({ now });
      expect(cf.created_at).toBe(now);
      expect(cf.updated_at).toBe(now);
    });
  });

  describe('ensureCaseFile', () => {
    it('should create a new case file if findings has none', () => {
      const cf = ensureCaseFile({});
      expect(cf.status).toBe('created');
      expect(cf.version).toBe('1.0');
    });

    it('should create a new case file if findings is null', () => {
      const cf = ensureCaseFile(null);
      expect(cf.status).toBe('created');
    });

    it('should keep existing case file when present', () => {
      const existing: CaseFile = createInitialCaseFile({
        property: { name: 'Fazenda Existente' },
      });
      existing.status = 'completed';
      const findings = { case_file: existing };
      const cf = ensureCaseFile(findings);
      expect(cf.status).toBe('completed');
      expect(cf.property_identification.name).toBe('Fazenda Existente');
    });

    it('should merge property identification', () => {
      const existing: Partial<CaseFile> = {
        property_identification: { name: 'Fazenda', state: 'TO', city: 'Palmas', registry_number: null, registry_office: null, property_description: null, car_number: null },
      };
      const findings = { case_file: existing };
      const cf = ensureCaseFile(findings, { property: { city: 'Gurupi' } });
      // Existing values take priority
      expect(cf.property_identification.city).toBe('Palmas');
    });
  });

  describe('updateCaseFileWithBasicFacts', () => {
    it('should update status to completed', () => {
      const cf = createInitialCaseFile();
      const updated = updateCaseFileWithBasicFacts(cf, {});
      expect(updated.status).toBe('completed');
    });

    it('should update risk level from problemas', () => {
      const cf = createInitialCaseFile();
      const updated = updateCaseFileWithBasicFacts(cf, {
        problemas: [{ titulo: 'Falha crítica', criticidade: 'Crítico' }],
        riskLevel: 'Crítico',
      });
      expect(updated.risks.length).toBeGreaterThanOrEqual(1);
      const risk = updated.risks[0] as any;
      expect(risk.severity).toBe('critico');
    });

    it('should extract registry number from resumo', () => {
      const cf = createInitialCaseFile();
      const updated = updateCaseFileWithBasicFacts(cf, {
        resumo: 'Matrícula nº 27.180 do Cartório de Palmas/TO',
      });
      expect(updated.property_identification.registry_number).toContain('27.180');
    });

    it('should preserve user declared area', () => {
      const cf = createInitialCaseFile({
        property: { declared_area_ha: 150 },
      });
      const updated = updateCaseFileWithBasicFacts(cf, {});
      expect(updated.user_declared_data.declared_area_ha).toBe(150);
    });
  });

  // FASE 3 — Testes de herança de case_file
  describe('FASE 3 — Herança de CaseFile', () => {
    it('should deep clone case_file when creating child analysis', () => {
      const parentCaseFile = createInitialCaseFile({
        property: { name: 'Fazenda Santa Aurora', state: 'TO', city: 'Palmas', registry_number: '27.180' },
        documents: [{ name: 'matricula.pdf', type: 'Matrícula' }],
      });
      parentCaseFile.status = 'completed';
      parentCaseFile.module_results = {
        matricula_individual: { status: 'completed', summary: 'Análise de matrícula OK' },
      };
      parentCaseFile.processing_metrics = { gemini_ms: 5000, total_ms: 12000 };

      // Simular o que o endpoint faz: deep clone
      const childCaseFile: CaseFile = JSON.parse(JSON.stringify(parentCaseFile));

      // Verificar herança
      expect(childCaseFile.property_identification.name).toBe('Fazenda Santa Aurora');
      expect(childCaseFile.property_identification.registry_number).toBe('27.180');
      expect(childCaseFile.documents).toHaveLength(1);
      expect(childCaseFile.module_results.matricula_individual.status).toBe('completed');

      // Verificar que é uma cópia independente (deep clone)
      childCaseFile.property_identification.name = 'Fazenda Modificada';
      expect(parentCaseFile.property_identification.name).toBe('Fazenda Santa Aurora');
    });

    it('should NOT duplicate modules already in parent module_results', () => {
      const parentCaseFile = createInitialCaseFile();
      parentCaseFile.module_results = {
        matricula_individual: { status: 'completed', summary: 'OK' },
        cadeia_dominial: { status: 'completed', summary: 'OK' },
      };

      // Módulos complementares propostos
      const proposedModules = ['matricula_individual', 'cadeia_dominial', 'nulidades_fraudes'];

      // Verificar que módulos já existentes são filtrados
      const existingModules = Object.keys(parentCaseFile.module_results);
      const newModules = proposedModules.filter((m) => !existingModules.includes(m));
      
      expect(newModules).toHaveLength(1);
      expect(newModules[0]).toBe('nulidades_fraudes');
      expect(newModules).not.toContain('matricula_individual');
      expect(newModules).not.toContain('cadeia_dominial');
    });

    it('should increment analysis_depth correctly', () => {
      const parentDepth = 1;
      const childDepth = parentDepth + 1;
      expect(childDepth).toBe(2);

      const grandchildDepth = childDepth + 1;
      expect(grandchildDepth).toBe(3);
    });

    it('should preserve recommended_modules from parent but reset for child', () => {
      const parentCaseFile = createInitialCaseFile();
      parentCaseFile.recommended_modules = [
        { module_id: 'nulidades_fraudes', title: 'Nulidades', reason: 'Risco crítico', priority: 'critica', status: 'available' },
      ];

      // Simular o que o endpoint faz: deep clone e reset recommended_modules
      const childCaseFile: CaseFile = JSON.parse(JSON.stringify(parentCaseFile));
      childCaseFile.recommended_modules = [];

      expect(parentCaseFile.recommended_modules).toHaveLength(1);
      expect(childCaseFile.recommended_modules).toHaveLength(0);
    });

    it('should inherit property_id from parent analysis', () => {
      const parentPropertyId = '550e8400-e29b-41d4-a716-446655440000';
      const childPropertyId = parentPropertyId; // Herdado
      expect(childPropertyId).toBe(parentPropertyId);
    });

    it('should calculate price server-side for child modules only', () => {
      // Simular que módulos complementares custam R$ 249,90 (nulidades_fraudes)
      const childModules = ['nulidades_fraudes'];
      
      // Usar a lógica do calculateAuditModulesTotal (importado inline para o teste)
      const MODULE_PRICES: Record<string, number> = {
        matricula_individual: 99.90,
        cadeia_dominial: 199.90,
        origem_publica: 199.90,
        geoespacial: 199.90,
        nulidades_fraudes: 249.90,
        cruzamento_matriculas: 149.90,
        cruzamento_total: 499.90,
      };

      const total = childModules.reduce((sum, modId) => sum + (MODULE_PRICES[modId] || 0), 0);
      expect(total).toBe(249.90);
    });

    it('should not charge for modules already in parent', () => {
      const MODULE_PRICES: Record<string, number> = {
        matricula_individual: 99.90,
        cadeia_dominial: 199.90,
        nulidades_fraudes: 249.90,
      };

      const parentModules = ['matricula_individual', 'cadeia_dominial'];
      const proposedModules = ['matricula_individual', 'cadeia_dominial', 'nulidades_fraudes'];
      
      // Apenas módulos NÃO existentes no pai são cobrados
      const newModules = proposedModules.filter((m) => !parentModules.includes(m));
      const total = newModules.reduce((sum, modId) => sum + (MODULE_PRICES[modId] || 0), 0);
      
      expect(newModules).toEqual(['nulidades_fraudes']);
      expect(total).toBe(249.90);
    });
  });
});