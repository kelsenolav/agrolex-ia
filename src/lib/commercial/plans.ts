/**
 * plans.ts — Planos comerciais do AgroLex
 *
 * Definição centralizada de planos, limites e permissões.
 */

export type PlanType = 'trial' | 'starter' | 'profissional' | 'business' | 'enterprise' | 'internal_test';

export interface PlanPermissions {
  maxAnalyses: number;
  canExportPdf: boolean;
  canUseComplementaryAnalysis: boolean;
  canAccessFullReport: boolean;
  canUsePremiumModules: boolean;
}

export interface Plan {
  id: PlanType;
  label: string;
  description: string;
  price: number | null;
  permissions: PlanPermissions;
}

export const PLANS: Record<PlanType, Plan> = {
  trial: {
    id: 'trial',
    label: 'Trial Gratuito',
    description: 'Análise introdutória gratuita',
    price: null,
    permissions: {
      maxAnalyses: 10, // 10 páginas
      canExportPdf: false,
      canUseComplementaryAnalysis: false,
      canAccessFullReport: true,
      canUsePremiumModules: false,
    },
  },
  starter: {
    id: 'starter',
    label: 'Start',
    description: 'Para profissionais que iniciam na auditoria fundiária',
    price: 149.9,
    permissions: {
      maxAnalyses: 150, // 150 páginas
      canExportPdf: true,
      canUseComplementaryAnalysis: false,
      canAccessFullReport: true,
      canUsePremiumModules: false,
    },
  },
  profissional: {
    id: 'profissional',
    label: 'Profissional',
    description: 'Para advogados e consultores fundiários',
    price: 399.9,
    permissions: {
      maxAnalyses: 1000, // 1.000 páginas
      canExportPdf: true,
      canUseComplementaryAnalysis: true,
      canAccessFullReport: true,
      canUsePremiumModules: true,
    },
  },
  business: {
    id: 'business',
    label: 'Business',
    description: 'Para escritórios e equipes multidisciplinares',
    price: 999.9,
    permissions: {
      maxAnalyses: 5000, // 5.000 páginas
      canExportPdf: true,
      canUseComplementaryAnalysis: true,
      canAccessFullReport: true,
      canUsePremiumModules: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    description: 'Para grandes corporações e demandas customizadas',
    price: null,
    permissions: {
      maxAnalyses: 999999, // valor interno alto
      canExportPdf: true,
      canUseComplementaryAnalysis: true,
      canAccessFullReport: true,
      canUsePremiumModules: true,
    },
  },
  internal_test: {
    id: 'internal_test',
    label: 'Plano Interno de Testes',
    description: 'Acesso interno liberado',
    price: null,
    permissions: {
      maxAnalyses: 999999,
      canExportPdf: true,
      canUseComplementaryAnalysis: true,
      canAccessFullReport: true,
      canUsePremiumModules: true,
    },
  },
};

export interface ExtraPack {
  id: string;
  label: string;
  pages: number;
  price: number;
}

export const EXTRA_PACKS: ExtraPack[] = [
  { id: 'extra_100_pages', label: 'Pacote 100 Páginas', pages: 100, price: 49.9 },
  { id: 'extra_500_pages', label: 'Pacote 500 Páginas', pages: 500, price: 199.9 },
  { id: 'extra_1000_pages', label: 'Pacote 1000 Páginas', pages: 1000, price: 349.9 },
];

/**
 * Retorna o plano a partir do plan_type de um profile.
 * Fallback seguro para trial se plan_type for inválido ou ausente.
 */
export function getPlan(planType: string | undefined | null): Plan {
  if (planType && planType in PLANS) {
    return PLANS[planType as PlanType];
  }
  return PLANS.trial;
}

/**
 * Retorna as permissões de um plan_type.
 */
export function getPlanPermissions(planType: string | undefined | null): PlanPermissions {
  return getPlan(planType).permissions;
}

/**
 * Lista de planos disponíveis (público).
 */
export function listPlans(): Plan[] {
  return Object.values(PLANS).filter(p => p.id !== 'internal_test');
}

/**
 * Converte a chave visual/nova do plano para a chave técnica (billing) no banco P1.
 */
export function toBillingPlanKey(planType: string): string {
  if (planType === 'profissional') return 'pro';
  if (planType === 'business') return 'premium';
  return planType;
}

/**
 * Converte a chave técnica (billing) do banco P1 para o nome de exibição.
 */
export function toDisplayPlanName(planKey: string): string {
  if (planKey === 'pro') return 'Profissional';
  if (planKey === 'premium') return 'Business';
  if (planKey === 'starter') return 'Start';
  if (planKey === 'trial') return 'Trial Gratuito';
  if (planKey === 'enterprise') return 'Enterprise';
  if (planKey === 'internal_test') return 'Plano Interno de Testes';
  return planKey;
}