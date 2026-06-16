import { calcularElegibilidadeCredito } from '../eligibilityEngine';
import type { CreditEligibilityInput } from '@/types/creditoRural';

function baseInput(over: Partial<CreditEligibilityInput> = {}): CreditEligibilityInput {
  return {
    matricula_limpa: true,
    onus_count: 0,
    onus_types: [],
    hipotecas_vigentes: 0,
    penhoras_vigentes: 0,
    area_total_ha: 100,
    area_gravada_ha: 0,
    car_ativo: true,
    ccir_vigente: true,
    itr_regular: true,
    dap_caf_valida: false,
    tipo_produtor: 'medio',
    uf: 'GO',
    credito_rural_vigente: false,
    inadimplencia_credito_rural: false,
    cadin_serasa: false,
    prodes_clean: true,
    embargo_ibama: false,
    ...over,
  };
}

describe('eligibilityEngine — score e faixas', () => {
  it('produtor regular e limpo → score alto e elegível', () => {
    const r = calcularElegibilidadeCredito(baseInput());
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(['elegivel', 'premium', 'condicional']).toContain(r.faixa);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('CADIN/SERASA é veto absoluto → score ≤ 5', () => {
    const r = calcularElegibilidadeCredito(baseInput({ cadin_serasa: true }));
    expect(r.score).toBeLessThanOrEqual(5);
    expect(r.faixa).toBe('inelegivel');
  });

  it('embargo IBAMA cria barreira ambiental e teto de 15', () => {
    const r = calcularElegibilidadeCredito(baseInput({ embargo_ibama: true }));
    expect(r.barreira_ambiental).toBe(true);
    expect(r.score).toBeLessThanOrEqual(15);
  });

  it('desmatamento (prodes_clean=false) cria barreira e teto de 25', () => {
    const r = calcularElegibilidadeCredito(baseInput({ prodes_clean: false }));
    expect(r.barreira_ambiental).toBe(true);
    expect(r.score).toBeLessThanOrEqual(25);
  });

  it('penhora vigente derruba regularidade fundiária', () => {
    const limpo = calcularElegibilidadeCredito(baseInput());
    const comPenhora = calcularElegibilidadeCredito(baseInput({ penhoras_vigentes: 1, matricula_limpa: false }));
    expect(comPenhora.score).toBeLessThan(limpo.score);
    expect(comPenhora.axes.regularidade_fundiaria.score).toBeLessThan(limpo.axes.regularidade_fundiaria.score);
  });

  it('score sempre entre 0 e 100', () => {
    const cenarios = [
      baseInput({ car_ativo: false, ccir_vigente: false, itr_regular: false, cadin_serasa: true, penhoras_vigentes: 5 }),
      baseInput({ area_total_ha: 0 }),
      baseInput({ dap_caf_valida: true, tipo_produtor: 'familiar' }),
    ];
    for (const c of cenarios) {
      const r = calcularElegibilidadeCredito(c);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('eligibilityEngine — matching de programas', () => {
  it('Pronaf elegível só com DAP/CAF + produtor familiar', () => {
    const semDap = calcularElegibilidadeCredito(baseInput({ tipo_produtor: 'familiar', dap_caf_valida: false }));
    const comDap = calcularElegibilidadeCredito(baseInput({ tipo_produtor: 'familiar', dap_caf_valida: true }));
    const pronafSem = semDap.programas_elegiveis.find(p => p.programa_id === 'pronaf');
    const pronafCom = comDap.programas_elegiveis.find(p => p.programa_id === 'pronaf');
    expect(pronafSem?.elegivel).toBe(false);
    expect(pronafCom?.elegivel).toBe(true);
  });

  it('Pronamp inelegível acima do teto de renda', () => {
    const r = calcularElegibilidadeCredito(baseInput({ tipo_produtor: 'medio', renda_bruta_anual: 99_000_000 }));
    const pronamp = r.programas_elegiveis.find(p => p.programa_id === 'pronamp');
    expect(pronamp?.elegivel).toBe(false);
  });

  it('GO (centro-oeste) oferece FCO como fundo constitucional', () => {
    const r = calcularElegibilidadeCredito(baseInput({ uf: 'GO' }));
    expect(r.programas_elegiveis.some(p => p.programa_id === 'fco')).toBe(true);
  });

  it('TO (norte) oferece FNO', () => {
    const r = calcularElegibilidadeCredito(baseInput({ uf: 'TO' }));
    expect(r.programas_elegiveis.some(p => p.programa_id === 'fno')).toBe(true);
  });

  it('valor estimado nunca excede o teto da linha', () => {
    const r = calcularElegibilidadeCredito(baseInput({ tipo_produtor: 'familiar', dap_caf_valida: true, area_total_ha: 100000 }));
    const pronaf = r.programas_elegiveis.find(p => p.programa_id === 'pronaf');
    expect(pronaf?.valor_max_estimado).not.toBeNull();
    expect(pronaf?.valor_max_estimado ?? 0).toBeLessThanOrEqual(500_000);
  });
});

describe('eligibilityEngine — proveniência e disclaimer', () => {
  it('marca origem_dados_matricula quando origem_matricula=true', () => {
    const r = calcularElegibilidadeCredito(baseInput({ origem_matricula: true }));
    expect(r.origem_dados_matricula).toBe(true);
  });
  it('sempre retorna disclaimer e vigência', () => {
    const r = calcularElegibilidadeCredito(baseInput());
    expect(r.disclaimer.length).toBeGreaterThan(20);
    expect(r.parametros_vigencia).toContain('Plano Safra');
  });
});
