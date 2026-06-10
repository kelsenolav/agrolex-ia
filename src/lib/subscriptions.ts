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
 * Retorna a assinatura ativa do usuário.
 * P0 CRÍTICO:
 * 1. NÃO retorna fallback mockado — isso causa o erro "saldo insuficiente no fechamento"
 *    porque o consumePages tenta debitar de um registro real no banco que não existe.
 * 2. NÃO usa o parâmetro supabaseClient para queries na tabela `subscriptions`.
 *    A tabela `subscriptions` possui RLS restritivo e requer service_role para leitura.
 *    O parâmetro supabaseClient (quando recebido via rota com anon key) causaria o erro
 *    "Legacy API keys are disabled". SEMPRE usa createAdminClient() internamente.
 *
 * Lança erro explícito se não conseguir subscription real.
 */
export async function getUserSubscription(userId: string, _supabaseClient?: any): Promise<Subscription> {
  // P0: SEMPRE usar service_role para queries na tabela subscriptions.
  // O parâmetro _supabaseClient NÃO é usado para queries no banco porque
  // as rotas (ex: subscription/route.ts) passam clientes com anon key
  // que não têm acesso RLS à tabela subscriptions.
  // O prefixo _ indica que o parâmetro é ignorado intencionalmente para queries.
  const supabaseAdmin = createAdminClient();

  // Se _supabaseClient foi fornecido com uma chave com privilégios admin,
  // usamos para auth.admin.getUserById. Caso contrário, usamos o próprio admin.
  const authClient = (_supabaseClient?.auth?.admin?.getUserById)
    ? _supabaseClient
    : supabaseAdmin;

  const internalTestEmails = (process.env.INTERNAL_TEST_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  if (internalTestEmails.length > 0 && internalTestEmails[0] !== '') {
    const { data: userData } = await authClient.auth.admin.getUserById(userId);
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
    throw error;
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

  // Tenta criar uma subscription trial real no banco
  const createdSub = await createTrialSubscription(userId, supabaseAdmin);
  if (createdSub) {
    return createdSub;
  }

  // P0 CRÍTICO: Não retornar fallback mockado. Isso causa o erro "saldo insuficiente no fechamento"
  // porque o consumePages() chama a RPC no banco real, que não encontra registro subscription,
  // retorna false, e o sistema interpreta como saldo insuficiente.
  throw new Error(
    'Não foi possível criar ou encontrar uma assinatura trial real no banco de dados. ' +
    'Verifique se a tabela subscriptions existe, se a migration foi aplicada e se o service role key está configurada.'
  );
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

  // Sincronizar o plan_type no profile do usuário (falha silenciosa)
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ plan_type: planType })
      .eq('id', userId);
  } catch {
    // falha silenciosa
  }

  return result as Subscription;
}

/**
 * Cria uma subscription trial automática para um usuário que ainda não possui assinatura.
 * Usa upsert com onConflict + ignoreDuplicates para evitar race conditions.
 * Se falhar, busca o registro existente como fallback antes de retornar null.
 */
async function createTrialSubscription(userId: string, supabaseAdmin: any): Promise<Subscription | null> {
  const now = new Date();
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    user_id: userId,
    plan_type: 'trial' as PlanType,
    status: 'active' as SubscriptionStatus,
    credits_available: PLAN_CREDITS.trial,
    started_at: startedAt,
    expires_at: expiresAt,
    updated_at: startedAt,
  };

  try {
    // upsert com ignoreDuplicates: se já existir, não lança erro mas pode não retornar data
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: true })
      .select()
      .single();

    if (error) {
      console.error('[subscriptions] Erro ao upsert subscription trial:', error?.message);
      // Fallback: tenta buscar o registro existente
      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (existing) {
        console.log('[subscriptions] Subscription trial já existia (fallback após erro), retornando registro do banco.');
        return existing as Subscription;
      }
      return null;
    }

    // Se o upsert não retornou dados (ex: conflito com ignoreDuplicates), buscar o existente
    if (!data) {
      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (existing) {
        console.log('[subscriptions] Subscription trial já existia, retornando registro do banco.');
        return existing as Subscription;
      }
      console.error('[subscriptions] Upsert não retornou dados e nenhum registro existente encontrado.');
      return null;
    }

    // Sincronizar plan_type no profile (falha silenciosa)
    try {
      await supabaseAdmin
        .from('profiles')
        .update({ plan_type: 'trial' })
        .eq('id', userId);
    } catch {
      // falha silenciosa
    }

    console.log('[subscriptions] Subscription trial criada automaticamente para usuário', userId);
    return data as Subscription;
  } catch (err) {
    console.error('[subscriptions] Exceção ao criar subscription trial:', err);
    // Último recurso: tentar buscar existente
    try {
      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (existing) return existing as Subscription;
    } catch {
      // silencioso
    }
    return null;
  }
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
// P0: SEMPRE usa service_role para chamar a RPC. O parâmetro _supabaseClient
// é ignorado intencionalmente porque clientes anon não têm permissão para
// chamar RPCs que alteram saldo na tabela subscriptions.
export async function consumePages(userId: string, pagesCount: number, _supabaseClient?: any): Promise<boolean> {
  if (pagesCount <= 0) return false;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc('consume_subscription_pages', {
    user_id_param: userId,
    pages_count: pagesCount,
  });

  if (error) {
    console.error('[subscriptions] Erro ao consumir páginas via RPC:', error.message);
    throw error;
  }

  return !!data;
}
