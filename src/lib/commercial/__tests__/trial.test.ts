import {
  hasUsedTrial,
  canStartTrialAnalysis,
  getTrialBlockReason,
  getTrialLimits,
  getCommercialAccess,
  TrialProfile,
} from '../trial';

describe('trial.ts — Helpers de trial', () => {
  describe('hasUsedTrial()', () => {
    it('deve retornar true quando trial_used = true', () => {
      expect(hasUsedTrial({ trial_used: true })).toBe(true);
    });

    it('deve retornar false quando trial_used = false', () => {
      expect(hasUsedTrial({ trial_used: false })).toBe(false);
    });

    it('deve retornar false quando trial_used = undefined', () => {
      expect(hasUsedTrial({})).toBe(false);
    });

    it('deve retornar false quando trial_used = null', () => {
      expect(hasUsedTrial({ trial_used: null })).toBe(false);
    });
  });

  describe('canStartTrialAnalysis()', () => {
    it('deve permitir quando profile está vazio (undefined fields)', () => {
      expect(canStartTrialAnalysis({})).toBe(true);
    });

    it('deve permitir quando subscription_status = "trial" e trial_used = false', () => {
      const profile: TrialProfile = {
        subscription_status: 'trial',
        trial_used: false,
      };
      expect(canStartTrialAnalysis(profile)).toBe(true);
    });

    it('deve bloquear quando trial_used = true', () => {
      const profile: TrialProfile = { trial_used: true };
      expect(canStartTrialAnalysis(profile)).toBe(false);
    });

    it('deve bloquear quando subscription_status não é trial', () => {
      const profile: TrialProfile = {
        subscription_status: 'active',
        trial_used: false,
      };
      expect(canStartTrialAnalysis(profile)).toBe(false);
    });

    it('deve bloquear quando trial_ends_at já passou', () => {
      const profile: TrialProfile = {
        trial_used: false,
        trial_ends_at: '2024-01-01T00:00:00Z', // data passada
      };
      expect(canStartTrialAnalysis(profile)).toBe(false);
    });

    it('deve permitir quando trial_ends_at é futuro', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      const profile: TrialProfile = {
        trial_used: false,
        trial_ends_at: future.toISOString(),
      };
      expect(canStartTrialAnalysis(profile)).toBe(true);
    });
  });

  describe('getTrialBlockReason()', () => {
    it('deve retornar null quando profile vazio', () => {
      expect(getTrialBlockReason({})).toBeNull();
    });

    it('deve retornar motivo quando trial_used = true', () => {
      const reason = getTrialBlockReason({ trial_used: true });
      expect(reason).toContain('já utilizou');
    });

    it('deve retornar motivo quando subscription_status = "active"', () => {
      const reason = getTrialBlockReason({
        subscription_status: 'active',
        trial_used: false,
      });
      expect(reason).toContain('encerrado');
    });

    it('deve retornar motivo quando trial expirou', () => {
      const reason = getTrialBlockReason({
        trial_used: false,
        trial_ends_at: '2024-01-01T00:00:00Z',
      });
      expect(reason).toContain('expirou');
    });
  });

  describe('getTrialLimits()', () => {
    it('deve retornar maxAnalyses = 10 para trial', () => {
      const limits = getTrialLimits({});
      expect(limits.maxAnalyses).toBe(10);
    });

    it('deve retornar canStartNewAnalysis = true para profile vazio', () => {
      const limits = getTrialLimits({});
      expect(limits.canStartNewAnalysis).toBe(true);
    });

    it('deve retornar canStartNewAnalysis = false quando trial usado', () => {
      const limits = getTrialLimits({ trial_used: true });
      expect(limits.canStartNewAnalysis).toBe(false);
    });

    it('deve retornar trialDays = 7', () => {
      const limits = getTrialLimits({});
      expect(limits.trialDays).toBe(7);
    });

    it('deve retornar blockReason = null para profile vazio', () => {
      const limits = getTrialLimits({});
      expect(limits.blockReason).toBeNull();
    });

    it('deve retornar blockReason preenchido quando trial usado', () => {
      const limits = getTrialLimits({ trial_used: true });
      expect(limits.blockReason).not.toBeNull();
    });
  });

  describe('getCommercialAccess()', () => {
    it('deve retornar planType = trial para profile vazio', () => {
      const access = getCommercialAccess({});
      expect(access.planType).toBe('trial');
    });

    it('deve retornar planType do profile', () => {
      const access = getCommercialAccess({ plan_type: 'profissional' });
      expect(access.planType).toBe('profissional');
    });

    it('deve retornar canStartAnalysis = true para profile vazio', () => {
      const access = getCommercialAccess({});
      expect(access.canStartAnalysis).toBe(true);
    });

    it('deve retornar canStartAnalysis = false quando trial usado', () => {
      const access = getCommercialAccess({ trial_used: true });
      expect(access.canStartAnalysis).toBe(false);
    });

    it('deve retornar blockReason = null para profile vazio', () => {
      const access = getCommercialAccess({});
      expect(access.blockReason).toBeNull();
    });
  });
});