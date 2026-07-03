/**
 * Motor de interseção da Análise de Sobreposição — PURO (sem I/O).
 *
 * Recebe o polígono do imóvel + candidatos por classe e devolve achados com
 * hectares/percentual sobrepostos e severidade determinística por faixa
 * (mesma postura do motor ISF: determinístico onde importa juridicamente).
 */

import area from '@turf/area';
import intersect from '@turf/intersect';
import bbox from '@turf/bbox';
import { featureCollection } from '@turf/helpers';
import type { GeoPoly } from './geoProviders';

export type OverlapClass = 'terra_indigena' | 'unidade_conservacao' | 'embargo_ibama' | 'car_vizinho';
export type OverlapSeverity = 'critica' | 'alta' | 'media' | 'baixa';

export interface OverlapFinding {
  classe: OverlapClass;
  severidade: OverlapSeverity;
  nome: string;
  area_sobreposta_ha: number;
  percentual_imovel: number; // 0-100
  marginal: boolean; // < 0,1 ha — reportada mas sinalizada
  atributos: Record<string, unknown>;
  geometria_intersecao: GeoPoly | null;
  /** Todas as partes da interseção (entidade multipolígono fatiada na fonte). */
  geometrias_intersecao?: GeoPoly[];
}

export interface OverlapInput {
  property: GeoPoly;
  terrasIndigenas: GeoPoly[];
  unidadesConservacao: GeoPoly[];
  embargos: GeoPoly[];
  carsVizinhos: GeoPoly[];
}

export interface OverlapResult {
  area_imovel_ha: number;
  bbox_imovel: [number, number, number, number];
  achados: OverlapFinding[];
  total_por_classe: Record<OverlapClass, number>;
}

const HA_PER_M2 = 1 / 10_000;
const MARGINAL_HA = 0.1;

function toHa(m2: number): number {
  return Math.round(m2 * HA_PER_M2 * 100) / 100;
}

function nameFor(classe: OverlapClass, props: Record<string, unknown>): string {
  switch (classe) {
    case 'terra_indigena':
      return String(props.terrai_nom ?? props.nome ?? 'Terra Indígena');
    case 'unidade_conservacao':
      return String(props.nome_uc ?? props.nomeuc ?? props.nome ?? 'Unidade de Conservação');
    case 'embargo_ibama':
      return `Embargo IBAMA TAD ${props.num_tad ?? 's/n'} (${props.nome_embargado ?? 'embargado não identificado'})`;
    case 'car_vizinho':
      return `CAR vizinho ${props.cod_imovel ?? 'desconhecido'}`;
  }
}

function severityFor(classe: OverlapClass, percentual: number, props: Record<string, unknown>): OverlapSeverity {
  if (classe === 'terra_indigena') return 'critica';
  if (classe === 'embargo_ibama') return 'alta';
  if (classe === 'unidade_conservacao') {
    // Proteção integral = crítica; uso sustentável = média (heurística por
    // categoria quando disponível; >10% do imóvel escala pra crítica).
    const categoria = String(props.categoria ?? props.grupo ?? '').toLowerCase();
    const protecaoIntegral = /integral|esta[çc][ãa]o ecol|reserva biol|parque/.test(categoria);
    return protecaoIntegral || percentual > 10 ? 'critica' : 'media';
  }
  // car_vizinho: sobreposição majoritária = possível CAR duplicado/conflito
  // dominial pleno (caso real achado no primeiro teste ao vivo: 99,8%).
  if (percentual > 50) return 'alta';
  return percentual > 5 ? 'media' : 'baixa';
}

function intersectOne(property: GeoPoly, candidate: GeoPoly): { ha: number; pct: number; geom: GeoPoly | null } | null {
  let overlap: GeoPoly | null = null;
  try {
    overlap = intersect(featureCollection([property, candidate])) as GeoPoly | null;
  } catch {
    // Geometria inválida da fonte (auto-interseção etc.) — trata como sem overlap calculável
    return null;
  }
  if (!overlap) return null;
  const m2 = area(overlap);
  if (m2 <= 0) return null;
  const propM2 = area(property);
  return {
    ha: toHa(m2),
    pct: propM2 > 0 ? Math.round((m2 / propM2) * 10_000) / 100 : 0,
    geom: overlap,
  };
}

export function computeOverlaps(input: OverlapInput): OverlapResult {
  const areaImovelHa = toHa(area(input.property));
  const box = bbox(input.property) as [number, number, number, number];

  const classes: Array<[OverlapClass, GeoPoly[]]> = [
    ['terra_indigena', input.terrasIndigenas],
    ['unidade_conservacao', input.unidadesConservacao],
    ['embargo_ibama', input.embargos],
    ['car_vizinho', input.carsVizinhos],
  ];

  // Agrega por classe+nome: a mesma entidade pode vir da fonte em várias
  // partes (multipolígono fatiado) — achado real de teste ao vivo: um CAR
  // vizinho aparecia 4x. Somamos áreas e recalculamos a severidade no total.
  const porChave = new Map<string, { classe: OverlapClass; nome: string; ha: number; pct: number; props: Record<string, unknown>; geoms: GeoPoly[] }>();

  for (const [classe, candidates] of classes) {
    for (const candidate of candidates) {
      const hit = intersectOne(input.property, candidate);
      if (!hit) continue;
      const props = (candidate.properties ?? {}) as Record<string, unknown>;
      const nome = nameFor(classe, props);
      const chave = `${classe}|${nome}`;
      const atual = porChave.get(chave);
      if (atual) {
        atual.ha = Math.round((atual.ha + hit.ha) * 100) / 100;
        atual.pct = Math.round((atual.pct + hit.pct) * 100) / 100;
        if (hit.geom) atual.geoms.push(hit.geom);
      } else {
        porChave.set(chave, { classe, nome, ha: hit.ha, pct: hit.pct, props, geoms: hit.geom ? [hit.geom] : [] });
      }
    }
  }

  const achados: OverlapFinding[] = Array.from(porChave.values()).map((v) => ({
    classe: v.classe,
    severidade: severityFor(v.classe, v.pct, v.props),
    nome: v.nome,
    area_sobreposta_ha: v.ha,
    percentual_imovel: Math.min(100, v.pct),
    marginal: v.ha < MARGINAL_HA,
    atributos: v.props,
    geometria_intersecao: v.geoms[0] ?? null,
    geometrias_intersecao: v.geoms,
  }));

  const ordem: Record<OverlapSeverity, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
  achados.sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || b.area_sobreposta_ha - a.area_sobreposta_ha);

  const total_por_classe = { terra_indigena: 0, unidade_conservacao: 0, embargo_ibama: 0, car_vizinho: 0 } as Record<OverlapClass, number>;
  for (const a of achados) total_por_classe[a.classe]++;

  return { area_imovel_ha: areaImovelHa, bbox_imovel: box, achados, total_por_classe };
}
