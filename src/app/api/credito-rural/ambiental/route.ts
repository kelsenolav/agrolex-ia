import { NextRequest, NextResponse } from 'next/server';
import { verificarConformidadeAmbiental, type EnvironmentalInput } from '@/lib/creditoRural/environmentalEngine';
import { authGate, persistAnalise } from '@/lib/creditoRural/apiHelpers';

export async function POST(req: NextRequest) {
  try {
    const gate = await authGate(req);
    if (!gate.ok) return gate.response;

    const body = await req.json() as EnvironmentalInput & { property_id?: string };

    if (!body.uf || body.area_total_ha === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios: uf, area_total_ha' }, { status: 400 });
    }

    const resultado = verificarConformidadeAmbiental(body);

    const analiseId = await persistAnalise(gate.supabase, {
      user_id: gate.user.id,
      property_id: body.property_id ?? null,
      tipo: 'ambiental',
      input: body,
      resultado,
    });

    return NextResponse.json({ ok: true, resultado, analise_id: analiseId });
  } catch (err) {
    console.error('[credito-rural/ambiental]', err);
    return NextResponse.json({ error: 'Erro interno ao verificar conformidade ambiental' }, { status: 500 });
  }
}
