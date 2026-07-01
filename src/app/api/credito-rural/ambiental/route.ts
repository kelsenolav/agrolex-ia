import { NextRequest, NextResponse } from 'next/server';
import { verificarConformidadeAmbiental, type EnvironmentalInput } from '@/lib/creditoRural/environmentalEngine';
import { authGate, persistAnalise } from '@/lib/creditoRural/apiHelpers';
import { consultarCAR, consultarDesmatamentoTerraBrasilis } from '@/lib/monitoring/externalDataProviders';

export async function POST(req: NextRequest) {
  try {
    const gate = await authGate(req);
    if (!gate.ok) return gate.response;

    const body = await req.json() as EnvironmentalInput & { property_id?: string; city?: string; car_code?: string };

    if (!body.uf || body.area_total_ha === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios: uf, area_total_ha' }, { status: 400 });
    }

    // Consultas ao vivo em fontes públicas oficiais — melhor esforço, nunca
    // bloqueiam a resposta (Promise.allSettled). Ver AGENTS.md para o porquê do
    // embargo IBAMA não entrar aqui (sem API pública de consulta programática hoje).
    const [desmatamentoOutcome, carOutcome] = await Promise.allSettled([
      consultarDesmatamentoTerraBrasilis({ city: body.city, state: body.uf }),
      body.car_code ? consultarCAR({ car_code: body.car_code }) : Promise.resolve(null),
    ]);

    const desmatamento = desmatamentoOutcome.status === 'fulfilled' ? desmatamentoOutcome.value : null;
    const car = carOutcome.status === 'fulfilled' ? carOutcome.value : null;

    const enrichedInput: EnvironmentalInput = {
      ...body,
      alertas_prodes: desmatamento?.verificado
        ? desmatamento.alertas.map(a => ({
            ano: parseInt(a.data.slice(0, 4), 10) || new Date().getFullYear(),
            area_ha: a.area_ha,
            bioma: a.fonte === 'DETER-AMZ' ? 'Amazônia' : 'Cerrado',
            fonte: a.fonte,
          }))
        : body.alertas_prodes,
      desmatamento_verificado_api: !!desmatamento?.verificado,
      car_verificado_api: !!car?.found,
      car_status: car?.status ?? body.car_status,
    };

    const resultado = verificarConformidadeAmbiental(enrichedInput);

    const analiseId = await persistAnalise(gate.supabase, {
      user_id: gate.user.id,
      property_id: body.property_id ?? null,
      tipo: 'ambiental',
      input: enrichedInput,
      resultado,
    });

    return NextResponse.json({
      ok: true,
      resultado,
      analise_id: analiseId,
      fontes_externas: { desmatamento, car },
    });
  } catch (err) {
    console.error('[credito-rural/ambiental]', err);
    return NextResponse.json({ error: 'Erro interno ao verificar conformidade ambiental' }, { status: 500 });
  }
}
