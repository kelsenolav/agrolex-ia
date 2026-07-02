/**
 * Testes do módulo Preapproval (assinatura recorrente MP) — fetch mockado,
 * nunca bate na API real. Contrato verificado na doc oficial do MP
 * (assinatura sem plano, pagamento pendente) — ver spec 2026-07-01.
 */
import {
  createPreapproval,
  getPreapproval,
  getAuthorizedPayment,
  cancelPreapproval,
} from '../mercadopagoPreapproval';

const ORIG_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const originalFetch = global.fetch;

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe('mercadopagoPreapproval', () => {
  beforeEach(() => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
  });
  afterEach(() => {
    if (ORIG_TOKEN === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    else process.env.MERCADOPAGO_ACCESS_TOKEN = ORIG_TOKEN;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('createPreapproval', () => {
    it('cria assinatura mensal pending e retorna id + init_point', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okJson({
        id: 'pre_123', init_point: 'https://mp.com/authorize/pre_123', status: 'pending',
      }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const r = await createPreapproval({
        reason: 'AgrolexI Radar — 2 propriedades/mês',
        external_reference: 'user-abc',
        payer_email: 'cliente@x.com',
        transaction_amount: 99.8,
        back_url: 'https://agrolexi.com.br/dashboard/radar?subscription=pending',
      });

      expect(r).toEqual({ preapprovalId: 'pre_123', initPoint: 'https://mp.com/authorize/pre_123' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.mercadopago.com/preapproval');
      const body = JSON.parse(init.body);
      expect(body.status).toBe('pending'); // sem cartão — cliente autoriza no redirect
      expect(body.external_reference).toBe('user-abc');
      expect(body.auto_recurring).toEqual({
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 99.8,
        currency_id: 'BRL',
      });
    });

    it('resposta sem init_point → erro claro (nunca retorna checkout quebrado)', async () => {
      global.fetch = jest.fn().mockResolvedValue(okJson({ id: 'pre_123' })) as unknown as typeof fetch;
      await expect(createPreapproval({
        reason: 'x', external_reference: 'u', payer_email: 'a@b.c', transaction_amount: 49.9, back_url: 'https://x',
      })).rejects.toThrow(/init_point/);
    });

    it('HTTP não-ok → lança erro com status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false, status: 400, statusText: 'Bad Request', json: async () => ({ message: 'invalid' }),
      }) as unknown as typeof fetch;
      await expect(createPreapproval({
        reason: 'x', external_reference: 'u', payer_email: 'a@b.c', transaction_amount: 49.9, back_url: 'https://x',
      })).rejects.toThrow(/400/);
    });

    it('sem MERCADOPAGO_ACCESS_TOKEN → lança erro de configuração', async () => {
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
      await expect(createPreapproval({
        reason: 'x', external_reference: 'u', payer_email: 'a@b.c', transaction_amount: 49.9, back_url: 'https://x',
      })).rejects.toThrow(/MERCADOPAGO_ACCESS_TOKEN/);
    });
  });

  describe('getPreapproval / getAuthorizedPayment', () => {
    it('consulta preapproval pelo id', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okJson({ id: 'pre_1', status: 'authorized', external_reference: 'user-abc' }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const r = await getPreapproval('pre_1');
      expect(r.status).toBe('authorized');
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.mercadopago.com/preapproval/pre_1');
    });

    it('consulta cobrança recorrente pelo id', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okJson({
        id: 'ap_9', preapproval_id: 'pre_1', status: 'processed', payment: { status: 'approved' },
      }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const r = await getAuthorizedPayment('ap_9');
      expect(r.preapproval_id).toBe('pre_1');
      expect(r.payment?.status).toBe('approved');
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.mercadopago.com/authorized_payments/ap_9');
    });
  });

  describe('cancelPreapproval', () => {
    it('envia PUT status cancelled', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okJson({ id: 'pre_1', status: 'cancelled' }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const r = await cancelPreapproval('pre_1');
      expect(r.status).toBe('cancelled');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.mercadopago.com/preapproval/pre_1');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ status: 'cancelled' });
    });

    it('falha do MP → lança (o caller NÃO deve marcar cancelado no banco)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false, status: 500, statusText: 'Internal', json: async () => ({}),
      }) as unknown as typeof fetch;
      await expect(cancelPreapproval('pre_1')).rejects.toThrow(/500/);
    });
  });
});
