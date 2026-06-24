import {
  computeRenewalExpiry,
  daysUntilExpiry,
  isExpiringSoon,
  isExpired,
  parseRadarPropertyCount,
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
