import {
  AUDIT_MODULES,
  MODULE_PRICES,
  calculateAuditModulesTotal,
  normalizeModuleId,
  getModulePrice,
  buildDocumentProfile,
  getModuleCompatibility,
} from '../auditModules';

describe('auditModules', () => {
  describe('AUDIT_MODULES', () => {
    it('should have 7 modules defined', () => {
      expect(AUDIT_MODULES.length).toBe(7);
    });

    it('each module should have id, name, price, and description', () => {
      for (const mod of AUDIT_MODULES) {
        expect(typeof mod.id).toBe('string');
        expect(mod.id.length).toBeGreaterThan(0);
        expect(typeof mod.name).toBe('string');
        expect(mod.name.length).toBeGreaterThan(0);
        expect(typeof mod.price).toBe('number');
        expect(mod.price).toBeGreaterThan(0);
        expect(typeof mod.description).toBe('string');
        expect(mod.description.length).toBeGreaterThan(10);
      }
    });

    it('should have cruzamento_total as the master module', () => {
      const cruzamento = AUDIT_MODULES.find(m => m.id === 'cruzamento_total');
      expect(cruzamento).toBeDefined();
      expect(cruzamento!.price).toBe(499.90);
    });
  });

  describe('MODULE_PRICES', () => {
    it('should match AUDIT_MODULES prices', () => {
      for (const mod of AUDIT_MODULES) {
        expect(MODULE_PRICES[mod.id]).toBe(mod.price);
      }
    });

    it('should have matricula_individual at R$ 99,90', () => {
      expect(MODULE_PRICES['matricula_individual']).toBe(99.90);
    });

    it('should have cruzamento_total at R$ 499,90', () => {
      expect(MODULE_PRICES['cruzamento_total']).toBe(499.90);
    });
  });

  describe('calculateAuditModulesTotal', () => {
    it('should return 0 for empty array', () => {
      expect(calculateAuditModulesTotal([])).toBe(0);
    });

    it('should calculate single module correctly', () => {
      expect(calculateAuditModulesTotal(['matricula_individual'])).toBe(99.90);
    });

    it('should sum multiple individual modules', () => {
      const total = calculateAuditModulesTotal([
        'matricula_individual',
        'cadeia_dominial',
        'origem_publica',
        'nulidades_fraudes',
      ]);
      expect(total).toBe(99.90 + 199.90 + 199.90 + 249.90);
    });

    it('should return 499.90 when cruzamento_total is selected (exclusive)', () => {
      expect(calculateAuditModulesTotal(['cruzamento_total'])).toBe(499.90);
    });

    it('should return 499.90 even if cruzamento_total is mixed with others', () => {
      const total = calculateAuditModulesTotal([
        'cruzamento_total',
        'matricula_individual',
      ]);
      expect(total).toBe(499.90);
    });

    it('should ignore unknown modules (price = 0)', () => {
      const total = calculateAuditModulesTotal(['unknown_module']);
      expect(total).toBe(0);
    });
  });

  describe('normalizeModuleId', () => {
    it('should return known module IDs as-is', () => {
      expect(normalizeModuleId('matricula_individual')).toBe('matricula_individual');
    });

    it('should map legacy IDs to new IDs', () => {
      expect(normalizeModuleId('titulos_incra')).toBe('origem_publica');
      expect(normalizeModuleId('registros')).toBe('cadeia_dominial');
      expect(normalizeModuleId('nulidades')).toBe('nulidades_fraudes');
      expect(normalizeModuleId('forense')).toBe('nulidades_fraudes');
      expect(normalizeModuleId('cruzamento')).toBe('cruzamento_total');
    });
  });

  describe('getModulePrice', () => {
    it('should return correct price for known module', () => {
      expect(getModulePrice('matricula_individual')).toBe(99.90);
    });

    it('should return price for legacy module', () => {
      expect(getModulePrice('registros')).toBe(149.90);
      expect(getModulePrice('titulos_incra')).toBe(99.90);
      expect(getModulePrice('nulidades')).toBe(249.90);
      expect(getModulePrice('forense')).toBe(299.90);
      expect(getModulePrice('cruzamento')).toBe(499.90);
    });

    it('should return 0 for unknown module', () => {
      expect(getModulePrice('nonexistent')).toBe(0);
    });
  });

  describe('buildDocumentProfile', () => {
    it('should detect matricula', () => {
      const profile = buildDocumentProfile([
        { name: 'matricula_001.pdf', type: 'Matrícula' },
      ]);
      expect(profile.hasMatricula).toBe(true);
      expect(profile.hasMultipleMatriculas).toBe(false);
      expect(profile.totalMatriculas).toBe(1);
    });

    it('should detect multiple matriculas', () => {
      const profile = buildDocumentProfile([
        { name: 'matricula_001.pdf', type: 'Matrícula' },
        { name: 'matricula_002.pdf', type: 'Matrícula' },
      ]);
      expect(profile.hasMultipleMatriculas).toBe(true);
      expect(profile.totalMatriculas).toBe(2);
    });

    it('should detect CAR', () => {
      const profile = buildDocumentProfile([
        { name: 'CAR_fazenda.pdf', type: 'Outro' },
      ]);
      expect(profile.hasCar).toBe(true);
    });

    it('should detect SIGEF', () => {
      const profile = buildDocumentProfile([
        { name: 'sigef_certificado.pdf', type: 'SIGEF' },
      ]);
      expect(profile.hasSigef).toBe(true);
    });

    it('should return zero profile for empty files', () => {
      const profile = buildDocumentProfile([]);
      expect(profile.totalDocuments).toBe(0);
      expect(profile.hasMatricula).toBe(false);
      expect(profile.hasCar).toBe(false);
    });
  });

  describe('getModuleCompatibility', () => {
    it('should disable all modules when no documents', () => {
      const profile = buildDocumentProfile([]);
      const result = getModuleCompatibility('matricula_individual', profile);
      expect(result.enabled).toBe(false);
    });

    it('should enable matricula_individual when matricula is present', () => {
      const profile = buildDocumentProfile([
        { name: 'matricula.pdf', type: 'Matrícula' },
      ]);
      const result = getModuleCompatibility('matricula_individual', profile);
      expect(result.enabled).toBe(true);
    });

    it('should require 2+ matriculas for cruzamento_matriculas', () => {
      const profile1 = buildDocumentProfile([
        { name: 'matricula.pdf', type: 'Matrícula' },
      ]);
      expect(getModuleCompatibility('cruzamento_matriculas', profile1).enabled).toBe(false);

      const profile2 = buildDocumentProfile([
        { name: 'matricula1.pdf', type: 'Matrícula' },
        { name: 'matricula2.pdf', type: 'Matrícula' },
      ]);
      expect(getModuleCompatibility('cruzamento_matriculas', profile2).enabled).toBe(true);
    });

    it('should require geospatial document for geoespacial module', () => {
      const profile = buildDocumentProfile([
        { name: 'matricula.pdf', type: 'Matrícula' },
      ]);
      expect(getModuleCompatibility('geoespacial', profile).enabled).toBe(false);

      const profileGeo = buildDocumentProfile([
        { name: 'CAR.pdf', type: 'CAR' },
      ]);
      expect(getModuleCompatibility('geoespacial', profileGeo).enabled).toBe(true);
    });

    it('should require 2+ documents for cruzamento_total', () => {
      const profile1 = buildDocumentProfile([
        { name: 'matricula.pdf', type: 'Matrícula' },
      ]);
      expect(getModuleCompatibility('cruzamento_total', profile1).enabled).toBe(false);

      const profile2 = buildDocumentProfile([
        { name: 'matricula.pdf', type: 'Matrícula' },
        { name: 'titulo.pdf', type: 'Título INCRA' },
      ]);
      expect(getModuleCompatibility('cruzamento_total', profile2).enabled).toBe(true);
    });
  });
});