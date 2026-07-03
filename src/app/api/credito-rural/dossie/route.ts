import { NextRequest, NextResponse } from 'next/server';
import { authGate, persistAnalise } from '@/lib/creditoRural/apiHelpers';
import {
  fetchCarPolygon,
  fetchEmbargosIbama,
  fetchNeighborCars,
  fetchTerrasIndigenas,
  fetchUnidadesConservacao,
  ufFromCarCode,
  type LayerFetchResult,
} from '@/lib/geo/geoProviders';
import { computeOverlaps } from '@/lib/geo/overlapEngine';
import { legalReadingFor } from '@/lib/geo/overlapLegalReading';
import { computeDossieVerdict, type FonteStatus } from '@/lib/creditoRural/dossieEngine';
import { consultarDesmatamentoTerraBrasilis } from '@/lib/monitoring/externalDataProviders';
import bboxFn from '@turf/bbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function statusDe(r: PromiseSettledResult<LayerFetchResult>): { status: FonteStatus; erro?: string } {
  if (r.status === 'rejected') return { status: 'falhou', erro: String(r.reason) };
  return { status: r.value.status, erro: r.value.erro };
}

/**
 * POST { car_code, property_id?, embargo_autodeclarado? }
 * Gera o Dossiê de Conformidade CMN 5.193 por propriedade/operação:
 * sobreposições (aposta 1) + DETER ao vivo + status CAR → veredito
 * determinístico (apto / apto_com_ressalvas / impedido) + saneamento.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await authGate(req);
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const carCode = String(body.car_code ?? '').trim().toUpperCase();
    const propertyId = body.property_id ? String(body.property_id) : null;
    const embargoAutodeclarado = body.embargo_autodeclarado === true;

    const uf = ufFromCarCode(carCode);
    if (!carCode || !uf) {
      return NextResponse.json({ error: 'Informe um código CAR válido (formato UF-CCCCCCC-HASH).' }, { status: 400 });
    }

    const carResult = await fetchCarPolygon(carCode);
    if (carResult.status === 'falhou') {
      return NextResponse.json({ error: `Falha ao consultar a base pública do CAR: ${carResult.erro}` }, { status: 502 });
    }
    if (carResult.status === 'nao_encontrado' || !carResult.feature) {
      return NextResponse.json({ error: 'Código CAR não encontrado na base pública espelhada.' }, { status: 404 });
    }

    const property = carResult.feature;
    const box = bboxFn(property) as [number, number, number, number];

    const [tisR, ucsR, embR, vizR, deterR] = await Promise.allSettled([
      fetchTerrasIndigenas(box),
      fetchUnidadesConservacao(box),
      fetchEmbargosIbama(property),
      fetchNeighborCars(property, carCode),
      consultarDesmatamentoTerraBrasilis({ city: carResult.municipio ?? undefined, state: uf }),
    ]);

    const feats = (r: PromiseSettledResult<LayerFetchResult>) => (r.status === 'fulfilled' ? r.value.features : []);
    const deter = deterR.status === 'fulfilled' ? deterR.value : null;

    const overlaps = computeOverlaps({
      property,
      terrasIndigenas: feats(tisR),
      unidadesConservacao: feats(ucsR),
      embargos: feats(embR),
      carsVizinhos: feats(vizR),
    });

    const fontes = {
      car_imovel: { status: 'consultada' as FonteStatus },
      terras_indigenas: statusDe(tisR),
      unidades_conservacao: statusDe(ucsR),
      embargos_ibama: statusDe(embR),
      cars_vizinhos: statusDe(vizR),
      deter_desmatamento: {
        status: (deter?.verificado ? 'consultada' : 'falhou') as FonteStatus,
        erro: deter?.erro,
      },
      incra_sigef: {
        status: 'indisponivel' as FonteStatus,
        erro: 'Acervo fundiário INCRA indisponível — parcelas SIGEF/assentamentos NÃO verificados nesta versão.',
      },
    };

    const dossie = computeDossieVerdict({
      sobreposicoes: overlaps.achados,
      fontes,
      car_status: carResult.statusImovel,
      alertas_deter: (deter?.alertas ?? []).map((a) => ({ data: a.data, area_ha: a.area_ha, fonte: a.fonte })),
      deter_verificado: !!deter?.verificado,
      embargo_autodeclarado: embargoAutodeclarado,
    });

    const resultado = {
      car_code: carCode,
      municipio: carResult.municipio ?? null,
      status_imovel_car: carResult.statusImovel ?? null,
      area_imovel_ha: overlaps.area_imovel_ha,
      veredito: dossie.veredito,
      resumo: dossie.resumo,
      impedimentos: dossie.impedimentos,
      ressalvas: dossie.ressalvas,
      lacunas_de_verificacao: dossie.lacunas_de_verificacao,
      sobreposicoes: overlaps.achados.map((a) => ({
        classe: a.classe,
        severidade: a.severidade,
        nome: a.nome,
        area_sobreposta_ha: a.area_sobreposta_ha,
        percentual_imovel: a.percentual_imovel,
        leitura_juridica: legalReadingFor(a),
      })),
      alertas_deter: deter?.alertas ?? [],
      fontes,
      disclaimer: dossie.disclaimer,
      gerado_em: new Date().toISOString(),
    };

    const analiseId = await persistAnalise(gate.supabase, {
      user_id: gate.user.id,
      property_id: propertyId,
      tipo: 'dossie',
      faixa: dossie.veredito,
      input: { car_code: carCode, embargo_autodeclarado: embargoAutodeclarado },
      resultado,
    });

    return NextResponse.json({ ok: true, analise_id: analiseId, resultado });
  } catch (err) {
    console.error('[credito-rural/dossie]', err);
    return NextResponse.json({ error: 'Erro interno ao gerar o dossiê' }, { status: 500 });
  }
}
