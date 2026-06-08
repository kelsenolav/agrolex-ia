import { getPlan, getPlanPermissions, listPlans, PLANS, PlanType, EXTRA_PACKS } from '../plans';

describe('plans.ts — Planos comerciais', () => {
  describe('PLANS', () => {
    it('deve conter trial, starter, profissional, business e enterprise', () => {
      expect(PLANS).toHaveProperty('trial');
      expect(PLANS).toHaveProperty('starter');
      expect(PLANS).toHaveProperty('profissional');
      expect(PLANS).toHaveProperty('business');
      expect(PLANS).toHaveProperty('enterprise');
    });

    it('trial deve ter maxAnalyses = 10', () => {
      expect(PLANS.trial.permissions.maxAnalyses).toBe(10);
    });

    it('starter deve ter maxAnalyses = 150', () => {
      expect(PLANS.starter.permissions.maxAnalyses).toBe(150);
    });

    it('profissional deve ter maxAnalyses = 1000', () => {
      expect(PLANS.profissional.permissions.maxAnalyses).toBe(1000);
    });

    it('business deve ter maxAnalyses = 5000', () => {
      expect(PLANS.business.permissions.maxAnalyses).toBe(5000);
    });

    it('trial não pode usar complementary analysis', () => {
      expect(PLANS.trial.permissions.canUseComplementaryAnalysis).toBe(false);
    });

    it('profissional pode usar complementary analysis', () => {
      expect(PLANS.profissional.permissions.canUseComplementaryAnalysis).toBe(true);
    });

    it('trial não pode usar premium modules', () => {
      expect(PLANS.trial.permissions.canUsePremiumModules).toBe(false);
    });

    it('starter não pode usar premium modules', () => {
      expect(PLANS.starter.permissions.canUsePremiumModules).toBe(false);
    });

    it('profissional pode usar premium modules', () => {
      expect(PLANS.profissional.permissions.canUsePremiumModules).toBe(true);
    });

    it('business pode usar premium modules', () => {
      expect(PLANS.business.permissions.canUsePremiumModules).toBe(true);
    });

    it('trial não pode exportar PDF no novo modelo de paginas', () => {
      expect(PLANS.trial.permissions.canExportPdf).toBe(false);
    });

    it('trial pode acessar relatório completo', () => {
      expect(PLANS.trial.permissions.canAccessFullReport).toBe(true);
    });
  });

  describe('getPlan()', () => {
    it('deve retornar trial para plan_type undefined', () => {
      const plan = getPlan(undefined);
      expect(plan.id).toBe('trial');
    });

    it('deve retornar trial para plan_type null', () => {
      const plan = getPlan(null);
      expect(plan.id).toBe('trial');
    });

    it('deve retornar trial para plan_type inválido', () => {
      const plan = getPlan('inexistente');
      expect(plan.id).toBe('trial');
    });

    it('deve retornar starter para plan_type "starter"', () => {
      const plan = getPlan('starter');
      expect(plan.id).toBe('starter');
    });

    it('deve retornar profissional para plan_type "profissional"', () => {
      const plan = getPlan('profissional');
      expect(plan.id).toBe('profissional');
    });

    it('deve retornar business para plan_type "business"', () => {
      const plan = getPlan('business');
      expect(plan.id).toBe('business');
    });
  });

  describe('getPlanPermissions()', () => {
    it('deve retornar permissões de trial para undefined', () => {
      const perms = getPlanPermissions(undefined);
      expect(perms.maxAnalyses).toBe(10);
    });

    it('deve retornar permissões de profissional', () => {
      const perms = getPlanPermissions('profissional');
      expect(perms.canUsePremiumModules).toBe(true);
      expect(perms.canUseComplementaryAnalysis).toBe(true);
    });
  });

  describe('listPlans()', () => {
    it('deve retornar 5 planos', () => {
      const plans = listPlans();
      expect(plans).toHaveLength(5);
    });

    it('deve incluir trial, starter, profissional, business, enterprise', () => {
      const ids = listPlans().map((p) => p.id);
      expect(ids).toContain('trial');
      expect(ids).toContain('starter');
      expect(ids).toContain('profissional');
      expect(ids).toContain('business');
      expect(ids).toContain('enterprise');
    });
  });

  describe('EXTRA_PACKS', () => {
    it('deve conter 3 pacotes avulsos', () => {
      expect(EXTRA_PACKS).toHaveLength(3);
      expect(EXTRA_PACKS[0].id).toBe('extra_100_pages');
      expect(EXTRA_PACKS[1].id).toBe('extra_500_pages');
      expect(EXTRA_PACKS[2].id).toBe('extra_1000_pages');
    });
  });
});