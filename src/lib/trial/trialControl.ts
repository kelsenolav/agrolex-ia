import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TrialStatus {
  isTrial: boolean;
  used: boolean;
  analysisId: string | null;
}

/**
 * Checks if a user is allowed to use a trial.
 * User is allowed if they have NOT used the trial yet.
 */
export async function canUseTrial(userId: string, email?: string): Promise<boolean> {
  const status = await getTrialStatus(userId, email);
  return !status.used;
}

/**
 * Marks the trial as used for a user/lead.
 */
export async function markTrialUsed(userId: string, analysisId: string, email?: string): Promise<boolean> {
  try {
    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    // Tenta encontrar o lead pelo user_id ou email
    let { data: lead } = await supabaseAdmin
      .from('marketing_leads')
      .select('id, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (!lead && email) {
      const { data: leadByEmail } = await supabaseAdmin
        .from('marketing_leads')
        .select('id, email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      lead = leadByEmail;
    }

    if (!lead) {
      const { error: insertError } = await supabaseAdmin
        .from('marketing_leads')
        .insert({
          user_id: userId,
          email: email || `${userId}@agrolex.local`,
          nome: 'Usuário Trial',
          origem: 'trial',
          trial_used: true,
          trial_used_at: now,
          trial_analysis_id: analysisId,
          trial_utilizado: true, // compatibilidade
        });
      return !insertError;
    }

    const { error: updateError } = await supabaseAdmin
      .from('marketing_leads')
      .update({
        trial_used: true,
        trial_used_at: now,
        trial_analysis_id: analysisId,
        trial_utilizado: true, // compatibilidade
        user_id: userId,
      })
      .eq('id', lead.id);

    return !updateError;
  } catch (err) {
    console.error('[trialControl] markTrialUsed error:', err);
    return false;
  }
}

/**
 * Gets the trial status for a user/lead.
 */
export async function getTrialStatus(userId: string, email?: string): Promise<TrialStatus> {
  try {
    const supabaseAdmin = getAdminClient();

    let { data } = await supabaseAdmin
      .from('marketing_leads')
      .select('trial_used, trial_utilizado, trial_analysis_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data && email) {
      const { data: dataByEmail } = await supabaseAdmin
        .from('marketing_leads')
        .select('trial_used, trial_utilizado, trial_analysis_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      data = dataByEmail;
    }

    const used = data ? (data.trial_used === true || data.trial_utilizado === true) : false;
    const analysisId = data ? data.trial_analysis_id : null;

    return {
      isTrial: true,
      used,
      analysisId: analysisId || null,
    };
  } catch (err) {
    console.error('[trialControl] getTrialStatus error:', err);
    return {
      isTrial: true,
      used: false,
      analysisId: null,
    };
  }
}

/**
 * Registrar evento de telemetria no metadata do lead
 */
export async function trackTrialEvent(userId: string, eventType: string, meta?: Record<string, unknown>, email?: string): Promise<boolean> {
  try {
    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    let { data: lead } = await supabaseAdmin
      .from('marketing_leads')
      .select('id, metadata')
      .eq('user_id', userId)
      .maybeSingle();

    if (!lead && email) {
      const { data: leadByEmail } = await supabaseAdmin
        .from('marketing_leads')
        .select('id, metadata')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      lead = leadByEmail;
    }

    if (!lead) {
      const newEvent = { type: eventType, timestamp: now, ...(meta ? { meta } : {}) };
      const { error: insertError } = await supabaseAdmin
        .from('marketing_leads')
        .insert({
          user_id: userId,
          email: email || `${userId}@agrolex.local`,
          nome: 'Usuário Trial',
          origem: 'trial',
          metadata: { commercial_events: [newEvent] }
        });
      return !insertError;
    }

    const currentMetadata = (lead.metadata as Record<string, unknown> | null) ?? {};
    const existingEvents = Array.isArray(currentMetadata.commercial_events) ? currentMetadata.commercial_events : [];
    const newEvent = { type: eventType, timestamp: now, ...(meta ? { meta } : {}) };
    const updatedEvents = [...existingEvents, newEvent];

    const { error: updateError } = await supabaseAdmin
      .from('marketing_leads')
      .update({
        metadata: {
          ...currentMetadata,
          commercial_events: updatedEvents
        }
      })
      .eq('id', lead.id);

    return !updateError;
  } catch (err) {
    console.error('[trialControl] trackTrialEvent error:', err);
    return false;
  }
}
