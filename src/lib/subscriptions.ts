import { createClient } from '@supabase/supabase-js';

export type PlanType = 'trial' | 'starter' | 'pro' | 'premium' | 'enterprise' | 'internal_test';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  // credits_available representa páginas disponíveis no modelo comercial P1.
  credits_available: number;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PLAN_CREDITS: Record<PlanType, number> = {
  trial: 10,
  starter: 150,
  pro: 1000,
  premium: 5000,
  enterprise: 5000,
  internal_test: 999999,
};

export const PLAN_PRICES: Record<PlanType, number> = {
  trial: 0,
  starter: 149.9,
  pro: 399.9,
  premium: 999.9,
  enterprise: 9999.9,
  internal_test: 0,
};

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) {
    throw new Error('Supabase URL ou Service Role Key ausente');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Retorna a assinatura ativa ou padrão (fallback para Trial com 0 créditos se não encontrado no banco).
 * Também verifica e atualiza o status se a data de expiração passou.
 */
export async function getUserSubscription(userId: string): Promise<Subscription> {
  const supabaseAdmin = createAdminClient();

  const internalTestEmails = (process.env.INTERNAL_TEST_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  if (internalTestEmails.length > 0 && internalTestEmails[0] !== '') {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email?.toLowerCase();
    if (userEmail && internalTestEmails.includes(userEmail)) {
      const nowStr = new Date().toISOString();
      return {
        id: 'internal-test-id',
        user_id: userId,
        plan_type: 'internal_test' as PlanType,
        status: 'active',
        credits_available: 999999,
        started_at: nowStr,
        expires_at: null,
        created_at: nowStr,
        updated_at: nowStr,
      };
    }
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[subscriptions] Erro ao buscar assinatura:', error.message);
  }

  const nowStr = new Date().toISOString();

  if (data) {
    let sub = data as Subscription;
    // Se expirou e ainda está ativa, atualiza no banco
    if (sub.status === 'active' && sub.expires_at && new Date(sub.expires_at) < new Date()) {
      const { data: updatedSub, error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'expired', updated_at: nowStr })
        .eq('id', sub.id)
        .select()
        .single();
      if (!updateError && updatedSub) {
        sub = updatedSub as Subscription;
      }
    }
    return sub;
  }

  // Fallback: Retorna um objeto mockado do plano trial se o usuário não tiver assinatura gravada.
  return {
    id: 'mock-trial-id',
    user_id: userId,
    plan_type: 'trial',
    status: 'active',
    credits_available: 10,
    started_at: nowStr,
    expires_at: null,
    created_at: nowStr,
    updated_at: nowStr,
  };
}

/**
 * Ativa ou atualiza uma assinatura para um usuário.
 */
export async function activateSubscription(
  userId: string,
  planType: PlanType,
  durationDays = 30
): Promise<Subscription> {
  const supabaseAdmin = createAdminClient();
  const now = new Date();
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const credits = PLAN_CREDITS[planType];

  const payload = {
    plan_type: planType,
    status: 'active' as const,
    credits_available: credits,
    started_at: startedAt,
    expires_at: expiresAt,
    updated_at: startedAt,
  };

  // Tenta update ou insert (upsert)
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select()
      .single();
    if (error) throw error;
    result = data;
  }

  // Sincronizar o plan_type no profile do usuário
  await supabaseAdmin
    .from('profiles')
    .update({ plan_type: planType })
    .eq('id', userId);

  return result as Subscription;
}

/**
 * Verifica se a assinatura possui créditos válidos e está ativa.
 */
export async function hasAvailableCredits(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  if (sub.status !== 'active') return false;
  return sub.credits_available > 0;
}

export async function consumeCredits(userId: string): Promise<boolean> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc('consume_subscription_credit', {
    user_id_param: userId,
  });

  if (error) {
    console.error('[subscriptions] Erro ao consumir crédito via RPC:', error.message);
    return false;
  }

  return !!data;
}

// credits_available representa páginas disponíveis no modelo comercial P1/P2.
export async function consumePages(userId: string, pagesCount: number): Promise<boolean> {
  if (pagesCount <= 0) return false;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc('consume_subscription_pages', {
    user_id_param: userId,
    pages_count: pagesCount,
  });

  if (error) {
    console.error('[subscriptions] Erro ao consumir páginas via RPC:', error.message);
    return false;
  }

  return !!data;
}
