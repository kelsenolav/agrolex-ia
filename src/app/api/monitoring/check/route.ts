import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPropertyCheck } from '@/lib/monitoring/monitoringEngine';
import { runExternalChecks, type PropertyParams, type AnalysisFindings } from '@/lib/monitoring/externalDataProviders';
import { canRunScan, consumeRadarTrial } from '@/lib/monitoring/radarSubscription';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const { data: property, error: propError } = await adminClient
      .from('properties')
      .select('id, name, city, state, user_id, last_radar_isf_score, is_monitoring, car_code, ccir, sigef_code, cpf_cnpj, matricula_number, registry_office')
      .eq('id', propertyId)
      .single();

    if (propError || !property) return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 });
    if (property.user_id !== user.id) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const scanPermission = await canRunScan(user.id, propertyId, adminClient);
    if (!scanPermission.allowed) {
      return NextResponse.json({
        error: scanPermission.message,
        scan_blocked: true,
        reason: scanPermission.reason,
      }, { status: 403 });
    }

    if (scanPermission.reason === 'trial') {
      const trialResult = await consumeRadarTrial(user.id, propertyId, adminClient);
      if (!trialResult.consumed) {
        return NextResponse.json({
          error: trialResult.error,
          scan_blocked: true,
          reason: 'trial_exhausted',
        }, { status: 403 });
      }
    }

    const { data: analyses } = await adminClient
      .from('analyses')
      .select('id, status, completed_at, isf_score, findings, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(10);

    const internalResult = runPropertyCheck(property, analyses || [], property.last_radar_isf_score ?? null);

    const latestCompleted = (analyses || []).find(a => a.status === 'completed');
    const findings: AnalysisFindings = latestCompleted?.findings || {};

    const propertyParams: PropertyParams = {
      name: property.name,
      city: property.city,
      state: property.state,
      car_code: property.car_code,
      ccir: property.ccir,
      sigef_code: property.sigef_code,
      cpf_cnpj: property.cpf_cnpj,
      matricula_number: property.matricula_number,
      registry_office: property.registry_office,
    };

    const externalResult = await runExternalChecks(propertyParams, findings);

    const allAlerts = [
      ...internalResult.alerts.map(a => ({
        alert_type: a.alert_type,
        severity: a.severity as 'info' | 'warning' | 'critical',
        title: a.title,
        description: a.description,
        metadata: a.metadata as Record<string, unknown>,
      })),
      ...externalResult.new_alerts,
    ];

    const today = new Date().toISOString().slice(0, 10);
    const { data: existingAlerts } = await adminClient
      .from('monitoring_alerts')
      .select('alert_type')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);

    const existingTypes = new Set((existingAlerts || []).map((a: { alert_type: string }) => a.alert_type));
    const newAlerts = allAlerts.filter(a => !existingTypes.has(a.alert_type));

    if (newAlerts.length > 0) {
      await adminClient.from('monitoring_alerts').insert(
        newAlerts.map(a => ({
          user_id: user.id,
          property_id: propertyId,
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

    await adminClient.from('properties').update({
      is_monitoring: true,
      last_radar_check_at: new Date().toISOString(),
      last_radar_isf_score: internalResult.latestIsfScore ?? property.last_radar_isf_score,
      last_radar_analysis_id: internalResult.latestAnalysisId,
    }).eq('id', propertyId);

    return NextResponse.json({
      success: true,
      result: {
        ...internalResult,
        alerts: allAlerts.map(a => ({
          alert_type: a.alert_type,
          severity: a.severity,
          title: a.title,
          description: a.description,
          metadata: a.metadata,
        })),
      },
      external_check: {
        timestamp: externalResult.timestamp,
        sources_consulted: externalResult.sources_consulted,
        sources_success: externalResult.sources_success,
        sources_failed: externalResult.sources_failed,
        sigef: externalResult.sigef,
        car: externalResult.car,
        cnir: externalResult.cnir,
        tribunais_processos: externalResult.tribunais?.processos_encontrados ?? 0,
        tribunais_alerta: externalResult.tribunais?.alerta_litigio ?? false,
        certidoes: externalResult.certidoes,
      },
      newAlertsCount: newAlerts.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Monitoring Check]', msg);
    return NextResponse.json({ error: msg || 'Erro interno' }, { status: 500 });
  }
}
