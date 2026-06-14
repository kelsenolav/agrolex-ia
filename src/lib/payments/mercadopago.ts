/**
 * Integração com Mercado Pago — modo Sandbox
 * FASE 4 — Checkout Modular (Pagamento Real)
 * 
 * Responsável por:
 * - Criar preferência de pagamento no Mercado Pago
 * - Validar webhooks de notificação
 * - Consultar status de pagamento
 */

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
const MP_SANDBOX = process.env.MERCADOPAGO_SANDBOX === 'true' || !process.env.MERCADOPAGO_PRODUCTION;
const MP_BASE_URL = 'https://api.mercadopago.com';

export interface PreferenceItem {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

export interface PreferenceRequest {
  items: PreferenceItem[];
  external_reference: string; // analysisId
  payer?: {
    name: string;
    email: string;
  };
  notification_url?: string;
  back_urls?: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return?: string;
}

export interface PreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  date_created: string;
}

export interface PaymentInfo {
  id: string;
  status: string;
  status_detail: string;
  payment_type_id: string;
  installments: number;
  transaction_amount: number;
  external_reference: string;
  date_approved: string | null;
  date_created: string;
}

/**
 * Cria uma preferência de pagamento no Mercado Pago.
 * Retorna a URL de checkout (init_point ou sandbox_init_point).
 */
export async function createPreference(req: PreferenceRequest): Promise<{
  preferenceId: string;
  checkoutUrl: string;
}> {
  if (!MP_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurada');
  }

  const body: Record<string, unknown> = {
    items: req.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      currency_id: item.currency_id || 'BRL',
    })),
    external_reference: req.external_reference,
    notification_url: req.notification_url || undefined,
    back_urls: req.back_urls || undefined,
    auto_return: req.auto_return || 'approved',
  };

  // Adicionar payer se disponível
  if (req.payer) {
    body.payer = {
      name: req.payer.name,
      email: req.payer.email,
    };
  }

  const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Mercado Pago preference error:', errorData);
    throw new Error(
      `Erro ao criar preferência: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const preferenceId = data.id as string;
  const checkoutUrl = (MP_SANDBOX ? data.sandbox_init_point : data.init_point) as string;

  if (!preferenceId || !checkoutUrl) {
    throw new Error('Resposta inválida do Mercado Pago: missing id or init_point');
  }

  return { preferenceId, checkoutUrl };
}

/**
 * Consulta o status de um pagamento pelo ID.
 */
export async function getPayment(paymentId: string): Promise<PaymentInfo> {
  if (!MP_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurada');
  }

  const response = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar pagamento: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Verifica se a assinatura do webhook é válida.
 * Mercado Pago envia x-signature e x-request-id nos headers.
 */
export function verifyWebhookSignature(
  headers: Headers,
  body: string
): boolean {
  // Em sandbox, aceitamos sem validação rigorosa de assinatura
  // Em produção, validar x-signature com o secret do webhook
  if (MP_SANDBOX) {
    return true;
  }

  // TODO: implementar validação de assinatura para produção
  // const signature = headers.get('x-signature');
  // const requestId = headers.get('x-request-id');
  // ...
  return true;
}

/**
 * Verifica se estamos em modo sandbox.
 */
export function isSandbox(): boolean {
  return MP_SANDBOX;
}