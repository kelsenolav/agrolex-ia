import { analisarCedulaCredito } from '../defenseEngine';
import type { CedulaRawData } from '@/types/creditoRural';

function baseCedula(over: Partial<CedulaRawData> = {}): CedulaRawData {
  return {
    tipo_cedula: 'CCR',
    credor: 'Banco do Brasil S/A',
    devedor: 'João Produtor',
    valor_principal: 100_000,
    taxa_juros_contratual: 8,
    taxa_mora_contratual: 1,
    data_emissao: '2023-01-10',
    data_vencimento: '2025-01-10',
    capitalizacao_juros: false,
    ...over,
  };
}

describe('defenseEngine — vícios formais (DL 167/67)', () => {
  it('cédula completa não gera vício formal', () => {
    const r = analisarCedulaCredito(baseCedula({ bens_vinculados: 'Safra de soja', praca_pagamento: 'Goiânia/GO' }));
    expect(r.defects.filter(d => d.type === 'formal').length).toBe(0);
  });

  it('campo obrigatório ausente gera vício formal crítico', () => {
    const r = analisarCedulaCredito(baseCedula({ credor: '' }));
    const formais = r.defects.filter(d => d.type === 'formal');
    expect(formais.length).toBeGreaterThan(0);
    expect(formais[0].severity).toBe('critico');
  });
});

describe('defenseEngine — juros e anatocismo', () => {
  it('mora acima de 1% a.a. é abusiva e estima excesso', () => {
    const r = analisarCedulaCredito(baseCedula({ taxa_mora_contratual: 12 }));
    expect(r.juros.excesso_detectado).toBe(true);
    expect(r.juros.valor_excesso_estimado).toBeGreaterThan(0);
    expect(r.defects.some(d => d.type === 'abusivo')).toBe(true);
  });

  it('mora de exatamente 1% a.a. não é abusiva', () => {
    const r = analisarCedulaCredito(baseCedula({ taxa_mora_contratual: 1 }));
    expect(r.juros.excesso_detectado).toBe(false);
  });

  it('capitalização de juros é detectada como anatocismo', () => {
    const r = analisarCedulaCredito(baseCedula({ capitalizacao_juros: true }));
    expect(r.juros.anatocismo_detectado).toBe(true);
    expect(r.defects.some(d => /anatocismo|capitaliza/i.test(d.titulo))).toBe(true);
  });
});

describe('defenseEngine — prescrição', () => {
  it('dívida vencida há mais de 3 anos está prescrita', () => {
    const r = analisarCedulaCredito(baseCedula({ data_emissao: '2018-01-01', data_vencimento: '2019-01-01' }));
    expect(r.prescricao.prescrita).toBe(true);
    expect(r.estrategia_recomendada).toBe('excecao_pre_executividade');
  });

  it('dívida recente não está prescrita', () => {
    const r = analisarCedulaCredito(baseCedula({ data_emissao: '2024-01-01', data_vencimento: '2030-01-01' }));
    expect(r.prescricao.prescrita).toBe(false);
    expect(r.prescricao.dias_restantes).toBeGreaterThan(0);
  });

  it('data de vencimento inválida não quebra o motor', () => {
    const r = analisarCedulaCredito(baseCedula({ data_vencimento: 'data-invalida' }));
    expect(r.prescricao.prescrita).toBe(false);
    expect(r).toHaveProperty('score_defesa');
  });
});

describe('defenseEngine — score, estratégia e contrato', () => {
  it('score de defesa entre 0 e 100', () => {
    const cenarios = [
      baseCedula(),
      baseCedula({ taxa_mora_contratual: 50, capitalizacao_juros: true, credor: '' }),
      baseCedula({ data_vencimento: '2010-01-01' }),
    ];
    for (const c of cenarios) {
      const r = analisarCedulaCredito(c);
      expect(r.score_defesa).toBeGreaterThanOrEqual(0);
      expect(r.score_defesa).toBeLessThanOrEqual(100);
    }
  });

  it('prescrição → estratégia exceção de pré-executividade', () => {
    const r = analisarCedulaCredito(baseCedula({ data_vencimento: '2010-01-01' }));
    expect(r.estrategia_recomendada).toBe('excecao_pre_executividade');
  });

  it('vício formal → estratégia embargos', () => {
    const r = analisarCedulaCredito(baseCedula({ data_vencimento: '2030-01-01', valor_principal: 0 }));
    expect(r.estrategia_recomendada).toBe('embargos');
  });

  it('sempre retorna disclaimer jurídico', () => {
    const r = analisarCedulaCredito(baseCedula());
    expect(r.disclaimer.length).toBeGreaterThan(20);
    expect(r.disclaimer.toLowerCase()).toContain('advogado');
  });
});
