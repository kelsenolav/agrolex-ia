import { runTrialReminderJob } from '../trialReminderJob';

// Sem RESEND_API_KEY, sendTrialReminderEmail cai no caminho log_only
// (determinístico, sem rede) — contado como "enviado" no job.
const ORIGINAL_RESEND_KEY = process.env.RESEND_API_KEY;

function buildAdminMock({ leadsResult, analysesResult, updateSpy }: {
  leadsResult: { data: unknown; error: unknown };
  analysesResult: { data: unknown; error: unknown };
  updateSpy?: jest.Mock;
}) {
  const from = jest.fn((table: string) => {
    let isUpdate = false;
    const builder: Record<string, unknown> = {
      select: jest.fn(() => builder),
      not: jest.fn(() => builder),
      eq: jest.fn((...args: unknown[]) => {
        if (isUpdate && updateSpy) updateSpy(table, ...args);
        return builder;
      }),
      lte: jest.fn(() => builder),
      in: jest.fn(() => builder),
      update: jest.fn((payload: unknown) => {
        isUpdate = true;
        if (updateSpy) updateSpy(table, 'update', payload);
        return builder;
      }),
      then: (resolve: (v: unknown) => void) => {
        if (isUpdate) return resolve({ error: null });
        if (table === 'marketing_leads') return resolve(leadsResult);
        if (table === 'analyses') return resolve(analysesResult);
        return resolve({ data: null, error: null });
      },
    };
    return builder;
  });
  return { from } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('runTrialReminderJob', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    if (ORIGINAL_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_RESEND_KEY;
  });

  const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  it('sem leads candidatos → nada avaliado', async () => {
    const admin = buildAdminMock({
      leadsResult: { data: [], error: null },
      analysesResult: { data: [], error: null },
    });
    const r = await runTrialReminderJob(admin);
    expect(r).toEqual({ avaliados: 0, enviados: 0, pulados: 0, falhas: [] });
  });

  it('lead com análise concluída → pulado (não é caso de abandono)', async () => {
    const admin = buildAdminMock({
      leadsResult: {
        data: [{ id: 'l1', email: 'a@x.com', nome: 'A', user_id: 'u1', created_at: tresDiasAtras, metadata: {} }],
        error: null,
      },
      analysesResult: { data: [{ user_id: 'u1', status: 'completed' }], error: null },
    });
    const r = await runTrialReminderJob(admin);
    expect(r.avaliados).toBe(1);
    expect(r.pulados).toBe(1);
    expect(r.enviados).toBe(0);
  });

  it('lead exatamente no achado real (trial_started x3, zero analyses) → envia lembrete segmento iniciou_sem_concluir e persiste marco', async () => {
    const updateSpy = jest.fn();
    const admin = buildAdminMock({
      leadsResult: {
        data: [{
          id: 'l2',
          email: 'angelopapa@gmail.com',
          nome: 'Angelo',
          user_id: 'u2',
          created_at: tresDiasAtras,
          metadata: {
            commercial_events: [
              { type: 'trial_started', timestamp: '2026-06-19T17:04:52.868Z' },
              { type: 'trial_started', timestamp: '2026-06-19T17:11:18.934Z' },
              { type: 'trial_started', timestamp: '2026-06-19T17:15:15.550Z' },
            ],
          },
        }],
        error: null,
      },
      analysesResult: { data: [], error: null },
      updateSpy,
    });

    const r = await runTrialReminderJob(admin);

    expect(r.avaliados).toBe(1);
    expect(r.enviados).toBe(1);
    expect(r.pulados).toBe(0);
    expect(r.falhas).toEqual([]);
    // Persistiu o marco enviado em metadata.trial_reminder (sem apagar commercial_events)
    const updateCall = updateSpy.mock.calls.find((c) => c[1] === 'update');
    expect(updateCall).toBeDefined();
    const payload = updateCall![2] as { metadata: { trial_reminder: { milestones_sent: number[] }; commercial_events: unknown[] } };
    expect(payload.metadata.trial_reminder.milestones_sent).toEqual([3]);
    expect(payload.metadata.commercial_events).toHaveLength(3);
  });

  it('achado real: trial_completed no historico mas analyses table sem linha concluida (analise deletada depois) → pulado, NUNCA diz "voce ainda nao usou"', async () => {
    const admin = buildAdminMock({
      leadsResult: {
        data: [{
          id: 'l5',
          email: 'teste1@gmail.com',
          nome: 'teste1',
          user_id: 'u5',
          created_at: tresDiasAtras,
          metadata: {
            commercial_events: [
              { type: 'trial_started' },
              { type: 'trial_completed' },
              { type: 'result_partial_view' },
            ],
          },
        }],
        error: null,
      },
      // A análise foi deletada depois — a tabela `analyses` não tem mais nenhuma linha concluída
      analysesResult: { data: [], error: null },
    });
    const r = await runTrialReminderJob(admin);
    expect(r.avaliados).toBe(1);
    expect(r.pulados).toBe(1);
    expect(r.enviados).toBe(0);
  });

  it('marco já enviado antes → pulado (não reenvia no mesmo marco)', async () => {
    const admin = buildAdminMock({
      leadsResult: {
        data: [{
          id: 'l3',
          email: 'b@x.com',
          nome: 'B',
          user_id: 'u3',
          created_at: tresDiasAtras,
          metadata: { trial_reminder: { milestones_sent: [3] } },
        }],
        error: null,
      },
      analysesResult: { data: [], error: null },
    });
    const r = await runTrialReminderJob(admin);
    expect(r.enviados).toBe(0);
    expect(r.pulados).toBe(1);
  });

  it('erro na query de leads → retorna falha sem lançar exceção', async () => {
    const admin = buildAdminMock({
      leadsResult: { data: null, error: { message: 'boom' } },
      analysesResult: { data: [], error: null },
    });
    const r = await runTrialReminderJob(admin);
    expect(r.falhas[0]).toContain('boom');
  });

  it('erro na query de analyses → retorna falha sem lançar exceção', async () => {
    const admin = buildAdminMock({
      leadsResult: {
        data: [{ id: 'l4', email: 'c@x.com', nome: 'C', user_id: 'u4', created_at: tresDiasAtras, metadata: {} }],
        error: null,
      },
      analysesResult: { data: null, error: { message: 'kaboom' } },
    });
    const r = await runTrialReminderJob(admin);
    expect(r.falhas[0]).toContain('kaboom');
  });
});
