import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CREDIT_PROGRAMS,
  DOCUMENTOS_BASE,
  getProgramById,
  getProgramsByRegiao,
  getDocumentosParaPrograma,
  getRegiaoByUF,
} from '@/lib/creditoRural/knowledgeBase';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const programaId = searchParams.get('programa');
    const uf = searchParams.get('uf');

    if (programaId) {
      const programa = getProgramById(programaId as Parameters<typeof getProgramById>[0]);
      if (!programa) {
        return NextResponse.json({ error: 'Programa não encontrado' }, { status: 404 });
      }
      const docs = getDocumentosParaPrograma(programaId as Parameters<typeof getDocumentosParaPrograma>[0]);
      return NextResponse.json({ ok: true, programa, documentos: docs });
    }

    if (uf) {
      const regiao = getRegiaoByUF(uf);
      // getProgramsByRegiao espera a UF (não a região) — filtra por ufs_aplicaveis
      const programas = getProgramsByRegiao(uf);
      return NextResponse.json({ ok: true, programas, regiao, documentos_base: DOCUMENTOS_BASE });
    }

    return NextResponse.json({ ok: true, programas: CREDIT_PROGRAMS, documentos_base: DOCUMENTOS_BASE });
  } catch (err) {
    console.error('[credito-rural/conhecimento]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
