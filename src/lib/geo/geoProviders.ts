/**
 * Provedores geoespaciais públicos para a Análise de Sobreposição.
 *
 * Endpoints validados AO VIVO em 2026-07-02 (ver spec
 * 2026-07-02-sobreposicao-georreferenciada-design.md) — nada aqui é suposto:
 * - Polígono do imóvel: camada CAR nacional espelhada no PAMGIA/IBAMA
 *   (ArcGIS REST, uma camada por UF, busca por cod_imovel exato).
 * - Embargos IBAMA ativos: SISCOM/publico camada 3 (desembargos e cancelados
 *   ficam em camadas separadas — nunca acusamos embargo já levantado).
 * - Terras Indígenas: geoserver FUNAI (WFS; exige User-Agent de browser).
 * - UCs federais: INDE/ICMBio (WFS).
 * - INCRA/SIGEF: fora do ar em todos os testes → não consultado na v1
 *   (proveniência 'indisponivel', nunca fingimos ter verificado).
 */

import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

export type GeoPoly = Feature<Polygon | MultiPolygon>;

export interface LayerFetchResult {
  status: 'consultada' | 'falhou';
  features: GeoPoly[];
  erro?: string;
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const PAMGIA_BASE = 'https://pamgia.ibama.gov.br/server/rest/services';
const CAR_SERVICE = `${PAMGIA_BASE}/CAR_NACIONAL/Cadastro_Ambiental_Rural__%C3%81rea_Im%C3%B3vel_/MapServer`;
const EMBARGOS_LAYER = `${PAMGIA_BASE}/SISCOM/publico/MapServer/3`;
const FUNAI_WFS = 'https://geoserver.funai.gov.br/geoserver/ows';
const INDE_ICMBIO_WFS = 'https://geoservicos.inde.gov.br/geoserver/ICMBio/ows';

// Índice da camada CAR por UF no serviço PAMGIA (extraído do metadata real).
const CAR_LAYER_BY_UF: Record<string, number> = {
  TO: 0, SP: 1, SE: 2, SC: 3, RS: 4, RR: 5, RO: 6, RN: 7, RJ: 8, PR: 9,
  PI: 10, PE: 11, PB: 12, PA: 13, MT: 14, MS: 15, MG: 16, MA: 17, GO: 18,
  ES: 19, DF: 20, CE: 21, BA: 22, AP: 23, AM: 24, AL: 25, AC: 26,
};

const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Form-encode com %20 para espaços. O ArcGIS Server do PAMGIA falha
 * ("Failed to execute query") quando o espaço vem como '+' (padrão do
 * URLSearchParams) na cláusula where — descoberto em teste ao vivo.
 */
function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

function polyFeatures(fc: unknown): GeoPoly[] {
  const features = (fc as FeatureCollection | null)?.features ?? [];
  return features.filter(
    (f): f is GeoPoly => f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon',
  );
}

/** Extrai a UF de um código CAR (formato `UF-CCCCCCC-HASH`). */
export function ufFromCarCode(carCode: string): string | null {
  const m = carCode.trim().toUpperCase().match(/^([A-Z]{2})-\d{7}-/);
  return m && CAR_LAYER_BY_UF[m[1]] !== undefined ? m[1] : null;
}

export interface CarPolygonResult {
  status: 'encontrado' | 'nao_encontrado' | 'falhou';
  feature?: GeoPoly;
  statusImovel?: string;
  municipio?: string;
  erro?: string;
}

/** Busca o polígono do imóvel pelo código CAR exato. */
export async function fetchCarPolygon(carCode: string): Promise<CarPolygonResult> {
  const code = carCode.trim().toUpperCase();
  const uf = ufFromCarCode(code);
  if (!uf) return { status: 'falhou', erro: 'Código CAR inválido (esperado UF-CCCCCCC-HASH)' };

  const layer = CAR_LAYER_BY_UF[uf];
  const params = formEncode({
    where: `cod_imovel = '${code.replace(/'/g, "''")}'`,
    // ATENÇÃO: outFields com campo inexistente derruba a query inteira no
    // ArcGIS ("Failed to execute query") — só listar campos confirmados no metadata.
    outFields: 'cod_imovel,ind_status_imovel,nom_municipio',
    returnGeometry: 'true',
    f: 'geojson',
  });

  try {
    const res = await fetchWithTimeout(`${CAR_SERVICE}/${layer}/query`, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) return { status: 'falhou', erro: `HTTP ${res.status}` };
    const data = await res.json();
    const feats = polyFeatures(data);
    if (feats.length === 0) return { status: 'nao_encontrado' };
    const f = feats[0];
    const props = (f.properties ?? {}) as Record<string, unknown>;
    return {
      status: 'encontrado',
      feature: f,
      statusImovel: (props.ind_status_imovel as string) ?? undefined,
      municipio: (props.nom_municipio as string) ?? undefined,
    };
  } catch (err: unknown) {
    return { status: 'falhou', erro: err instanceof Error ? err.message : String(err) };
  }
}

/** Busca CARs de imóveis em um ponto (fallback "clicar no mapa"). */
export async function fetchCarAtPoint(lon: number, lat: number, uf: string): Promise<LayerFetchResult> {
  const layer = CAR_LAYER_BY_UF[uf.toUpperCase()];
  if (layer === undefined) return { status: 'falhou', features: [], erro: `UF sem camada CAR: ${uf}` };
  const params = formEncode({
    where: '1=1',
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'cod_imovel,ind_status_imovel,nom_municipio',
    returnGeometry: 'true',
    resultRecordCount: '5',
    f: 'geojson',
  });
  try {
    const res = await fetchWithTimeout(`${CAR_SERVICE}/${layer}/query`, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) return { status: 'falhou', features: [], erro: `HTTP ${res.status}` };
    return { status: 'consultada', features: polyFeatures(await res.json()) };
  } catch (err: unknown) {
    return { status: 'falhou', features: [], erro: err instanceof Error ? err.message : String(err) };
  }
}

/** CARs vizinhos que intersectam o polígono do imóvel (conflito de limites). */
export async function fetchNeighborCars(property: GeoPoly, carCode: string): Promise<LayerFetchResult> {
  const uf = ufFromCarCode(carCode);
  if (!uf) return { status: 'falhou', features: [], erro: 'UF indeterminada' };
  const layer = CAR_LAYER_BY_UF[uf];
  const params = formEncode({
    where: `cod_imovel <> '${carCode.trim().toUpperCase().replace(/'/g, "''")}'`,
    geometry: JSON.stringify(arcgisPolygonFrom(property)),
    geometryType: 'esriGeometryPolygon',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'cod_imovel,ind_status_imovel,nom_municipio',
    returnGeometry: 'true',
    resultRecordCount: '25',
    f: 'geojson',
  });
  try {
    const res = await fetchWithTimeout(`${CAR_SERVICE}/${layer}/query`, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) return { status: 'falhou', features: [], erro: `HTTP ${res.status}` };
    return { status: 'consultada', features: polyFeatures(await res.json()) };
  } catch (err: unknown) {
    return { status: 'falhou', features: [], erro: err instanceof Error ? err.message : String(err) };
  }
}

/** Embargos IBAMA ATIVOS que intersectam o imóvel (camada 3; desembargos ficam fora). */
export async function fetchEmbargosIbama(property: GeoPoly): Promise<LayerFetchResult> {
  const params = formEncode({
    where: '1=1',
    geometry: JSON.stringify(arcgisPolygonFrom(property)),
    geometryType: 'esriGeometryPolygon',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    // '*' confirmado na sonda ao vivo; listar campos à mão arrisca derrubar a
    // query inteira se um nome não existir (comportamento do ArcGIS do PAMGIA).
    outFields: '*',
    returnGeometry: 'true',
    resultRecordCount: '50',
    f: 'geojson',
  });
  try {
    const res = await fetchWithTimeout(`${EMBARGOS_LAYER}/query`, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 40_000);
    if (!res.ok) return { status: 'falhou', features: [], erro: `HTTP ${res.status}` };
    return { status: 'consultada', features: polyFeatures(await res.json()) };
  } catch (err: unknown) {
    return { status: 'falhou', features: [], erro: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * URL WFS 1.0.0 com bbox em lon,lat (x,y). Testado ao vivo: o geoserver da
 * FUNAI rejeita WFS 2.0 sem sortBy ("Cannot do natural order without a
 * primary key") — o 1.0.0 dispensa ordenação e usa o eixo x,y clássico.
 */
function wfsBboxUrl(base: string, typeName: string, bbox: [number, number, number, number]): string {
  const [minX, minY, maxX, maxY] = bbox;
  const params = formEncode({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName,
    outputFormat: 'application/json',
    bbox: `${minX},${minY},${maxX},${maxY}`,
  });
  return `${base}?${params}`;
}

/** Terras Indígenas (FUNAI) no bbox do imóvel. */
export async function fetchTerrasIndigenas(bbox: [number, number, number, number]): Promise<LayerFetchResult> {
  try {
    const res = await fetchWithTimeout(wfsBboxUrl(FUNAI_WFS, 'Funai:tis_poligonais', bbox));
    if (!res.ok) return { status: 'falhou', features: [], erro: `HTTP ${res.status}` };
    return { status: 'consultada', features: polyFeatures(await res.json()) };
  } catch (err: unknown) {
    return { status: 'falhou', features: [], erro: err instanceof Error ? err.message : String(err) };
  }
}

/** Unidades de Conservação federais (ICMBio/INDE) no bbox do imóvel. */
export async function fetchUnidadesConservacao(bbox: [number, number, number, number]): Promise<LayerFetchResult> {
  try {
    const res = await fetchWithTimeout(wfsBboxUrl(INDE_ICMBIO_WFS, 'ICMBio:limiteucsfederais_a', bbox));
    if (!res.ok) return { status: 'falhou', features: [], erro: `HTTP ${res.status}` };
    return { status: 'consultada', features: polyFeatures(await res.json()) };
  } catch (err: unknown) {
    return { status: 'falhou', features: [], erro: err instanceof Error ? err.message : String(err) };
  }
}

/** Converte GeoJSON Polygon/MultiPolygon pro formato de geometria do ArcGIS REST. */
export function arcgisPolygonFrom(feature: GeoPoly): { rings: number[][][]; spatialReference: { wkid: number } } {
  const geom = feature.geometry;
  const rings: number[][][] =
    geom.type === 'Polygon'
      ? (geom.coordinates as number[][][])
      : (geom.coordinates as number[][][][]).flat();
  return { rings, spatialReference: { wkid: 4326 } };
}
