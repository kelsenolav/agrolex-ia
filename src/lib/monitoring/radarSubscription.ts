import { isEffectivelyActive } from './radarRenewal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

export interface RadarSubscriptionStatus {
  has_active_subscription: boolean;
  trial_used: boolean;
  trial_available: boolean;
  subscribed_properties: string[];
  max_properties: number;
  expires_at: string | null;
  /** true quando há Preapproval MP ativo (cobrança automática mensal). */
  auto_renew_active: boolean;
  /** Status bruto da assinatura ('active'|'cancelled'|'paused'|...) — null sem assinatura. */
  subscription_status: string | null;
}

const RADAR_TRIAL_SCANS_PER_PROPERTY = 1;
const RADAR_PRICE_PER_PROPERTY = 49.90;
const RADAR_SINGLE_SCAN_PRICE = 9.90;

export { RADAR_PRICE_PER_PROPERTY, RADAR_SINGLE_SCAN_PRICE };

export async function getRadarStatus(
  userId: string,
  supabaseAdmin: SupabaseAdmin
): Promise<RadarSubscriptionStatus> {
  const { data: sub } = await supabaseAdmin
    .from('radar_subscriptions')
    .select('id, status, property_ids, expires_at, max_properties, mp_preapproval_id')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: trialRecord } = await supabaseAdmin
    .from('radar_trial_usage')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  const trialUsed = (trialRecord && trialRecord.length > 0) || false;

  // Grace-aware (Eixo 2 / 2.3): assinatura vencida ALÉM da graça NÃO conta como
  // ativa (fecha o vazamento de monitoramento grátis pós-expiração).
  // Preapproval (CDC): 'cancelled' e 'paused' MANTÊM acesso até o expires_at já
  // pago — cancelar a renovação automática nunca corta o que o cliente pagou.
  const statusComAcesso = sub && ['active', 'cancelled', 'paused'].includes(sub.status);
  if (sub && statusComAcesso && isEffectivelyActive(sub.expires_at, Date.now())) {
    return {
      has_active_subscription: true,
      trial_used: trialUsed,
      trial_available: false,
      subscribed_properties: sub.property_ids || [],
      max_properties: sub.max_properties || 5,
      expires_at: sub.expires_at,
      auto_renew_active: sub.status === 'active' && !!sub.mp_preapproval_id,
      subscription_status: sub.status,
    };
  }

  return {
    has_active_subscription: false,
    trial_used: trialUsed,
    trial_available: !trialUsed,
    subscribed_properties: [],
    max_properties: 0,
    expires_at: null,
    auto_renew_active: false,
    subscription_status: sub?.status ?? null,
  };
}

export async function consumeRadarTrial(
  userId: string,
  propertyId: string,
  supabaseAdmin: SupabaseAdmin
): Promise<{ consumed: boolean; error?: string }> {
  const status = await getRadarStatus(userId, supabaseAdmin);

  if (status.has_active_subscription) {
    return { consumed: true };
  }

  if (status.trial_used) {
    return { consumed: false, error: 'Varredura gratuita já utilizada. Assine o Radar para continuar monitorando.' };
  }

  await supabaseAdmin.from('radar_trial_usage').insert({
    user_id: userId,
    property_id: propertyId,
    scans_used: 1,
    max_scans: RADAR_TRIAL_SCANS_PER_PROPERTY,
  });

  return { consumed: true };
}

export async function canRunScan(
  userId: string,
  propertyId: string,
  supabaseAdmin: SupabaseAdmin
): Promise<{ allowed: boolean; reason: 'subscription' | 'trial' | 'blocked'; message: string }> {
  const status = await getRadarStatus(userId, supabaseAdmin);

  if (status.has_active_subscription) {
    if (status.subscribed_properties.length === 0 || status.subscribed_properties.includes(propertyId)) {
      return { allowed: true, reason: 'subscription', message: 'Assinatura ativa' };
    }
    if (status.subscribed_properties.length < status.max_properties) {
      return { allowed: true, reason: 'subscription', message: 'Propriedade será adicionada à assinatura' };
    }
    return {
      allowed: false,
      reason: 'blocked',
      message: `Limite de ${status.max_properties} propriedades atingido. Faça upgrade do plano ou remova uma propriedade.`,
    };
  }

  if (!status.trial_used) {
    return { allowed: true, reason: 'trial', message: 'Primeira varredura gratuita disponível' };
  }

  return {
    allowed: false,
    reason: 'blocked',
    message: 'Varredura gratuita já utilizada. Assine o Radar para continuar monitorando suas propriedades.',
  };
}
