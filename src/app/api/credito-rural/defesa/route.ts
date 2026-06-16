import { NextRequest, NextResponse } from 'next/server';
import { analisarCedulaCredito } from '@/lib/creditoRural/defenseEngine';
import { authGate, persistAnalise } from '@/lib/creditoRural/apiHelpers';
import type { CedulaRawData } from '@/types/creditoRural';

export async function POST(req: NextRequest) {
  try {
    const gate = await authGate(req);
    if (!gate.ok) return gate.response;

    const body = await req.json() as CedulaRawData & { property_id?: string };

    if (!body.tipo_cedula || body.valor_principal === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios: tipo_cedula, valor_principal' }, { status: 400 });
    }

    const resultado = analisarCedulaCredito(body);

    const analiseId = await persistAnalise(gate.supabase, {
      user_id: gate.user.id,
      property_id: body.property_id ?? null,
      tipo: 'defesa',
      score: resultado.score_defesa,
      faixa: resultado.estrategia_recomendada,
      input: body,
      resultado,
    });

    return NextResponse.json({ ok: true, resultado, analise_id: analiseId });
  } catch (err) {
    console.error('[credito-rural/defesa]', err);
    return NextResponse.json({ error: 'Erro interno ao analisar cédula' }, { status: 500 });
  }
}
