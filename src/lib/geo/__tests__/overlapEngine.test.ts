import { computeOverlaps, type OverlapInput } from '../overlapEngine';
import { legalReadingFor, DISCLAIMER_SOBREPOSICAO } from '../overlapLegalReading';
import type { GeoPoly } from '../geoProviders';

// Quadrados em graus perto do equador (~1 grau ≈ 111,32 km) para áreas
// previsíveis. Usamos quadrados pequenos (0,01° ≈ 1,1132 km) pra minimizar
// distorção esférica: 0,01° × 0,01° ≈ 123,9 ha.
function square(minX: number, minY: number, size: number, props: Record<string, unknown> = {}): GeoPoly {
  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [minX, minY], [minX + size, minY], [minX + size, minY + size], [minX, minY + size], [minX, minY],
      ]],
    },
  };
}

const S = 0.01; // ~123,9 ha no equador
const PROP = square(-48.0, -0.005, S); // centrado no equador p/ simetria

function baseInput(over: Partial<OverlapInput> = {}): OverlapInput {
  return {
    property: PROP,
    terrasIndigenas: [],
    unidadesConservacao: [],
    embargos: [],
    carsVizinhos: [],
    ...over,
  };
}

describe('computeOverlaps — geometria determinística', () => {
  it('imóvel sem nenhuma sobreposição → zero achados, área calculada', () => {
    const r = computeOverlaps(baseInput());
    expect(r.achados).toHaveLength(0);
    expect(r.area_imovel_ha).toBeGreaterThan(100);
    expect(r.area_imovel_ha).toBeLessThan(140);
  });

  it('TI cobrindo metade do imóvel → ~50% e severidade crítica', () => {
    const metade = square(-48.0, -0.005, S / 2, { terrai_nom: 'TI Teste' });
    // metade em X, altura total:
    metade.geometry = square(-48.0, -0.005, S).geometry;
    (metade.geometry as GeoJSON.Polygon).coordinates = [[
      [-48.0, -0.005], [-48.0 + S / 2, -0.005], [-48.0 + S / 2, -0.005 + S], [-48.0, -0.005 + S], [-48.0, -0.005],
    ]];
    const r = computeOverlaps(baseInput({ terrasIndigenas: [metade] }));
    expect(r.achados).toHaveLength(1);
    expect(r.achados[0].classe).toBe('terra_indigena');
    expect(r.achados[0].severidade).toBe('critica');
    expect(r.achados[0].percentual_imovel).toBeGreaterThan(49);
    expect(r.achados[0].percentual_imovel).toBeLessThan(51);
    expect(r.achados[0].nome).toContain('TI Teste');
  });

  it('candidato SEM interseção real (adjacente) → não vira achado', () => {
    const vizinhoAdjacente = square(-48.0 + S, -0.005, S, { cod_imovel: 'TO-X' });
    const r = computeOverlaps(baseInput({ carsVizinhos: [vizinhoAdjacente] }));
    expect(r.achados).toHaveLength(0);
  });

  it('embargo qualquer % → severidade alta', () => {
    const canto = square(-48.0, -0.005, S / 10, { num_tad: '123', nome_embargado: 'Fulano' });
    const r = computeOverlaps(baseInput({ embargos: [canto] }));
    expect(r.achados[0].severidade).toBe('alta');
    expect(r.achados[0].percentual_imovel).toBeCloseTo(1, 0);
  });

  it('CAR vizinho ≤5% → baixa; >5% → média; >50% → alta (possível CAR duplicado)', () => {
    const pequeno = square(-48.0, -0.005, S / 5, { cod_imovel: 'TO-A' }); // 4%
    const grande = square(-48.0, -0.005, S / 3, { cod_imovel: 'TO-B' }); // ~11%
    const quaseTotal = square(-48.0, -0.005, S * 0.9, { cod_imovel: 'TO-C' }); // ~81%
    const r = computeOverlaps(baseInput({ carsVizinhos: [pequeno, grande, quaseTotal] }));
    const porNome = Object.fromEntries(r.achados.map(a => [String(a.atributos.cod_imovel), a.severidade]));
    expect(porNome['TO-A']).toBe('baixa');
    expect(porNome['TO-B']).toBe('media');
    expect(porNome['TO-C']).toBe('alta');
  });

  it('mesma entidade fatiada em várias partes → agregada num único achado (caso real de prod)', () => {
    const parte1 = square(-48.0, -0.005, S / 10, { cod_imovel: 'TO-DUP' });
    const parte2 = square(-48.0 + S / 2, -0.005, S / 10, { cod_imovel: 'TO-DUP' });
    const r = computeOverlaps(baseInput({ carsVizinhos: [parte1, parte2] }));
    expect(r.achados).toHaveLength(1);
    expect(r.achados[0].percentual_imovel).toBeCloseTo(2, 0); // 1% + 1%
    expect(r.achados[0].geometrias_intersecao).toHaveLength(2);
  });

  it('interseção < 0,1 ha → marcada como marginal, mas REPORTADA (honestidade)', () => {
    const minusculo = square(-48.0, -0.005, S / 500, { cod_imovel: 'TO-M' }); // ~0,0005 ha... usar maior
    const r = computeOverlaps(baseInput({ carsVizinhos: [square(-48.0, -0.005, S / 50, { cod_imovel: 'TO-M' })] }));
    expect(r.achados).toHaveLength(1);
    expect(r.achados[0].marginal).toBe(true);
    void minusculo;
  });

  it('UC de proteção integral (parque) → crítica mesmo com % baixo', () => {
    const canto = square(-48.0, -0.005, S / 10, { nome_uc: 'Parque Nacional X', categoria: 'Parque Nacional' });
    const r = computeOverlaps(baseInput({ unidadesConservacao: [canto] }));
    expect(r.achados[0].severidade).toBe('critica');
  });

  it('UC uso sustentável com % baixo → média', () => {
    const canto = square(-48.0, -0.005, S / 10, { nome_uc: 'APA Y', categoria: 'Área de Proteção Ambiental' });
    const r = computeOverlaps(baseInput({ unidadesConservacao: [canto] }));
    expect(r.achados[0].severidade).toBe('media');
  });

  it('ordena por severidade (crítica primeiro)', () => {
    const ti = square(-48.0, -0.005, S / 10, { terrai_nom: 'TI' });
    const viz = square(-48.0, -0.005, S / 20, { cod_imovel: 'TO-V' });
    const r = computeOverlaps(baseInput({ terrasIndigenas: [ti], carsVizinhos: [viz] }));
    expect(r.achados[0].classe).toBe('terra_indigena');
  });
});

