/**
 * /api/marketing/leads — API Route para captura de marketing leads
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY para bypass do RLS (operação server-side).
 * Idempotente: upsert por email.
 *
 * Actions suportadas:
 *   - capture: cria ou atualiza lead (upsert por email)
 *   - update_activity: atualiza ultima_atividade
 *   - mark_converted: marca converteu=true
 *   - complement: atualiza whatsapp e/ou tipo_usuario
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase service role não configurado.');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action obrigatória.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // ─── ACTION: capture ────────────────────────────────────────────────────
    if (action === 'capture') {
      const { nome, email, whatsapp, tipo_usuario, origem, user_id, metadata } = body;

      if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
        return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
      }

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
      }

      const now = new Date().toISOString();

      const payload: Record<string, unknown> = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        origem: origem ?? 'signup',
        ultima_atividade: now,
        metadata: metadata ?? {},
      };

      if (whatsapp) payload.whatsapp = whatsapp.trim();
      if (tipo_usuario) payload.tipo_usuario = tipo_usuario;
      if (user_id) payload.user_id = user_id;

      const { error } = await supabaseAdmin
        .from('marketing_leads')
        .upsert(payload, {
          onConflict: 'email',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[marketing/leads] capture error:', error.message);
        return NextResponse.json({ error: 'Erro ao salvar lead.' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // ─── ACTION: update_activity ─────────────────────────────────────────────
    if (action === 'update_activity') {
      const { email } = body;

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('marketing_leads')
        .update({ ultima_atividade: new Date().toISOString() })
        .eq('email', email.trim().toLowerCase());

      if (error) {
        console.error('[marketing/leads] update_activity error:', error.message);
        return NextResponse.json({ error: 'Erro ao atualizar atividade.' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // ─── ACTION: mark_converted ──────────────────────────────────────────────
    if (action === 'mark_converted') {
      const { email } = body;

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });
      }

      const now = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('marketing_leads')
        .update({ converteu: true, converted_at: now, ultima_atividade: now })
        .eq('email', email.trim().toLowerCase());

      if (error) {
        console.error('[marketing/leads] mark_converted error:', error.message);
        return NextResponse.json({ error: 'Erro ao marcar conversão.' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // ─── ACTION: complement ──────────────────────────────────────────────────
    if (action === 'complement') {
      const { email, whatsapp, tipo_usuario } = body;

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });
      }

      const update: Record<string, unknown> = {
        ultima_atividade: new Date().toISOString(),
      };

      if (whatsapp && typeof whatsapp === 'string') {
        update.whatsapp = whatsapp.trim();
      }

      if (tipo_usuario && typeof tipo_usuario === 'string') {
        const tiposValidos = ['Produtor Rural', 'Advogado', 'Corretor', 'Investidor', 'Outro'];
        if (!tiposValidos.includes(tipo_usuario)) {
          return NextResponse.json({ error: 'Tipo de usuário inválido.' }, { status: 400 });
        }
        update.tipo_usuario = tipo_usuario;
      }

      const { error } = await supabaseAdmin
        .from('marketing_leads')
        .update(update)
        .eq('email', email.trim().toLowerCase());

      if (error) {
        console.error('[marketing/leads] complement error:', error.message);
        return NextResponse.json({ error: 'Erro ao complementar lead.' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // ─── ACTION: register_interest ───────────────────────────────────────────
    if (action === 'register_interest') {
      const { nome, email, whatsapp, tipo_usuario, interest_plan, interest_volume } = body;

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });
      }

      const now = new Date().toISOString();

      const { data: existingLead } = await supabaseAdmin
        .from('marketing_leads')
        .select('id, metadata')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      const baseMetadata = (existingLead?.metadata as Record<string, unknown> | null) ?? {};

      const mainPayload: Record<string, unknown> = {
        ultima_atividade: now,
        interest_registered: true,
        interest_registered_at: now,
        interest_plan: interest_plan,
        interest_volume: interest_volume,
        interest_status: 'Novo',
      };

      if (nome) mainPayload.nome = nome.trim();
      if (whatsapp) mainPayload.whatsapp = whatsapp.trim();
      if (tipo_usuario) mainPayload.tipo_usuario = tipo_usuario;

      mainPayload.metadata = {
        ...baseMetadata,
        interest_info: {
          interest_registered: true,
          interest_registered_at: now,
          interest_plan,
          interest_volume,
          interest_status: 'Novo',
          tipo_usuario,
          whatsapp,
          nome,
        }
      };

      let { error } = await supabaseAdmin
        .from('marketing_leads')
        .update(mainPayload)
        .eq('email', email.trim().toLowerCase());

      if (error) {
        console.warn('[marketing/leads] Colunas de interesse nao disponiveis no banco. Aplicando fallback em metadata...', error.message);
        const fallbackPayload: Record<string, unknown> = {
          ultima_atividade: now,
          metadata: mainPayload.metadata,
        };
        if (nome) fallbackPayload.nome = nome.trim();
        if (whatsapp) fallbackPayload.whatsapp = whatsapp.trim();
        if (tipo_usuario) fallbackPayload.tipo_usuario = tipo_usuario;

        const { error: fallbackError } = await supabaseAdmin
          .from('marketing_leads')
          .update(fallbackPayload)
          .eq('email', email.trim().toLowerCase());

        if (fallbackError) {
          console.error('[marketing/leads] fallback error:', fallbackError.message);
          return NextResponse.json({ error: 'Erro ao registrar interesse (fallback).' }, { status: 500 });
        }
      }

      return NextResponse.json({ ok: true });
    }

    // ─── ACTION: get_trial_status ───────────────────────────────────────────
    if (action === 'get_trial_status') {
      const { userId, email } = body;
      if (!userId) {
        return NextResponse.json({ error: 'userId obrigatório.' }, { status: 400 });
      }
      const { getTrialStatus } = await import('@/lib/trial/trialControl');
      const status = await getTrialStatus(userId, email);
      return NextResponse.json(status);
    }

    // ─── ACTION: track_event ────────────────────────────────────────────────
    if (action === 'track_event') {
      const { userId, eventType, meta, email } = body;
      if (!userId || !eventType) {
        return NextResponse.json({ error: 'userId e eventType obrigatórios.' }, { status: 400 });
      }
      const { trackTrialEvent } = await import('@/lib/trial/trialControl');
      const ok = await trackTrialEvent(userId, eventType, meta, email);
      return NextResponse.json({ ok });
    }

    return NextResponse.json({ error: 'Action desconhecida.' }, { status: 400 });
  } catch (err) {
    console.error('[marketing/leads] unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// ─── GET: listagem para o dashboard admin ────────────────────────────────────
export async function GET(req: Request) {
  try {
    const supabaseAdmin = createAdminClient();

    // Verificar se o chamador é admin via header de sessão
    const authHeader = req.headers.get('x-agrolex-session');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // Verificar role do usuário
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader);
    if (userError || !user) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar leads.' }, { status: 500 });
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    console.error('[marketing/leads GET] error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
