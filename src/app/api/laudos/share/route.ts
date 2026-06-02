import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { hashPublicReportToken } from '@/lib/publicReports';
import { createSupabaseUserClient } from '@/lib/supabaseServerUser';

const DEFAULT_EXPIRATION_DAYS = 15;
const MAX_EXPIRATION_DAYS = 30;

export async function POST(req: Request) {
  try {
    const supabaseUser = createSupabaseUserClient(req.headers.get('Authorization'));
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const analysisId = typeof body.analysisId === 'string' ? body.analysisId : '';
    const requestedDays = Number(body.expirationDays);
    const expirationDays = Number.isFinite(requestedDays)
      ? Math.min(Math.max(Math.trunc(requestedDays), 1), MAX_EXPIRATION_DAYS)
      : DEFAULT_EXPIRATION_DAYS;

    if (!analysisId) {
      return NextResponse.json({ error: 'Análise inválida.' }, { status: 400 });
    }

    const { data: analysis, error: analysisError } = await supabaseUser
      .from('analyses')
      .select('id, status, findings')
      .eq('id', analysisId)
      .eq('user_id', user.id)
      .maybeSingle();

    const findings = analysis?.findings as { resumo?: unknown } | null;
    const status = analysis?.status?.toLowerCase();
    const hasResumo = typeof findings?.resumo === 'string' && findings.resumo.trim().length > 0;

    if (
      analysisError
      || !analysis
      || !['completed', 'concluido', 'concluído'].includes(status || '')
      || !hasResumo
    ) {
      return NextResponse.json({ error: 'Parecer concluído não encontrado.' }, { status: 404 });
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: link, error: insertError } = await supabaseUser
      .from('public_report_links')
      .insert({
        analysis_id: analysis.id,
        user_id: user.id,
        token_hash: hashPublicReportToken(token),
        expires_at: expiresAt
      })
      .select('id, expires_at')
      .single();

    if (insertError || !link) {
      return NextResponse.json({ error: 'Não foi possível criar o link de compartilhamento.' }, { status: 500 });
    }

    const origin = new URL(req.url).origin;

    return NextResponse.json({
      linkId: link.id,
      url: `${origin}/laudo/publico/${token}`,
      expiresAt: link.expires_at
    });
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar o link de compartilhamento.' }, { status: 500 });
  }
}
