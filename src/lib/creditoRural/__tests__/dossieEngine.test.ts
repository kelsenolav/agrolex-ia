import { computeDossieVerdict, type DossieInput } from '../dossieEngine';
import type { OverlapFinding } from '@/lib/geo/overlapEngine';

function finding(classe: OverlapFinding['classe'], severidade: OverlapFinding['severidade'], pct = 10): OverlapFinding {
  return {
    classe,
    severidade,
    nome: `${classe} teste`,
    area_sobreposta_ha: 12.3,
    percentual_imovel: pct,
    marginal: false,
    atributos: {},
    geometria_intersecao: null,
  };
}

function baseInput(over: Partial<DossieInput> = {}): DossieInput {
  return {
    sobreposicoes: [],
    fontes: {
      car_imovel: { status: 'consultada' },
      terras_indigenas: { status: 'consultada' },
      unidades_conservacao: { status: 'consultada' },
      embargos_ibama: { status: 'consultada' },
      cars_vizinhos: { status: 'consultada' },
    },
    car_status: 'AT',
    alertas_deter: [],
    deter_verificado: true,
    ...over,
  };
}

describe('computeDossieVerdict — regras CMN determinísticas', () => {
  it('tudo limpo e todas as fontes consultadas → apto', () => {
    const r = computeDossieVerdict(baseInput());
    expect(r.veredito).toBe('apto');
    expect(r.impedimentos).toHaveLength(0);
    expect(r.ressalvas).toHaveLength(0);
    expect(r.lacunas_de_verificacao).toHaveLength(0);
  });

  it('embargo IBAMA georreferenciado → impedido, com saneamento', () => {
    const r = computeDossieVerdict(baseInput({ sobreposicoes: [finding('embargo_ibama', 'alta')] }));
    expect(r.veredito).toBe('impedido');
    expect(r.impedimentos[0].codigo).toBe('EMBARGO_GEO');
    expect(r.impedimentos[0].saneamento.length).toBeGreaterThan(20);
  });

  it('embargo autodeclarado sem confirmação geo → impedido do mesmo jeito', () => {
    const r = computeDossieVerdict(baseInput({ embargo_autodeclarado: true }));
    expect(r.veredito).toBe('impedido');
    expect(r.impedimentos[0].codigo).toBe('EMBARGO_DECLARADO');
  });

  it('sobreposição com TI → impedido (nulidade constitucional)', () => {
    const r = computeDossieVerdict(baseInput({ sobreposicoes: [finding('terra_indigena', 'critica', 3)] }));
    expect(r.veredito).toBe('impedido');
    expect(r.impedimentos[0].base_normativa).toContain('231');
  });

  it('UC crítica → impedido; UC não-crítica → ressalva', () => {
    const critica = computeDossieVerdict(baseInput({ sobreposicoes: [finding('unidade_conservacao', 'critica')] }));
    expect(critica.veredito).toBe('impedido');
    const leve = computeDossieVerdict(baseInput({ sobreposicoes: [finding('unidade_conservacao', 'media', 4)] }));
    expect(leve.veredito).toBe('apto_com_ressalvas');
  });

  it('CAR cancelado → impedido; CAR pendente → ressalva', () => {
    expect(computeDossieVerdict(baseInput({ car_status: 'CA' })).veredito).toBe('impedido');
    expect(computeDossieVerdict(baseInput({ car_status: 'PE' })).veredito).toBe('apto_com_ressalvas');
  });

  it('alerta DETER recente → ressalva (não bloqueia sozinho)', () => {
    const r = computeDossieVerdict(baseInput({ alertas_deter: [{ data: '2026-06-16', area_ha: 11.7, fonte: 'DETER-AMZ' }] }));
    expect(r.veredito).toBe('apto_com_ressalvas');
    expect(r.ressalvas[0].codigo).toBe('DETER_ALERTA');
  });

  it('CAR vizinho sobrepondo >50% (severidade alta) → ressalva de conflito dominial', () => {
    const r = computeDossieVerdict(baseInput({ sobreposicoes: [finding('car_vizinho', 'alta', 99.8)] }));
    expect(r.veredito).toBe('apto_com_ressalvas');
    expect(r.ressalvas[0].codigo).toBe('CONFLITO_DOMINIAL');
  });

  it('HONESTIDADE: fonte fora do ar NUNCA vira apto pleno', () => {
    const r = computeDossieVerdict(baseInput({
      fontes: { ...baseInput().fontes, terras_indigenas: { status: 'falhou', erro: 'HTTP 500' } },
    }));
    expect(r.veredito).toBe('apto_com_ressalvas');
    expect(r.lacunas_de_verificacao[0]).toContain('terras_indigenas');
  });

  it('DETER não verificado → lacuna registrada, nunca apto', () => {
    const r = computeDossieVerdict(baseInput({ deter_verificado: false }));
    expect(r.veredito).toBe('apto_com_ressalvas');
    expect(r.lacunas_de_verificacao.join()).toContain('deter');
  });

  it('impedimento tem precedência sobre ressalva e lacuna', () => {
    const r = computeDossieVerdict(baseInput({
      sobreposicoes: [finding('embargo_ibama', 'alta'), finding('car_vizinho', 'alta', 60)],
      deter_verificado: false,
    }));
    expect(r.veredito).toBe('impedido');
    expect(r.ressalvas.length).toBeGreaterThan(0);
    expect(r.lacunas_de_verificacao.length).toBeGreaterThan(0);
  });

  it('todo impedimento e ressalva carrega base normativa e saneamento', () => {
    const r = computeDossieVerdict(baseInput({
      sobreposicoes: [finding('embargo_ibama', 'alta'), finding('terra_indigena', 'critica'), finding('unidade_conservacao', 'media')],
      car_status: 'PE',
      alertas_deter: [{ data: '2026-06-01', area_ha: 5, fonte: 'DETER-Cerrado' }],
    }));
    for (const item of [...r.impedimentos, ...r.ressalvas]) {
      expect(item.base_normativa.length).toBeGreaterThan(5);
      expect(item.saneamento.length).toBeGreaterThan(20);
    }
  });
});
