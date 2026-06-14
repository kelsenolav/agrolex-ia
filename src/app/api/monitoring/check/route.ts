import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPropertyCheck } from '@/lib/monitoring/monitoringEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

    const body = await req.json();
    const { propertyId } = body;
    if (!propertyId) return NextResponse.json({ error: 'propertyId obrigatório' }, { status: 400 });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Buscar propriedade
    const { data: property, error: propError } = await adminClient
      .from('properties')
      .select('id, name, city, state, user_id, last_radar_isf_score, is_monitoring')
      .eq('id', propertyId)
      .single();

    if (propError || !property) return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 });
    if (property.user_id !== user.id) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    // Buscar análises da propriedade
    const { data: analyses } = await adminClient
      .from('analyses')
      .select('id, status, completed_at, isf_score, findings, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(10);

    const result = runPropertyCheck(property, analyses || [], property.last_radar_isf_score ?? null);

    // Persistir novos alertas (evitar duplicatas por tipo no mesmo dia)
    const today = new Date().toISOString().slice(0, 10);
    const { data: existingAlerts } = await adminClient
      .from('monitoring_alerts')
      .select('alert_type')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);

    const existingTypes = new Set((existingAlerts || []).map((a: any) => a.alert_type));
    const newAlerts = result.alerts.filter(a => !existingTypes.has(a.alert_type));

    if (newAlerts.length > 0) {
      await adminClient.from('monitoring_alerts').insert(
        newAlerts.map(a => ({
          user_id: user.id,
          property_id: propertyId,
          alert_type: a.alert_type,
          severity: a.severity,
          title: a.title,
          description: a.description,
          metadata: a.metadata,
        }))
      );
    }

    // Atualizar last_radar_check_at e last_radar_isf_score na propriedade
    await adminClient.from('properties').update({
      is_monitoring: true,
      last_radar_check_at: new Date().toISOString(),
      last_radar_isf_score: result.latestIsfScore ?? property.last_radar_isf_score,
      last_radar_analysis_id: result.latestAnalysisId,
    }).eq('id', propertyId);

    return NextResponse.json({
      success: true,
      result,
      newAlertsCount: newAlerts.length,
    });
  } catch (err: any) {
    console.error('[Monitoring Check]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
