import { POST } from '../route';
import { createClient } from '@supabase/supabase-js';
import { getPayment, verifyWebhookSignature } from '@/lib/payments/mercadopago';
import { getPreapproval, getAuthorizedPayment } from '@/lib/payments/mercadopagoPreapproval';
import { activateSubscription } from '@/lib/subscriptions';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/payments/mercadopago');
jest.mock('@/lib/payments/mercadopagoPreapproval');
jest.mock('@/lib/subscriptions');

describe('Webhook Mercado Pago route tests', () => {
  let mockSupabase: any;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('approved primeira vez -> ativa assinatura', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getPayment as jest.Mock).mockResolvedValue({
      id: 'pay-123',
      status: 'approved',
      status_detail: 'accredited',
      payment_type_id: 'credit_card',
      installments: 1,
      external_reference: 'ord-123',
      date_approved: new Date().toISOString(),
    });

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: 'ord-123', user_id: 'usr-456', payment_method: 'plan_pro', status: 'pending' },
      error: null,
    });

    const req = new Request('https://example.com/api/webhook/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ topic: 'payment', data: { id: 'pay-123' } }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('approved');
    expect(activateSubscription).toHaveBeenCalledWith('usr-456', 'pro');
  });

  it('approved repetido -> não altera créditos nem assinatura', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getPayment as jest.Mock).mockResolvedValue({
      id: 'pay-123',
      status: 'approved',
      status_detail: 'accredited',
      payment_type_id: 'credit_card',
      installments: 1,
      external_reference: 'ord-123',
      date_approved: new Date().toISOString(),
    });

    // Ordem já possui status 'approved'
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: 'ord-123', user_id: 'usr-456', payment_method: 'plan_pro', status: 'approved' },
      error: null,
    });

    const req = new Request('https://example.com/api/webhook/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ topic: 'payment', data: { id: 'pay-123' } }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe('Evento já processado');
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  // ─── Preapproval (Radar recorrente) ─────────────────────────────────────

  function preapprovalReq(type: string, id: string) {
    return new Request('https://example.com/api/webhook/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type, data: { id } }),
    });
  }

  it('subscription_preapproval authorized -> ativa radar_subscription com expires_at', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getPreapproval as jest.Mock).mockResolvedValue({ id: 'pre_1', status: 'authorized', external_reference: 'usr-9' });

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'usr-9', status: 'pending', expires_at: null },
      error: null,
    });

    const res = await POST(preapprovalReq('subscription_preapproval', 'pre_1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.preapproval_status).toBe('authorized');
    const updateArg = mockSupabase.update.mock.calls[0][0];
    expect(updateArg.status).toBe('active');
    expect(updateArg.expires_at).toBeTruthy(); // período começa na autorização
    expect(getPayment).not.toHaveBeenCalled(); // não cai no fluxo de payment avulso
  });

  it('subscription_preapproval cancelled -> marca cancelled com cancelled_at (acesso segue até expires_at)', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getPreapproval as jest.Mock).mockResolvedValue({ id: 'pre_1', status: 'cancelled', external_reference: 'usr-9' });

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'usr-9', status: 'active', expires_at: '2026-08-01T00:00:00Z' },
      error: null,
    });

    const res = await POST(preapprovalReq('subscription_preapproval', 'pre_1'));
    expect(res.status).toBe(200);
    const updateArg = mockSupabase.update.mock.calls[0][0];
    expect(updateArg.status).toBe('cancelled');
    expect(updateArg.cancelled_at).toBeTruthy();
    expect(updateArg.expires_at).toBeUndefined(); // NÃO mexe no período já pago
  });

  it('subscription_preapproval paused -> marca paused (cobrança automática falhou)', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getPreapproval as jest.Mock).mockResolvedValue({ id: 'pre_1', status: 'paused', external_reference: 'usr-9' });

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'usr-9', status: 'active', expires_at: '2026-08-01T00:00:00Z' },
      error: null,
    });

    const res = await POST(preapprovalReq('subscription_preapproval', 'pre_1'));
    expect(res.status).toBe(200);
    expect(mockSupabase.update.mock.calls[0][0].status).toBe('paused');
  });

  it('subscription_preapproval sem assinatura correspondente -> 200 sem alterar nada (evita reentrega infinita)', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getPreapproval as jest.Mock).mockResolvedValue({ id: 'pre_desconhecido', status: 'authorized', external_reference: 'x' });

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST(preapprovalReq('subscription_preapproval', 'pre_desconhecido'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message).toContain('não correlacionado');
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  it('subscription_authorized_payment aprovado -> estende expires_at e grava marcador de idempotência', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getAuthorizedPayment as jest.Mock).mockResolvedValue({
      id: 'ap_7', preapproval_id: 'pre_1', status: 'processed', payment: { status: 'approved' },
    });

    const vigente = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 dias restantes
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'usr-9', status: 'active', expires_at: vigente, mp_subscription_id: null },
      error: null,
    });

    const res = await POST(preapprovalReq('subscription_authorized_payment', 'ap_7'));
    const data = await res.json();

    expect(res.status).toBe(200);
    const updateArg = mockSupabase.update.mock.calls[0][0];
    expect(updateArg.status).toBe('active');
    expect(updateArg.mp_subscription_id).toBe('authpay_ap_7');
    // Renovação antecipada ESTENDE a partir do vencimento vigente (não perde os 5 dias)
    expect(new Date(data.renewed_until).getTime()).toBeGreaterThan(new Date(vigente).getTime());
  });

  it('subscription_authorized_payment duplicado -> NÃO estende expires_at duas vezes', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getAuthorizedPayment as jest.Mock).mockResolvedValue({
      id: 'ap_7', preapproval_id: 'pre_1', status: 'processed', payment: { status: 'approved' },
    });

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'usr-9', status: 'active', expires_at: '2026-08-01T00:00:00Z', mp_subscription_id: 'authpay_ap_7' },
      error: null,
    });

    const res = await POST(preapprovalReq('subscription_authorized_payment', 'ap_7'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain('já processada');
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  it('subscription_authorized_payment recusado -> não estende nada', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getAuthorizedPayment as jest.Mock).mockResolvedValue({
      id: 'ap_8', preapproval_id: 'pre_1', status: 'processed', payment: { status: 'rejected' },
    });

    const res = await POST(preapprovalReq('subscription_authorized_payment', 'ap_8'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain('não aprovada');
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  it('cobrança aprovada reativa assinatura que estava paused', async () => {
    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (getAuthorizedPayment as jest.Mock).mockResolvedValue({
      id: 'ap_9', preapproval_id: 'pre_1', status: 'processed', payment: { status: 'approved' },
    });

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'usr-9', status: 'paused', expires_at: '2026-06-20T00:00:00Z', mp_subscription_id: 'authpay_antigo' },
      error: null,
    });

    const res = await POST(preapprovalReq('subscription_authorized_payment', 'ap_9'));
    expect(res.status).toBe(200);
    expect(mockSupabase.update.mock.calls[0][0].status).toBe('active');
  });
});
