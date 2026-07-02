import {
  computeRenewalExpiry,
  daysUntilExpiry,
  isExpiringSoon,
  isExpired,
  parseRadarPropertyCount,
  radarLifecycleState,
  isEffectivelyActive,
  shouldSkipManualRenewalReminder,
} from '../radarRenewal';

const NOW = Date.parse('2026-06-24T12:00:00.000Z');
const DIA = 24 * 60 * 60 * 1000;

describe('computeRenewalExpiry', () => {
  it('assinatura nova (sem expires_at) → conta a partir de agora + 30d', () => {
    const exp = computeRenewalExpiry(null, NOW);
    expect(Date.parse(exp)).toBe(NOW + 30 * DIA);
  });

  it('renovação ANTECIPADA (ainda vigente) → estende a partir do expires_at atual (não perde tempo)', () => {
    const atual = new Date(NOW + 10 * DIA).toISOString(); // expira em 10 dias
    const exp = computeRenewalExpiry(atual, NOW);
    expect(Date.parse(exp)).toBe(NOW + 10 * DIA + 30 * DIA); // 40 dias a partir de agora
  });

  it('assinatura JÁ expirada → conta a partir de agora (não acumula o passado)', () => {
    const atual = new Date(NOW - 5 * DIA).toISOString(); // expirou há 5 dias
    const exp = computeRenewalExpiry(atual, NOW);
    expect(Date.parse(exp)).toBe(NOW + 30 * DIA);
  });

  it('data inválida → trata como nova', () => {
    expect(Date.parse(computeRenewalExpiry('lixo', NOW))).toBe(NOW + 30 * DIA);
  });
});

describe('daysUntilExpiry / isExpiringSoon / isExpired', () => {
  it('conta dias corretamente', () => {
    expect(daysUntilExpiry(new Date(NOW + 5 * DIA).toISOString(), NOW)).toBe(5);
    expect(daysUntilExpiry(new Date(NOW - 2 * DIA).toISOString(), NOW)).toBe(-2);
    expect(daysUntilExpiry(null, NOW)).toBeNull();
  });

  it('isExpiringSoon: dentro de 7 dias e não expirado', () => {
    expect(isExpiringSoon(new Date(NOW + 3 * DIA).toISOString(), NOW)).toBe(true);
    expect(isExpiringSoon(new Date(NOW + 10 * DIA).toISOString(), NOW)).toBe(false); // longe
    expect(isExpiringSoon(new Date(NOW - 1 * DIA).toISOString(), NOW)).toBe(false); // já expirou
  });

  it('isExpired', () => {
    expect(isExpired(new Date(NOW - 1 * DIA).toISOString(), NOW)).toBe(true);
    expect(isExpired(new Date(NOW + 1 * DIA).toISOString(), NOW)).toBe(false);
  });
});

describe('radarLifecycleState / isEffectivelyActive', () => {
  const at = (dias: number) => new Date(NOW + dias * DIA).toISOString();
  it('classifica os estados do ciclo de vida (graça=3, soon=7)', () => {
    expect(radarLifecycleState(at(20), NOW)).toBe('active');
    expect(radarLifecycleState(at(5), NOW)).toBe('expiring_soon');
    expect(radarLifecycleState(at(0), NOW)).toBe('expiring_soon'); // vence hoje, ainda não passou
    expect(radarLifecycleState(at(-1), NOW)).toBe('grace'); // venceu, dentro da graça
    expect(radarLifecycleState(at(-3), NOW)).toBe('grace'); // limite da graça
    expect(radarLifecycleState(at(-4), NOW)).toBe('expired'); // passou da graça
    expect(radarLifecycleState(null, NOW)).toBe('active'); // sem data → não cortar
  });
  it('isEffectivelyActive: ativa durante graça, inativa após', () => {
    expect(isEffectivelyActive(at(-2), NOW)).toBe(true); // graça
    expect(isEffectivelyActive(at(-5), NOW)).toBe(false); // expirada
    expect(isEffectivelyActive(at(10), NOW)).toBe(true);
  });
});

describe('parseRadarPropertyCount', () => {
  it('extrai a quantidade do payment_method', () => {
    expect(parseRadarPropertyCount('radar_3_properties')).toBe(3);
    expect(parseRadarPropertyCount('radar_1_properties')).toBe(1);
  });
  it('fallback para 1 quando malformado', () => {
    expect(parseRadarPropertyCount('plan_pro')).toBe(1);
    expect(parseRadarPropertyCount(null)).toBe(1);
    expect(parseRadarPropertyCount('radar_0_properties')).toBe(1);
  });
});

describe('shouldSkipManualRenewalReminder (Preapproval)', () => {
  it('renovação automática ativa → PULA o lembrete manual (MP cobra sozinho)', () => {
    expect(shouldSkipManualRenewalReminder('active', 'pre_123', 'expiring_soon')).toBe(true);
    expect(shouldSkipManualRenewalReminder('active', 'pre_123', 'grace')).toBe(true);
    expect(shouldSkipManualRenewalReminder('active', 'pre_123', 'active')).toBe(true);
  });
  it('sem preapproval (renovação manual legada) → NÃO pula', () => {
    expect(shouldSkipManualRenewalReminder('active', null, 'expiring_soon')).toBe(false);
    expect(shouldSkipManualRenewalReminder('active', undefined, 'grace')).toBe(false);
  });
  it('paused (cobrança automática falhou) → NÃO pula (dunning)', () => {
    expect(shouldSkipManualRenewalReminder('paused', 'pre_123', 'expiring_soon')).toBe(false);
  });
  it('expirada pós-graça → NÃO pula (win-back), mesmo com preapproval', () => {
    expect(shouldSkipManualRenewalReminder('active', 'pre_123', 'expired')).toBe(false);
  });
});
