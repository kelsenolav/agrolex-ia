import {
  classificarSegmentoTrial,
  diasDesde,
  proximoMarcoLembrete,
  MILESTONES_DIAS,
  normalizePhoneForWhatsApp,
  getWhatsAppReminderMessage,
} from '../trialReminder';

describe('classificarSegmentoTrial', () => {
  it('sem nenhum evento → nunca_iniciou', () => {
    expect(classificarSegmentoTrial([])).toBe('nunca_iniciou');
  });

  it('trial_started sem trial_completed → iniciou_sem_concluir', () => {
    expect(classificarSegmentoTrial([{ type: 'trial_started' }])).toBe('iniciou_sem_concluir');
  });

  it('trial_started e trial_completed → nunca_iniciou (já concluiu, não é caso de abandono)', () => {
    expect(classificarSegmentoTrial([{ type: 'trial_started' }, { type: 'trial_completed' }])).toBe('nunca_iniciou');
  });

  it('múltiplos trial_started (retries) sem completed → ainda iniciou_sem_concluir', () => {
    const events = [{ type: 'trial_started' }, { type: 'trial_started' }, { type: 'trial_started' }];
    expect(classificarSegmentoTrial(events)).toBe('iniciou_sem_concluir');
  });
});

describe('diasDesde', () => {
  const agora = new Date('2026-07-10T00:00:00Z').getTime();

  it('calcula dias corridos corretamente', () => {
    expect(diasDesde('2026-07-07T00:00:00Z', agora)).toBe(3);
  });

  it('data inválida retorna 0 (fail-safe, nunca dispara lembrete por engano)', () => {
    expect(diasDesde('not-a-date', agora)).toBe(0);
  });

  it('data no futuro retorna negativo (nunca bate marco)', () => {
    expect(diasDesde('2026-07-15T00:00:00Z', agora)).toBeLessThan(0);
  });
});

describe('proximoMarcoLembrete', () => {
  it('antes do primeiro marco → null', () => {
    expect(proximoMarcoLembrete(1, [])).toBeNull();
  });

  it('no primeiro marco, nenhum enviado ainda → retorna o primeiro marco', () => {
    expect(proximoMarcoLembrete(3, [])).toBe(MILESTONES_DIAS[0]);
  });

  it('primeiro marco já enviado, ainda não chegou no segundo → null', () => {
    expect(proximoMarcoLembrete(5, [3])).toBeNull();
  });

  it('chegou no segundo marco e o primeiro já foi enviado → retorna o segundo', () => {
    expect(proximoMarcoLembrete(10, [3])).toBe(MILESTONES_DIAS[1]);
  });

  it('ambos os marcos já enviados → null (nunca manda um terceiro)', () => {
    expect(proximoMarcoLembrete(30, [3, 10])).toBeNull();
  });

  it('cron atrasado (30 dias, nenhum marco enviado) → recupera o marco mais antigo primeiro, não pula direto pro último', () => {
    expect(proximoMarcoLembrete(30, [])).toBe(MILESTONES_DIAS[0]);
  });
});

describe('normalizePhoneForWhatsApp', () => {
  it('sem código do país → adiciona 55', () => {
    expect(normalizePhoneForWhatsApp('63999783534')).toBe('5563999783534');
  });

  it('já com 55 → não duplica', () => {
    expect(normalizePhoneForWhatsApp('5563999783534')).toBe('5563999783534');
  });

  it('remove parênteses/traço/espaço', () => {
    expect(normalizePhoneForWhatsApp('(63) 99978-3534')).toBe('5563999783534');
  });

  it('número torto (10 dígitos, faltando o 9) → normaliza sem tentar corrigir, nunca lança erro', () => {
    expect(normalizePhoneForWhatsApp('6381001043')).toBe('556381001043');
  });

  it('null/undefined/vazio → null (sem botão pra mostrar)', () => {
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
    expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
    expect(normalizePhoneForWhatsApp('')).toBeNull();
  });

  it('string sem nenhum dígito → null', () => {
    expect(normalizePhoneForWhatsApp('abc')).toBeNull();
  });
});

describe('getWhatsAppReminderMessage', () => {
  const URL = 'https://agrolexi.com.br/dashboard/nova-analise';

  it('segmento iniciou_sem_concluir menciona que a análise não terminou', () => {
    const msg = getWhatsAppReminderMessage('iniciou_sem_concluir', 'Angelo Luiz', URL);
    expect(msg).toContain('Oi, Angelo!');
    expect(msg.toLowerCase()).toContain('não chegou a terminar');
    expect(msg).toContain(URL);
  });

  it('segmento nunca_iniciou menciona que ainda não usou a análise gratuita', () => {
    const msg = getWhatsAppReminderMessage('nunca_iniciou', 'Maria', URL);
    expect(msg).toContain('Oi, Maria!');
    expect(msg.toLowerCase()).toContain('ainda não usou');
  });

  it('sem nome → saudação genérica, sem quebrar', () => {
    const msg = getWhatsAppReminderMessage('nunca_iniciou', undefined, URL);
    expect(msg).toContain('Oi, tudo bem!');
  });

  it('usa só o primeiro nome, mesmo com nome completo', () => {
    const msg = getWhatsAppReminderMessage('nunca_iniciou', 'Angelo Luiz Papa Parmejane', URL);
    expect(msg).toContain('Oi, Angelo!');
    expect(msg).not.toContain('Papa Parmejane');
  });
});
