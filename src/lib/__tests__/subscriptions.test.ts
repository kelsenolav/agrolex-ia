import {
  getUserSubscription,
  activateSubscription,
  hasAvailableCredits,
  consumeCredits,
  consumePages,
  PLAN_CREDITS,
  type PlanType,
} from '../subscriptions';
import { createClient } from '@supabase/supabase-js';

// Mock do Supabase
jest.mock('@supabase/supabase-js', () => {
  const mSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    rpc: jest.fn(),
  };
  return {
    createClient: jest.fn(() => mSupabase),
  };
});

describe('Subscriptions module tests', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  let mockSupabase: any;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = (createClient as any)();
  });

  it('retorna fallback Trial se nenhuma assinatura for encontrada no banco', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const sub = await getUserSubscription(mockUserId);
    expect(sub.plan_type).toBe('trial');
    expect(sub.credits_available).toBe(0);
    expect(sub.status).toBe('active');
  });

  it('retorna assinatura existente no banco', async () => {
    const mockSub = {
      id: 'sub-xyz',
      user_id: mockUserId,
      plan_type: 'starter',
      status: 'active',
      credits_available: 10,
      started_at: new Date().toISOString(),
      expires_at: null,
    };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockSub, error: null });

    const sub = await getUserSubscription(mockUserId);
    expect(sub.plan_type).toBe('starter');
    expect(sub.credits_available).toBe(10);
  });

  it('atualiza status para expired se a data de expiração passou', async () => {
    const mockSub = {
      id: 'sub-xyz',
      user_id: mockUserId,
      plan_type: 'pro',
      status: 'active',
      credits_available: 1000,
      started_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockSub, error: null });
    
    const mockUpdatedSub = { ...mockSub, status: 'expired' };
    mockSupabase.single.mockResolvedValueOnce({ data: mockUpdatedSub, error: null });

    const sub = await getUserSubscription(mockUserId);
    expect(sub.status).toBe('expired');
  });

  it('ativa ou atualiza uma nova assinatura (activateSubscription)', async () => {
    // Caso de nova inserção (maybeSingle retorna nulo)
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    
    const mockNewSub = {
      id: 'new-sub',
      user_id: mockUserId,
      plan_type: 'pro',
      status: 'active',
      credits_available: PLAN_CREDITS.pro,
    };
    mockSupabase.single.mockResolvedValueOnce({ data: mockNewSub, error: null });

    const sub = await activateSubscription(mockUserId, 'pro');
    expect(sub.plan_type).toBe('pro');
    expect(sub.credits_available).toBe(1000);
  });

  it('verifica se tem créditos disponíveis (hasAvailableCredits)', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { plan_type: 'starter', status: 'active', credits_available: 5 },
      error: null,
    });

    const hasCredits = await hasAvailableCredits(mockUserId);
    expect(hasCredits).toBe(true);
  });

  it('consome crédito de uma assinatura ativa via RPC', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

    const ok = await consumeCredits(mockUserId);
    expect(ok).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_subscription_credit', {
      user_id_param: mockUserId,
    });
  });

  it('evita consumo concorrente simultâneo se saldo = 1 (apenas um sucesso)', async () => {
    // Primeira chamada retorna true (sucesso), segunda retorna false (sem saldo restante)
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    const [first, second] = await Promise.all([
      consumeCredits(mockUserId),
      consumeCredits(mockUserId)
    ]);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('consome a quantidade exata de páginas via RPC consumePages', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

    const ok = await consumePages(mockUserId, 230);
    expect(ok).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_subscription_pages', {
      user_id_param: mockUserId,
      pages_count: 230
    });
  });

  it('consumePages retorna false se o saldo for insuficiente', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: false, error: null });

    const ok = await consumePages(mockUserId, 5000);
    expect(ok).toBe(false);
  });

  it('consumePages não chama RPC se pagesCount <= 0', async () => {
    const ok = await consumePages(mockUserId, 0);
    expect(ok).toBe(false);
    expect(mockSupabase.rpc).not.toHaveBeenCalledWith('consume_subscription_pages', expect.anything());
  });
});
