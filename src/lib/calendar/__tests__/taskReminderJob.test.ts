import { diasAteVencimento, runCalendarReminderJob, MARCOS_CALENDARIO } from '../taskReminderJob';

// Sem RESEND_API_KEY, sendCalendarTaskReminder cai no caminho log_only
// (determinístico, sem rede) — contado como "enviado" no job.
const ORIGINAL_RESEND_KEY = process.env.RESEND_API_KEY;

function buildAdminMock(tasksResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    then: (resolve: (v: unknown) => void) => resolve(tasksResult),
  };
  return { from: jest.fn(() => builder) } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

// Gera uma due_date (YYYY-MM-DD local) a N dias de um "agora" fixo
const AGORA = new Date(2026, 6, 15, 10, 30).getTime(); // 15/07/2026 10:30 local
function dueDaquiADias(dias: number): string {
  const d = new Date(2026, 6, 15 + dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

describe('diasAteVencimento', () => {
  it('vence em 7 dias → 7', () => {
    expect(diasAteVencimento(dueDaquiADias(7), AGORA)).toBe(7);
  });

  it('vence hoje → 0 (mesmo com horas no relógio — compara só a data)', () => {
    expect(diasAteVencimento(dueDaquiADias(0), AGORA)).toBe(0);
  });

  it('vencida há 30 dias → negativo (não bate marco nenhum)', () => {
    expect(diasAteVencimento(dueDaquiADias(-30), AGORA)).toBe(-30);
  });

  it('data malformada → null (fail-safe)', () => {
    expect(diasAteVencimento('not-a-date', AGORA)).toBeNull();
  });
});

describe('runCalendarReminderJob', () => {
  beforeEach(() => { delete process.env.RESEND_API_KEY; });
  afterEach(() => {
    if (ORIGINAL_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_RESEND_KEY;
  });

  const perfil = { email: 'produtor@exemplo.com.br', name: 'Produtor' };
  const prop = { name: 'Fazenda Boa Vista' };

  it('tarefa exatamente num marco → envia', async () => {
    const admin = buildAdminMock({
      data: [{ id: 't1', title: 'Renovar licença', due_date: dueDaquiADias(3), profiles: perfil, properties: prop }],
      error: null,
    });
    const r = await runCalendarReminderJob(admin, AGORA);
    expect(r.avaliadas).toBe(1);
    expect(r.enviados).toBe(1);
    expect(r.falhas).toEqual([]);
  });

  it('tarefa fora dos marcos (ex: 5 dias) → pulada', async () => {
    const admin = buildAdminMock({
      data: [{ id: 't2', title: 'ITR', due_date: dueDaquiADias(5), profiles: perfil, properties: prop }],
      error: null,
    });
    const r = await runCalendarReminderJob(admin, AGORA);
    expect(r.enviados).toBe(0);
    expect(r.pulados).toBe(1);
  });

  it('tarefa vencida há tempos (caso real de prod: ITR vencido) → pulada, nunca dispara', async () => {
    const admin = buildAdminMock({
      data: [{ id: 't3', title: 'ITR', due_date: dueDaquiADias(-49), profiles: perfil, properties: prop }],
      error: null,
    });
    const r = await runCalendarReminderJob(admin, AGORA);
    expect(r.enviados).toBe(0);
    expect(r.pulados).toBe(1);
  });

  it('tarefa sem e-mail do dono → pulada sem falha', async () => {
    const admin = buildAdminMock({
      data: [{ id: 't4', title: 'CAR', due_date: dueDaquiADias(0), profiles: { email: null, name: null }, properties: prop }],
      error: null,
    });
    const r = await runCalendarReminderJob(admin, AGORA);
    expect(r.enviados).toBe(0);
    expect(r.pulados).toBe(1);
    expect(r.falhas).toEqual([]);
  });

  it('joins que voltam como array (formato PostgREST) → normalizados', async () => {
    const admin = buildAdminMock({
      data: [{ id: 't5', title: 'Outorga', due_date: dueDaquiADias(7), profiles: [perfil], properties: [prop] }],
      error: null,
    });
    const r = await runCalendarReminderJob(admin, AGORA);
    expect(r.enviados).toBe(1);
  });

  it('erro na query → falha registrada sem lançar exceção', async () => {
    const admin = buildAdminMock({ data: null, error: { message: 'boom' } });
    const r = await runCalendarReminderJob(admin, AGORA);
    expect(r.falhas[0]).toContain('boom');
  });

  it('marcos são 7/3/0 (contrato prometido na UI do Calendário)', () => {
    expect([...MARCOS_CALENDARIO]).toEqual([7, 3, 0]);
  });
});
