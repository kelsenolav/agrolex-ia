import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPropertyCheck } from '@/lib/monitoring/monitoringEngine';
import { runExternalChecks, type PropertyParams, type AnalysisFindings } from '@/lib/monitoring/externalDataProviders';
import { sendRadarNotification } from '@/lib/monitoring/notificationService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Configuração Supabase incompleta' }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: monitoredProps, error: propsError } = await adminClient
    .from('properties')
    .select('id, name, city, state, area, user_id, is_monitoring, last_radar_isf_score, last_radar_check_at, car_code, ccir, sigef_code, cpf_cnpj, matricula_number, registry_office')
    .eq('is_monitoring', true);

  if (propsError || !monitoredProps) {
    return NextResponse.json({ error: propsError?.message || 'Erro ao buscar propriedades' }, { status: 500 });
  }

  const results: Array<{
    property_id: string;
    property_name: string;
    user_id: string;
    alerts_created: number;
    external_sources: string[];
    notification: string;
    error?: string;
  }> = [];

  for (const prop of monitoredProps) {
    try {
      const { data: analyses } = await adminClient
        .from('analyses')
        .select('id, status, completed_at, isf_score, findings, created_at')
        .eq('property_id', prop.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const internalResult = runPropertyCheck(
        prop,
        analyses || [],
        prop.last_radar_isf_score ?? null
      );

      const latestCompleted = (analyses || []).find(a => a.status === 'completed');
      const findings: AnalysisFindings = latestCompleted?.findings || {};

      const propertyParams: PropertyParams = {
        name: prop.name,
        city: prop.city,
        state: prop.state,
        car_code: prop.car_code,
        ccir: prop.ccir,
        sigef_code: prop.sigef_code,
        cpf_cnpj: prop.cpf_cnpj,
        matricula_number: prop.matricula_number,
        registry_office: prop.registry_office,
      };

      const externalResult = await runExternalChecks(propertyParams, findings);

      const allAlerts = [
        ...internalResult.alerts.map(a => ({
          alert_type: a.alert_type,
          severity: a.severity,
          title: a.title,
          description: a.description,
          metadata: a.metadata,
        })),
        ...externalResult.new_alerts,
      ];

      const today = new Date().toISOString().slice(0, 10);
      const { data: existingAlerts } = await adminClient
        .from('monitoring_alerts')
        .select('alert_type')
        .eq('property_id', prop.id)
        .eq('user_id', prop.user_id)
        .gte('created_at', `${today}T00:00:00Z`);

      const existingTypes = new Set((existingAlerts || []).map((a: { alert_type: string }) => a.alert_type));

      const newAlerts = allAlerts.filter(a => !existingTypes.has(a.alert_type));

      if (newAlerts.length > 0) {
        await adminClient.from('monitoring_alerts').insert(
          newAlerts.map(a => ({
            user_id: prop.user_id,
            property_id: prop.id,
            alert_type: a.alert_type,
            severity: a.severity,
            title: a.title,
            description: a.description,
            metadata: {
              ...a.metadata,
              external_check: externalResult.timestamp,
              sources_consulted: externalResult.sources_consulted,
              sources_success: externalResult.sources_success,
            },
          }))
        );
      }

      const latestIsf = internalResult.latestIsfScore;
      await adminClient
        .from('properties')
        .update({
          last_radar_check_at: new Date().toISOString(),
          ...(latestIsf != null ? { last_radar_isf_score: latestIsf } : {}),
          ...(internalResult.latestAnalysisId ? { last_radar_analysis_id: internalResult.latestAnalysisId } : {}),
        })
        .eq('id', prop.id);

      let notifResult = 'skip';
      if (newAlerts.some(a => a.severity === 'critical' || a.severity === 'warning')) {
        const { data: userProfile } = await adminClient
          .from('profiles')
          .select('full_name')
          .eq('id', prop.user_id)
          .single();

        const { data: authUser } = await adminClient.auth.admin.getUserById(prop.user_id);

        if (authUser?.user?.email) {
          const notif = await sendRadarNotification({
            user_email: authUser.user.email,
            user_name: userProfile?.full_name || authUser.user.user_metadata?.full_name,
            property_name: prop.name,
            alerts: newAlerts,
            radar_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agrolex-ia-qx32.vercel.app'}/dashboard/radar`,
          });
          notifResult = notif.sent ? 'sent' : notif.method;
        }
      }

      results.push({
        property_id: prop.id,
        property_name: prop.name,
        user_id: prop.user_id,
        alerts_created: newAlerts.length,
        external_sources: externalResult.sources_success,
        notification: notifResult,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        property_id: prop.id,
        property_name: prop.name,
        user_id: prop.user_id,
        alerts_created: 0,
        external_sources: [],
        notification: 'error',
        error: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    properties_scanned: results.length,
    total_alerts_created: results.reduce((s, r) => s + r.alerts_created, 0),
    results,
  });
}
