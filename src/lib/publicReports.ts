import 'server-only';
import { createHash } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,200}$/;

export type PublicReport = {
  propertyName: string;
  propertyLocation: string;
  status: string;
  riskLevel: string;
  resumo: string;
  createdAt: string;
};

export function hashPublicReportToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function getPublicReport(token: string): Promise<PublicReport | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return null;

  const supabaseAdmin = createSupabaseAdminClient();
  const tokenHash = hashPublicReportToken(token);
  const now = new Date().toISOString();

  const { data: link, error: linkError } = await supabaseAdmin
    .from('public_report_links')
    .select('id, analysis_id, access_count')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (linkError || !link) return null;

  const { data: analysis, error: analysisError } = await supabaseAdmin
    .from('analyses')
    .select('status, risk_level, findings, created_at, properties(name, city, state)')
    .eq('id', link.analysis_id)
    .maybeSingle();

  const findings = analysis?.findings as { resumo?: unknown } | null;
  const resumo = typeof findings?.resumo === 'string' ? findings.resumo.trim() : '';
  const status = analysis?.status?.toLowerCase();

  if (analysisError || !analysis || !['completed', 'concluido', 'concluído'].includes(status || '') || !resumo) {
    return null;
  }

  await supabaseAdmin
    .from('public_report_links')
    .update({
      last_accessed_at: now,
      access_count: (link.access_count || 0) + 1
    })
    .eq('id', link.id);

  const property = Array.isArray(analysis.properties) ? analysis.properties[0] : analysis.properties;
  const location = [property?.city, property?.state].filter(Boolean).join(', ');

  return {
    propertyName: property?.name || 'Imóvel rural',
    propertyLocation: location || 'Localização não informada',
    status: analysis.status || 'Concluído',
    riskLevel: analysis.risk_level || 'Não informado',
    resumo,
    createdAt: analysis.created_at
  };
}
