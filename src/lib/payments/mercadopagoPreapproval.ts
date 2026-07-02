/**
 * Integração com Mercado Pago — Preapproval (assinatura recorrente)
 *
 * Diferente da Preference (checkout avulso, `mercadopago.ts`), o Preapproval
 * é autorizado UMA vez pelo cliente e o MP cobra sozinho todo mês. Criamos
 * sem card_token com `status: "pending"`: a resposta traz `init_point`, o
 * cliente autoriza no redirect (mesma UX do checkout atual) e o webhook
 * `subscription_preapproval` confirma a ativação.
 *
 * Contrato verificado na doc oficial do MP (assinatura sem plano associado,
 * pagamento pendente) — ver docs/superpowers/specs/2026-07-01-mp-preapproval-radar-design.md.
 */

const MP_BASE_URL = 'https://api.mercadopago.com';

export type PreapprovalStatus = 'pending' | 'authorized' | 'paused' | 'cancelled';

export interface CreatePreapprovalRequest {
  reason: string;
  external_reference: string; // user.id — a assinatura pertence ao usuário
  payer_email: string;
  transaction_amount: number;
  back_url: string;
}

export interface PreapprovalInfo {
  id: string;
  status: PreapprovalStatus;
  external_reference: string;
  payer_email?: string;
  reason?: string;
  init_point?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
}

export interface AuthorizedPaymentInfo {
  id: string;
  preapproval_id: string;
  status: string;
  transaction_amount?: number;
  // O MP aninha o status do pagamento efetivo em `payment` em alguns formatos;
  // normalizamos no getter.
  payment?: { id?: number; status?: string; status_detail?: string };
}

function requireToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
  if (!token) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurada');
  }
  return token;
}

async function mpFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = requireToken();
  return fetch(`${MP_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Cria uma assinatura recorrente mensal em estado `pending` (sem cartão).
 * O cliente autoriza via `init_point` (redirect).
 */
export async function createPreapproval(req: CreatePreapprovalRequest): Promise<{
  preapprovalId: string;
  initPoint: string;
}> {
  const res = await mpFetch('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: req.reason,
      external_reference: req.external_reference,
      payer_email: req.payer_email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: req.transaction_amount,
        currency_id: 'BRL',
      },
      back_url: req.back_url,
      status: 'pending',
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Mercado Pago preapproval error:', errorData);
    throw new Error(`Erro ao criar assinatura: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const preapprovalId = data.id as string;
  const initPoint = data.init_point as string;

  if (!preapprovalId || !initPoint) {
    throw new Error('Resposta inválida do Mercado Pago: missing id or init_point');
  }

  return { preapprovalId, initPoint };
}

/** Consulta o estado atual de uma assinatura. */
export async function getPreapproval(preapprovalId: string): Promise<PreapprovalInfo> {
  const res = await mpFetch(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  if (!res.ok) {
    throw new Error(`Erro ao consultar assinatura: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Consulta uma cobrança recorrente individual (webhook subscription_authorized_payment). */
export async function getAuthorizedPayment(authorizedPaymentId: string): Promise<AuthorizedPaymentInfo> {
  const res = await mpFetch(`/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`);
  if (!res.ok) {
    throw new Error(`Erro ao consultar cobrança recorrente: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Cancela a assinatura no MP. O acesso do cliente permanece até o
 * `expires_at` já pago — quem decide isso é o nosso banco, não o MP.
 */
export async function cancelPreapproval(preapprovalId: string): Promise<PreapprovalInfo> {
  const res = await mpFetch(`/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Mercado Pago cancel preapproval error:', errorData);
    throw new Error(`Erro ao cancelar assinatura: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