describe('legalReadingFor — leitura determinística', () => {
  it('cada classe tem template com fundamento legal citado', () => {
    const base = { severidade: 'alta' as const, nome: 'x', area_sobreposta_ha: 10, percentual_imovel: 5, marginal: false, atributos: {}, geometria_intersecao: null };
    expect(legalReadingFor({ ...base, classe: 'terra_indigena' }).fundamento).toContain('231');
    expect(legalReadingFor({ ...base, classe: 'unidade_conservacao' }).fundamento).toContain('9.985');
    expect(legalReadingFor({ ...base, classe: 'embargo_ibama' }).fundamento).toContain('propter rem');
    expect(legalReadingFor({ ...base, classe: 'car_vizinho' }).fundamento).toContain('12.651');
  });

  it('consequência interpola área e percentual do achado', () => {
    const base = { classe: 'embargo_ibama' as const, severidade: 'alta' as const, nome: 'x', area_sobreposta_ha: 42.5, percentual_imovel: 13.7, marginal: false, atributos: {}, geometria_intersecao: null };
    const l = legalReadingFor(base);
    expect(l.consequencia).toContain('42.5');
    expect(l.consequencia).toContain('13.7');
  });

  it('disclaimer nunca promete mais do que a fonte permite', () => {
    expect(DISCLAIMER_SOBREPOSICAO).toContain('autodeclarat');
    expect(DISCLAIMER_SOBREPOSICAO).toContain('não substitui');
  });
});
