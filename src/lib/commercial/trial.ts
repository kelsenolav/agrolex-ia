/**
 * trial.ts — Helpers de trial/lead para o AgroLex
 *
 * Funções PURE que funcionam mesmo se os novos campos do profile
 * (subscription_status, plan_type, trial_used etc.) ainda forem undefined.
 *
 * Nenhuma dependência de banco ou API.
 */

import { getPlanPermissions, PlanType } from './plans';

/**
 * Interface mínima de profile para os helpers de trial.
 * Aceita campos undefined pois a migration pode não ter sido aplicada ainda.
 */
export interface TrialProfile {
  subscription_status?: string | null;
  plan_type?: string | null;
  trial_used?: boolean | null;
  trial_analysis_id?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  lead_id?: string | null;
}

export interface TrialLimits {
  maxAnalyses: number;
  trialDays: number;
  canStartNewAnalysis: boolean;
  blockReason: string | null;
}

/**
 * Verifica se o usuário já usou o trial.
 * Retorna true se trial_used for explicitamente true.
 * Se for undefined/null, assume que ainda não usou (false).
 */
export function hasUsedTrial(profile: TrialProfile): boolean {
  return profile.trial_used === true;
}

/**
 * Verifica se o usuário pode iniciar uma análise no trial.
 * Regras:
 *   1. subscription_status deve ser 'trial' (ou undefined/null — assume trial)
 *   2. trial_used não pode ser true
 *   3. Se trial_ends_at passou, bloqueia
 */
export function canStartTrialAnalysis(profile: TrialProfile): boolean {
  if (hasUsedTrial(profile)) return false;

  const status = profile.subscription_status ?? 'trial';
  if (status !== 'trial') return false;

  // Verificar expiração do trial
  if (profile.trial_ends_at) {
    const endsAt = new Date(profile.trial_ends_at);
    if (endsAt <= new Date()) return false;
  }

  return true;
}

/**
 * Retorna o motivo de bloqueio do trial, ou null se está liberado.
 */
export function getTrialBlockReason(profile: TrialProfile): string | null {
  if (hasUsedTrial(profile)) {
    return 'Você já utilizou sua análise gratuita. Assine um plano para continuar.';
  }

  const status = profile.subscription_status ?? 'trial';
  if (status !== 'trial') {
    return 'Seu período de teste já foi encerrado.';
  }

  if (profile.trial_ends_at) {
    const endsAt = new Date(profile.trial_ends_at);
    if (endsAt <= new Date()) {
      return 'Seu trial expirou. Assine um plano para continuar usando o AgroLex.';
    }
  }

  return null;
}

/**
 * Retorna os limites atuais do trial para o profile.
 * Funciona mesmo se subscription_status/plan_type forem undefined.
 */
export function getTrialLimits(profile: TrialProfile): TrialLimits {
  const planType: string = profile.plan_type ?? 'trial';
  const permissions = getPlanPermissions(planType);
  const blockReason = getTrialBlockReason(profile);

  return {
    maxAnalyses: permissions.maxAnalyses,
    trialDays: 7,
    canStartNewAnalysis: blockReason === null,
    blockReason,
  };
}

/**
 * Retorna o nível de acesso comercial completo.
 * Inclui plano atual, permissões e status do trial.
 */
export function getCommercialAccess(profile: TrialProfile): {
  planType: PlanType;
  canStartAnalysis: boolean;
  blockReason: string | null;
  limits: TrialLimits;
} {
  const planType = (profile.plan_type ?? 'trial') as PlanType;
  const limits = getTrialLimits(profile);

  return {
    planType,
    canStartAnalysis: limits.canStartNewAnalysis,
    blockReason: limits.blockReason,
    limits,
  };
}