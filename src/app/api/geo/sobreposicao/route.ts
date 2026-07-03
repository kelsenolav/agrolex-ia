import { NextRequest, NextResponse } from 'next/server';
import { authGate, persistAnalise } from '@/lib/creditoRural/apiHelpers';
import {
  fetchCarAtPoint,
  fetchCarPolygon,
  fetchEmbargosIbama,
  fetchNeighborCars,
  fetchTerrasIndigenas,
  fetchUnidadesConservacao,
  ufFromCarCode,
  type LayerFetchResult,
} from '@/lib/geo/geoProviders';
import { computeOverlaps } from '@/lib/geo/overlapEngine';
import { legalReadingFor, DISCLAIMER_SOBREPOSICAO } from '@/lib/geo/overlapLegalReading';
import bboxFn from '@turf/bbox';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type LayerStatus = 'consultada' | 'falhou' | 'indisponivel';

function statusDe(r: PromiseSettledResult<LayerFetchResult>): { status: LayerStatus; erro?: string } {
  if (r.status === 'rejected') return { status: 'falhou', erro: String(r.reason) };
  return { status: r.value.status, erro: r.value.erro };
}

/**
 * POST { car_code, property_id? } — executa a análise de sobreposição.
 * GET  ?id=<report_id>            — reabre um relatório persistido.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await authGate(req);
    if (!gate.ok) return gate.response;

    const body = await req.json();

    // Fallback "clicar no mapa": devolve os códigos CAR naquele ponto (sem persistir)
    if (body.mode === 'at_point') {
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      const uf = String(body.uf ?? '').toUpperCase();
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !uf) {
        return NextResponse.json({ error: 'Informe lat, lon e uf' }, { status: 400 });
      }
      const r = await fetchCarAtPoint(lon, lat, uf);
      if (r.status === 'falhou') {
        return NextResponse.json({ error: `Falha na consulta: ${r.erro}` }, { status: 502 });
      }
      const candidatos = r.features.map((f) => ({
        cod_imovel: String((f.properties as Record<string, unknown>)?.cod_imovel ?? ''),
        municipio: String((f.properties as Record<string, unknown>)?.nom_municipio ?? ''),
        status: String((f.properties as Record<string, unknown>)?.ind_status_imovel ?? ''),
      })).filter((c) => c.cod_imovel);
      return NextResponse.json({ ok: true, candidatos });
    }

    const carCode = String(body.car_code ?? '').trim().toUpperCase();
    const propertyId = body.property_id ? String(body.property_id) : null;

    if (!carCode || !ufFromCarCode(carCode)) {
      return NextResponse.json(
        { error: 'Informe um código CAR válido (formato UF-CCCCCCC-HASH).' },
        { status: 400 },
      );
    }

    // 1. Polígono do imóvel (fonte de tudo)
    const carResult = await fetchCarPolygon(carCode);
    if (carResult.status === 'falhou') {
      return NextResponse.json(
        { error: `Falha ao consultar a base pública do CAR: ${carResult.erro}. Tente novamente em instantes.` },
        { status: 502 },
      );
    }
    if (carResult.status === 'nao_encontrado' || !carResult.feature) {
      return NextResponse.json(
        { error: 'Código CAR não encontrado na base pública espelhada. Confira o código (ou o imóvel pode ter registro muito recente ainda não espelhado).' },
        { status: 404 },
      );
    }

    const property = carResult.feature;
    const box = bboxFn(property) as [number, number, number, number];

    // 2. Camadas de risco em paralelo — falha de uma nunca derruba o relatório
    const [tisR, ucsR, embR, vizR] = await Promise.allSettled([
      fetchTerrasIndigenas(box),
      fetchUnidadesConservacao(box),
      fetchEmbargosIbama(property),
      fetchNeighborCars(property, carCode),
    ]);

    const feats = (r: PromiseSettledResult<LayerFetchResult>) =>
      r.status === 'fulfilled' ? r.value.features : [];

    // 3. Interseções (motor puro)
    const overlaps = computeOverlaps({
      property,
      terrasIndigenas: feats(tisR),
      unidadesConservacao: feats(ucsR),
      embargos: feats(embR),
      carsVizinhos: feats(vizR),
    });

    // 4. Leitura jurídica determinística por achado
    const achados = overlaps.achados.map((a) => ({ ...a, leitura_juridica: legalReadingFor(a) }));

    const result = {
      car_code: carCode,
      status_imovel_car: carResult.statusImovel ?? null,
      municipio: carResult.municipio ?? null,
      area_imovel_ha: overlaps.area_imovel_ha,
      bbox_imovel: overlaps.bbox_imovel,
      geometria_imovel: property,
      achados,
      total_por_classe: overlaps.total_por_classe,
      fontes: {
        car_imovel: { status: 'consultada' as LayerStatus },
        terras_indigenas: statusDe(tisR),
        unidades_conservacao: statusDe(ucsR),
        embargos_ibama: statusDe(embR),
        cars_vizinhos: statusDe(vizR),
        // Honestidade: INCRA/SIGEF fora do ar em todos os testes de 2026-07-02.
        incra_sigef: { status: 'indisponivel' as LayerStatus, erro: 'Serviço público do acervo fundiário INCRA indisponível — sobreposição com parcelas SIGEF/assentamentos NÃO verificada nesta versão.' },
      },
      disclaimer: DISCLAIMER_SOBREPOSICAO,
      gerado_em: new Date().toISOString(),
    };

    // 5. Persiste (service role — RLS-safe pois grava com user_id do próprio usuário)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } },
    );
    const { data: saved, error: saveError } = await admin
      .from('geo_overlap_reports')
      .insert({ user_id: gate.user.id, property_id: propertyId, car_code: carCode, result })
      .select('id')
      .single();

    if (saveError) console.warn('[geo/sobreposicao] falha ao persistir (não bloqueante):', saveError.message);

    // Telemetria de uso no padrão do crédito rural (fail-safe)
    persistAnalise(gate.supabase, {
      user_id: gate.user.id,
      property_id: propertyId,
      tipo: 'ambiental',
      input: { car_code: carCode, feature: 'sobreposicao' },
      resultado: { achados: achados.length },
    }).catch(() => {});

    return NextResponse.json({ ok: true, report_id: saved?.id ?? null, resultado: result });
  } catch (err) {
    console.error('[geo/sobreposicao]', err);
    return NextResponse.json({ error: 'Erro interno na análise de sobreposição' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const gate = await authGate(req);
    if (!gate.ok) return gate.response;

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Informe o id do relatório' }, { status: 400 });

    const { data, error } = await gate.supabase
      .from('geo_overlap_reports')
      .select('id, car_code, property_id, result, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, report: data });
  } catch (err) {
    console.error('[geo/sobreposicao GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
