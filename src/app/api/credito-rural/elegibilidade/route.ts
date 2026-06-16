import { NextRequest, NextResponse } from 'next/server';
import { calcularElegibilidadeCredito } from '@/lib/creditoRural/eligibilityEngine';
import { authGate, persistAnalise } from '@/lib/creditoRural/apiHelpers';
import type { CreditEligibilityInput } from '@/types/creditoRural';

export async function POST(req: NextRequest) {
  try {
    const gate = await authGate(req);
    if (!gate.ok) return gate.response;

    const body = await req.json() as CreditEligibilityInput & { property_id?: string };

    if (body.area_total_ha === undefined || body.uf === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios: area_total_ha, uf' }, { status: 400 });
    }

    const resultado = calcularElegibilidadeCredito(body);

    const analiseId = await persistAnalise(gate.supabase, {
      user_id: gate.user.id,
      property_id: body.property_id ?? null,
      tipo: 'elegibilidade',
      score: resultado.score,
      faixa: resultado.faixa,
      input: body,
      resultado,
      parametros_vigencia: resultado.parametros_vigencia,
    });

    return NextResponse.json({ ok: true, resultado, analise_id: analiseId });
  } catch (err) {
    console.error('[credito-rural/elegibilidade]', err);
    return NextResponse.json({ error: 'Erro interno ao calcular elegibilidade' }, { status: 500 });
  }
}
