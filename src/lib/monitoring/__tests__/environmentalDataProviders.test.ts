/**
 * Testes de consultarDesmatamentoTerraBrasilis (WFS público do TerraBrasilis/INPE).
 *
 * Endpoints e schema (municipality/uf/view_date/classname/areamunkm) verificados
 * ao vivo em 01/07/2026 — ver AGENTS.md. Aqui mockamos fetch para não bater na
 * rede real durante o CI.
 */
import { consultarDesmatamentoTerraBrasilis } from '../externalDataProviders';

function geoJsonResponse(features: Array<Record<string, unknown>>) {
  return {
    ok: true,
    json: async () => ({ type: 'FeatureCollection', features, totalFeatures: features.length }),
  };
}

function feature(props: Record<string, unknown>) {
  return { type: 'Feature', properties: props };
}

describe('consultarDesmatamentoTerraBrasilis', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('retorna erro claro quando município/UF não informados', async () => {
    const r = await consultarDesmatamentoTerraBrasilis({});
    expect(r.verificado).toBe(false);
    expect(r.erro).toMatch(/Município\/UF/);
  });

  it('consulta os dois workspaces (deter-amz e deter-cerrado-nb) e agrega alertas', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(geoJsonResponse([
        feature({ view_date: '2026-06-16', classname: 'DESMATAMENTO_CR', municipality: 'Wanderlandia', uf: 'TO', areamunkm: 0.1 }),
      ]))
      .mockResolvedValueOnce(geoJsonResponse([]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await consultarDesmatamentoTerraBrasilis({ city: 'Wanderlandia', state: 'TO' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.verificado).toBe(true);
    expect(r.alertas).toHaveLength(1);
    expect(r.alertas[0].fonte).toBe('DETER-AMZ');
    expect(r.alertas[0].area_ha).toBeCloseTo(10); // 0.1 km² = 10 ha
    expect(r.erro).toBeUndefined();
  });

  it('verificado=true mesmo sem nenhum alerta encontrado (checado e limpo)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(geoJsonResponse([]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await consultarDesmatamentoTerraBrasilis({ city: 'Palmas', state: 'TO' });
    expect(r.verificado).toBe(true);
    expect(r.alertas).toHaveLength(0);
  });

  it('ambos workspaces falham → verificado=false com erro agregado', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await consultarDesmatamentoTerraBrasilis({ city: 'Palmas', state: 'TO' });
    expect(r.verificado).toBe(false);
    expect(r.erro).toMatch(/network down/);
  });

  it('falha parcial (1 workspace ok, outro falha) ainda conta como verificado, com aviso', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(geoJsonResponse([]))
      .mockRejectedValueOnce(new Error('timeout'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await consultarDesmatamentoTerraBrasilis({ city: 'Palmas', state: 'TO' });
    expect(r.verificado).toBe(true);
    expect(r.erro).toMatch(/parcial/i);
  });
});
