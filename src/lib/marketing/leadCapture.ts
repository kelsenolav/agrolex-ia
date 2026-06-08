/**
 * leadCapture.ts — Camada de serviço de captura de marketing leads
 *
 * Funções PURE de construção de payload + funções de persistência via API Route.
 * Idempotente: upsert por email (não duplica registros).
 * Sem dependência direta de banco — usa fetch para /api/marketing/leads.
 *
 * Regras:
 *   - captureLead(): cria ou atualiza lead por email
 *   - updateLeadActivity(): atualiza ultima_atividade sem duplicar
 *   - markLeadConverted(): marca converteu=true e converted_at
 */

export type TipoUsuario =
  | 'Produtor Rural'
  | 'Advogado'
  | 'Corretor'
  | 'Investidor'
  | 'Outro';

export interface MarketingLeadInput {
  nome: string;
  email: string;
  whatsapp?: string | null;
  tipo_usuario?: TipoUsuario | null;
  origem: string;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MarketingLeadUpdateInput {
  email: string;
  whatsapp?: string | null;
  tipo_usuario?: TipoUsuario | null;
  metadata?: Record<string, unknown>;
}

export interface LeadCaptureResult {
  ok: boolean;
  error?: string;
}

/**
 * Captura ou atualiza um lead de marketing.
 * Idempotente: se o email já existir, atualiza os campos fornecidos.
 * Chama a API Route /api/marketing/leads (POST).
 */
export async function captureLead(
  input: MarketingLeadInput
): Promise<LeadCaptureResult> {
  try {
    const res = await fetch('/api/marketing/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'capture', ...input }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? 'Erro ao capturar lead.' };
    }

    return { ok: true };
  } catch {
    // Falha silenciosa — não bloqueia o fluxo principal
    return { ok: false, error: 'Falha de rede ao capturar lead.' };
  }
}

/**
 * Atualiza ultima_atividade de um lead existente pelo email.
 * Chama a API Route /api/marketing/leads (POST).
 */
export async function updateLeadActivity(
  email: string
): Promise<LeadCaptureResult> {
  try {
    const res = await fetch('/api/marketing/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_activity', email }),
    });

    if (!res.ok) {
      return { ok: false, error: 'Erro ao atualizar atividade do lead.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Falha de rede ao atualizar atividade.' };
  }
}

/**
 * Marca um lead como convertido (converteu=true, converted_at=now).
 * Chama a API Route /api/marketing/leads (POST).
 */
export async function markLeadConverted(
  email: string
): Promise<LeadCaptureResult> {
  try {
    const res = await fetch('/api/marketing/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_converted', email }),
    });

    if (!res.ok) {
      return { ok: false, error: 'Erro ao marcar lead como convertido.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Falha de rede ao marcar conversão.' };
  }
}

/**
 * Complementa dados de um lead existente (whatsapp, tipo_usuario).
 * Chama a API Route /api/marketing/leads (POST).
 */
export async function complementLead(
  input: MarketingLeadUpdateInput
): Promise<LeadCaptureResult> {
  try {
    const res = await fetch('/api/marketing/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complement', ...input }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? 'Erro ao complementar lead.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Falha de rede ao complementar lead.' };
  }
}
