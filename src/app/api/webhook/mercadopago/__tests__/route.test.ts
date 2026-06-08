import { POST } from '../route';
import { createClient } from '@supabase/supabase-js';
import { getPayment, verifyWebhookSignature } from '@/lib/payments/mercadopago';
import { activateSubscription } from '@/lib/subscriptions';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/payments/mercadopago');
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
});
