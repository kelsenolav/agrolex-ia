"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield, ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, Bell, BellOff, Eye, Zap, Radio, Activity,
  ChevronRight, XCircle, Info, Edit3, Save, Database, Globe, Plus, Layers,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStatusConfig, getSeverityConfig } from '@/lib/monitoring/monitoringEngine';
import { daysUntilExpiry } from '@/lib/monitoring/radarRenewal';
import type { PropertyCheckResult } from '@/lib/monitoring/monitoringEngine';
import Logo from '@/components/Logo';

type AlertSeverity = 'info' | 'warning' | 'critical';

interface AlertRow {
  id: string;
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  is_read: boolean;
  created_at: string;
  property_id: string;
  properties?: { name: string; city?: string; state?: string };
}

interface PropertyRow {
  id: string;
  name: string;
  city?: string;
  state?: string;
  area?: number;
  is_monitoring?: boolean;
  last_radar_check_at?: string;
  last_radar_isf_score?: number;
  car_code?: string;
  ccir?: string;
  sigef_code?: string;
  cpf_cnpj?: string;
  matricula_number?: string;
  registry_office?: string;
}

interface ExternalCheckSummary {
  timestamp: string;
  sources_consulted: string[];
  sources_success: string[];
  sources_failed: string[];
  sigef: { found: boolean; status_certificacao?: string; sobreposicao_detectada?: boolean; erro?: string } | null;
  car: { found: boolean; status?: string; erro?: string } | null;
  cnir: { found: boolean; situacao_ccir?: string; divergencia_area?: boolean; divergencia_percentual?: number; erro?: string } | null;
  tribunais_processos: number;
  tribunais_alerta: boolean;
  certidoes: { certidao_inteiro_teor: { valida: boolean }; certidao_negativa_onus: { valida: boolean; onus_detectados: string[] }; certidao_acoes_reipersecutorias: { valida: boolean; acoes_encontradas: number } } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `${mins} min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

function ISFBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-gray-400 text-xs">—</span>;
  const color = score >= 70 ? 'text-emerald-600' : score >= 55 ? 'text-amber-600' : score >= 40 ? 'text-orange-600' : 'text-red-600';
  return <span className={`font-bold tabular-nums ${color}`}>{score}<span className="text-gray-400 font-normal text-xs">/100</span></span>;
}

function RadarContent() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [checkResults, setCheckResults] = useState<Record<string, PropertyCheckResult>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [lastGlobalScan, setLastGlobalScan] = useState<Date | null>(null);
  const [token, setToken] = useState<string>('');
  const [externalResults, setExternalResults] = useState<Record<string, ExternalCheckSummary>>({});
  const [editingProp, setEditingProp] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PropertyRow>>({});
  const [savingProp, setSavingProp] = useState(false);
  const [radarStatus, setRadarStatus] = useState<{
    has_active_subscription: boolean;
    trial_used: boolean;
    trial_available: boolean;
    expires_at?: string | null;
    auto_renew_active?: boolean;
    subscription_status?: string | null;
  } | null>(null);
  const [cancellingAutoRenew, setCancellingAutoRenew] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [userInfo, setUserInfo] = useState<{ id: string; email?: string } | null>(null);

  const fetchData = useCallback(async (sessionToken: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setUserInfo({ id: session.user.id, email: session.user.email ?? undefined });

    const [propsRes, alertsRes, statusRes] = await Promise.all([
      supabase.from('properties').select('id, name, city, state, area, is_monitoring, last_radar_check_at, last_radar_isf_score, car_code, ccir, sigef_code, cpf_cnpj, matricula_number, registry_office').eq('user_id', session.user.id).order('name'),
      fetch('/api/monitoring/alerts', { headers: { Authorization: `Bearer ${sessionToken}` } }).then(r => r.json()),
      fetch('/api/monitoring/status', { headers: { Authorization: `Bearer ${sessionToken}` } }).then(r => r.json()).catch(() => null),
    ]);

    setProperties(propsRes.data || []);
    setAlerts(alertsRes.alerts || []);
    if (statusRes && !statusRes.error) setRadarStatus(statusRes);
    setLoading(false);
  }, [router]);

  // Telemetria do funil de ativação do Radar (Eixo 2 / 2.2) — fire-and-forget.
  const trackRadarEvent = useCallback((eventType: string, meta?: Record<string, unknown>) => {
    if (!userInfo?.id) return;
    fetch('/api/marketing/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track_event', userId: userInfo.id, email: userInfo.email, eventType, meta }),
    }).catch(() => {});
  }, [userInfo]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setToken(session.access_token);
      fetchData(session.access_token);
    });
  }, [router, fetchData]);

  // Telemetria: visualização do Radar (uma vez por carga).
  const radarViewFired = useRef(false);
  useEffect(() => {
    if (userInfo?.id && !radarViewFired.current) {
      radarViewFired.current = true;
      trackRadarEvent('radar_view');
    }
  }, [userInfo, trackRadarEvent]);

  // Telemetria: abertura do modal de assinatura (qualquer gatilho).
  useEffect(() => {
    if (showSubscribeModal) trackRadarEvent('radar_subscribe_modal_open');
  }, [showSubscribeModal, trackRadarEvent]);

  const runCheck = useCallback(async (propertyId: string) => {
    if (!token) return;
    setScanning(s => ({ ...s, [propertyId]: true }));
    trackRadarEvent('radar_scan_started', { propertyId });
    try {
      const res = await fetch('/api/monitoring/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json();
      if (data.scan_blocked) {
        trackRadarEvent('radar_scan_blocked', { propertyId });
        setShowSubscribeModal(true);
        return;
      }
      if (data.result) {
        setCheckResults(r => ({ ...r, [propertyId]: data.result }));
        const alertsFound = Array.isArray(data.result?.alerts) ? data.result.alerts.length : 0;
        trackRadarEvent('radar_scan_completed', { propertyId, alerts_found: alertsFound });
      }
      if (data.external_check) {
        setExternalResults(r => ({ ...r, [propertyId]: data.external_check }));
      }
      await fetchData(token);
    } finally {
      setScanning(s => ({ ...s, [propertyId]: false }));
    }
  }, [token, fetchData, trackRadarEvent]);

  const runAllChecks = useCallback(async () => {
    const monitored = properties.filter(p => p.is_monitoring);
    for (const p of monitored) {
      await runCheck(p.id);
    }
    setLastGlobalScan(new Date());
  }, [properties, runCheck]);

  const toggleMonitoring = useCallback(async (propertyId: string, activate: boolean) => {
    if (!token) return;
    await fetch('/api/monitoring/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ propertyId, activate }),
    });
    setProperties(ps => ps.map(p => p.id === propertyId ? { ...p, is_monitoring: activate } : p));
    if (activate) runCheck(propertyId);
  }, [token, runCheck]);

  const markRead = useCallback(async (alertId: string) => {
    if (!token) return;
    await fetch('/api/monitoring/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ alertId }),
    });
    setAlerts(as => as.map(a => a.id === alertId ? { ...a, is_read: true } : a));
  }, [token]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    await fetch('/api/monitoring/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ markAllRead: true }),
    });
    setAlerts(as => as.map(a => ({ ...a, is_read: true })));
  }, [token]);

  const startEditProp = useCallback((prop: PropertyRow) => {
    setEditingProp(prop.id);
    setEditForm({
      car_code: prop.car_code || '',
      ccir: prop.ccir || '',
      sigef_code: prop.sigef_code || '',
      cpf_cnpj: prop.cpf_cnpj || '',
      matricula_number: prop.matricula_number || '',
      registry_office: prop.registry_office || '',
    });
  }, []);

  const saveEditProp = useCallback(async (propId: string) => {
    setSavingProp(true);
    try {
      await supabase.from('properties').update({
        car_code: editForm.car_code || null,
        ccir: editForm.ccir || null,
        sigef_code: editForm.sigef_code || null,
        cpf_cnpj: editForm.cpf_cnpj || null,
        matricula_number: editForm.matricula_number || null,
        registry_office: editForm.registry_office || null,
      }).eq('id', propId);
      setProperties(ps => ps.map(p => p.id === propId ? { ...p, ...editForm } : p));
      setEditingProp(null);
    } finally {
      setSavingProp(false);
    }
  }, [editForm]);

  const handleSubscribeRadar = useCallback(async () => {
    if (!token) return;
    setSubscribing(true);
    const count = Math.max(1, properties.filter(p => p.is_monitoring).length);
    trackRadarEvent('radar_checkout_started', { property_count: count });
    try {
      const res = await fetch('/api/monitoring/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyCount: count }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.mode === 'simulated_dev') {
        setShowSubscribeModal(false);
        await fetchData(token);
      }
    } catch {
      // silent
    } finally {
      setSubscribing(false);
    }
  }, [token, properties, fetchData, trackRadarEvent]);

  const handleCancelAutoRenew = useCallback(async () => {
    if (!token) return;
    const ok = window.confirm(
      'Cancelar a renovação automática do Radar?\n\nSeu acesso permanece até o fim do período já pago — depois disso o monitoramento para de rodar.'
    );
    if (!ok) return;
    setCancellingAutoRenew(true);
    try {
      const res = await fetch('/api/monitoring/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error || 'Não foi possível cancelar. Tente novamente.');
        return;
      }
      await fetchData(token);
    } catch {
      window.alert('Não foi possível cancelar. Tente novamente.');
    } finally {
      setCancellingAutoRenew(false);
    }
  }, [token, fetchData]);

  const monitoredProperties = properties.filter(p => p.is_monitoring);
  const unmonitoredProperties = properties.filter(p => !p.is_monitoring);
  const unreadAlerts = alerts.filter(a => !a.is_read);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.is_read);
  const warningAlerts = alerts.filter(a => a.severity === 'warning' && !a.is_read);

  const getPropertyStatus = (prop: PropertyRow): PropertyCheckResult['overallStatus'] => {
    const result = checkResults[prop.id];
    if (result) return result.overallStatus;
    if (!prop.is_monitoring) return 'sem_analise';
    if (alerts.some(a => a.property_id === prop.id && a.severity === 'critical' && !a.is_read)) return 'critico';
    if (alerts.some(a => a.property_id === prop.id && a.severity === 'warning' && !a.is_read)) return 'atencao';
    if (prop.last_radar_check_at) return 'seguro';
    return 'sem_analise';
  };

  const getPropertyAlertCount = (propertyId: string) =>
    alerts.filter(a => a.property_id === propertyId && !a.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-brand-green/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-brand-green/40 animate-pulse" />
            <Radio className="absolute inset-0 m-auto text-brand-green" size={28} />
          </div>
          <p className="text-brand-green text-sm font-bold tracking-widest animate-pulse">INICIALIZANDO RADAR...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Navbar */}
      <nav className="bg-brand-green text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white/80 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <Logo size="sm" className="text-white" />
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-sm">·</span>
                <div className="relative flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-gold animate-ping absolute" />
                  <span className="w-2 h-2 rounded-full bg-brand-gold relative" />
                  <span className="text-brand-gold font-bold text-sm tracking-tight">Radar Fundiário</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastGlobalScan && (
              <span className="text-xs text-white/70 hidden sm:block">
                Última varredura: {timeAgo(lastGlobalScan.toISOString())}
              </span>
            )}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
              <span className="text-xs font-bold text-white">SISTEMA ATIVO</span>
            </div>
            {monitoredProperties.length > 0 && (
              <button
                onClick={runAllChecks}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <RefreshCw size={13} />
                Varrer tudo
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Banner crítico */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex-shrink-0" />
              <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
              <span className="text-red-700 text-sm font-semibold">
                {criticalAlerts.length} alerta{criticalAlerts.length > 1 ? 's' : ''} crítico{criticalAlerts.length > 1 ? 's' : ''} detectado{criticalAlerts.length > 1 ? 's' : ''} — ação imediata recomendada
              </span>
            </div>
            <button onClick={markAllRead} className="text-xs text-red-700 hover:text-red-900 font-medium whitespace-nowrap border border-red-300 px-3 py-1 rounded-md transition-colors">
              Marcar como lidos
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Monitoradas', value: monitoredProperties.length, icon: <Shield size={18} />, color: 'text-emerald-600', bg: 'bg-white border-gray-100' },
            { label: 'Alertas Críticos', value: criticalAlerts.length, icon: <AlertTriangle size={18} />, color: 'text-red-600', bg: criticalAlerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100' },
            { label: 'Em Atenção', value: warningAlerts.length, icon: <Zap size={18} />, color: 'text-amber-600', bg: warningAlerts.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100' },
            { label: 'Não lidos', value: unreadAlerts.length, icon: <Bell size={18} />, color: 'text-blue-600', bg: 'bg-white border-gray-100' },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} className={`rounded-xl border shadow-sm p-4 ${bg}`}>
              <div className={`flex items-center gap-2 ${color} mb-2`}>{icon}<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span></div>
              <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Estado da assinatura recorrente (Preapproval): renovação automática / cancelada / pausada. */}
        {(() => {
          if (!radarStatus?.has_active_subscription || !radarStatus.expires_at) return null;
          const dataFim = new Date(radarStatus.expires_at).toLocaleDateString('pt-BR');

          if (radarStatus.subscription_status === 'paused') {
            return (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Clock size={20} className="text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900">Cobrança automática não foi concluída</p>
                    <p className="text-xs mt-0.5 text-amber-700">O Mercado Pago não conseguiu processar a última cobrança (ex: cartão recusado). Seu acesso continua até {dataFim}. Verifique o método de pagamento no Mercado Pago ou assine novamente.</p>
                  </div>
                </div>
              </div>
            );
          }

          if (radarStatus.subscription_status === 'cancelled') {
            return (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6 flex items-start gap-3">
                <XCircle size={20} className="text-gray-500 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-800">Renovação automática cancelada</p>
                  <p className="text-xs mt-0.5 text-gray-600">Seu acesso ao Radar permanece até {dataFim}. Para retomar o monitoramento depois disso, assine novamente.</p>
                </div>
              </div>
            );
          }

          if (radarStatus.auto_renew_active) {
            return (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <RefreshCw size={20} className="text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-900">Renovação automática ativa</p>
                    <p className="text-xs mt-0.5 text-emerald-700">Sua assinatura renova sozinha todo mês via Mercado Pago — período atual até {dataFim}. Cancele quando quiser, sem burocracia.</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelAutoRenew}
                  disabled={cancellingAutoRenew}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  {cancellingAutoRenew ? 'Cancelando...' : 'Cancelar renovação automática'}
                </button>
              </div>
            );
          }

          return null;
        })()}

        {/* Banner de renovação (Eixo 2 / 2.1): aviso quando a assinatura expira em ≤7 dias ou já expirou. */}
        {(() => {
          if (!radarStatus?.has_active_subscription || !radarStatus.expires_at) return null;
          // Com renovação automática ativa o MP cobra sozinho — pedir "renove agora" seria confuso.
          if (radarStatus.auto_renew_active) return null;
          const dias = daysUntilExpiry(radarStatus.expires_at, Date.now());
          if (dias === null || dias > 7) return null;
          const expirou = dias < 0;
          return (
            <div className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${expirou ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start gap-3">
                {expirou ? <XCircle size={20} className="text-red-600 mt-0.5" /> : <Clock size={20} className="text-amber-600 mt-0.5" />}
                <div>
                  <p className={`font-bold ${expirou ? 'text-red-900' : 'text-amber-900'}`}>
                    {expirou ? 'Sua proteção do Radar expirou' : dias === 0 ? 'Sua proteção do Radar expira hoje' : `Sua proteção do Radar expira em ${dias} dia${dias !== 1 ? 's' : ''}`}
                  </p>
                  <p className={`text-xs mt-0.5 ${expirou ? 'text-red-700' : 'text-amber-700'}`}>
                    {expirou ? 'O monitoramento contínuo foi interrompido — você deixa de ser avisado sobre novos gravames, penhoras e ações.' : 'Renove para não deixar nenhuma janela de vigilância descoberta.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSubscribeModal(true)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white ${expirou ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                <RefreshCw size={14} /> {expirou ? 'Reativar Radar' : 'Renovar agora'}
              </button>
            </div>
          );
        })()}

        <div className="grid lg:grid-cols-5 gap-6">

          {/* Coluna esquerda: Propriedades */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Activity size={14} className="text-brand-green" /> Áreas Vigiadas
              </h2>
              <span className="text-xs text-gray-500">{monitoredProperties.length} ativas</span>
            </div>

            {monitoredProperties.length === 0 && properties.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 text-center">
                <Radio size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-700 text-sm font-medium">Você ainda não tem propriedades cadastradas.</p>
                <p className="text-gray-500 text-xs mt-1 mb-4">Crie uma análise para cadastrar sua primeira propriedade — ela aparece aqui automaticamente para você ativar o monitoramento.</p>
                <Link
                  href="/dashboard/nova-analise"
                  className="inline-flex items-center gap-2 bg-brand-green text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:brightness-110 transition-all shadow-sm"
                >
                  <Plus size={14} /> Cadastrar propriedade
                </Link>
              </div>
            )}

            {monitoredProperties.length === 0 && properties.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 text-center">
                <Radio size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 text-sm">Nenhuma propriedade no radar.</p>
                <p className="text-gray-500 text-xs mt-1">Ative o monitoramento nas propriedades abaixo.</p>
              </div>
            )}

            {monitoredProperties.map(prop => {
              const status = getPropertyStatus(prop);
              const cfg = getStatusConfig(status);
              const alertCount = getPropertyAlertCount(prop.id);
              const isScanning = scanning[prop.id];
              const result = checkResults[prop.id];

              return (
                <div key={prop.id} className={`rounded-xl border bg-white shadow-sm p-4 transition-all ${cfg.border} hover:shadow-md`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${status === 'critico' ? 'animate-pulse' : ''}`} />
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{prop.name}</h3>
                      </div>
                      {(prop.city || prop.state) && (
                        <p className="text-xs text-gray-500 mt-0.5 ml-4">{[prop.city, prop.state].filter(Boolean).join(' / ')}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${cfg.badgeBg}`}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">ISF atual</div>
                      <ISFBadge score={result?.latestIsfScore ?? prop.last_radar_isf_score} />
                    </div>
                    {alertCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs text-red-600 font-medium">{alertCount} alerta{alertCount > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {alertCount === 0 && prop.last_radar_check_at && (
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <CheckCircle2 size={12} />
                        <span>OK</span>
                      </div>
                    )}
                  </div>

                  {prop.last_radar_check_at && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                      <Clock size={10} /> Varredura {timeAgo(prop.last_radar_check_at)}
                    </p>
                  )}

                  {/* Dados cadastrais inline */}
                  {editingProp === prop.id ? (
                    <div className="mb-3 p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-1"><Database size={10} /> Dados Cadastrais</span>
                        <button onClick={() => saveEditProp(prop.id)} disabled={savingProp} className="text-xs bg-brand-green hover:brightness-110 text-white px-2 py-0.5 rounded flex items-center gap-1 disabled:opacity-50">
                          <Save size={10} /> {savingProp ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                      {([
                        { key: 'car_code', label: 'Código CAR', placeholder: 'XX-XXXXXXX-XXXX' },
                        { key: 'ccir', label: 'CCIR', placeholder: 'Exercício (ex: 2025)' },
                        { key: 'sigef_code', label: 'Código SIGEF', placeholder: 'UUID da parcela' },
                        { key: 'cpf_cnpj', label: 'CPF/CNPJ Proprietário', placeholder: '000.000.000-00' },
                        { key: 'matricula_number', label: 'Nº Matrícula', placeholder: '12.345' },
                        { key: 'registry_office', label: 'Cartório', placeholder: 'CRI de ...' },
                      ] as const).map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="text-xs text-gray-600 block mb-0.5">{label}</label>
                          <input
                            type="text"
                            value={(editForm as Record<string, string>)[key] || ''}
                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full text-xs bg-white border border-gray-200 text-gray-900 rounded px-2 py-1 focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none"
                          />
                        </div>
                      ))}
                      <button onClick={() => setEditingProp(null)} className="text-xs text-gray-500 hover:text-gray-700 mt-1">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => startEditProp(prop)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-green transition-colors"
                      >
                        <Edit3 size={10} />
                        {prop.car_code || prop.sigef_code || prop.cpf_cnpj ? 'Editar dados cadastrais' : 'Adicionar dados cadastrais (CAR, SIGEF, CPF...)'}
                      </button>
                      {prop.car_code && (
                        <Link
                          href={`/dashboard/sobreposicao?car=${encodeURIComponent(prop.car_code)}`}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                          title="Cruza o polígono do CAR com Terras Indígenas, UCs, embargos IBAMA e CARs vizinhos"
                        >
                          <Layers size={10} /> Sobreposições
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Resultado consultas externas */}
                  {externalResults[prop.id] && (
                    <div className="mb-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200 space-y-1.5">
                      <div className="flex items-center gap-1 mb-1">
                        <Globe size={10} className="text-blue-500" />
                        <span className="text-xs font-bold text-gray-600">Consultas Externas</span>
                        <span className="text-xs text-gray-500 ml-auto">{externalResults[prop.id].sources_success.length}/{externalResults[prop.id].sources_consulted.length} fontes</span>
                      </div>
                      {externalResults[prop.id].sources_success.map(s => (
                        <div key={s} className="flex items-center gap-1.5 text-xs">
                          <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-gray-700">{s}</span>
                          {s === 'SIGEF' && externalResults[prop.id].sigef?.sobreposicao_detectada && (
                            <span className="text-red-600 font-bold ml-auto">Sobreposição!</span>
                          )}
                          {s === 'CAR' && externalResults[prop.id].car?.status && (
                            <span className={`ml-auto font-medium ${externalResults[prop.id].car!.status === 'ativo' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {externalResults[prop.id].car!.status}
                            </span>
                          )}
                          {s === 'Tribunais' && (
                            <span className={`ml-auto font-medium ${externalResults[prop.id].tribunais_alerta ? 'text-red-600' : 'text-emerald-600'}`}>
                              {externalResults[prop.id].tribunais_processos} processo{externalResults[prop.id].tribunais_processos !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      ))}
                      {externalResults[prop.id].sources_failed.map(s => (
                        <div key={s} className="flex items-center gap-1.5 text-xs">
                          <XCircle size={10} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-500">{s} — indisponível</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => runCheck(prop.id)}
                      disabled={isScanning}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-brand-green hover:brightness-110 text-white font-medium transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={isScanning ? 'animate-spin' : ''} />
                      {isScanning ? 'Varrendo...' : 'Executar varredura'}
                    </button>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-1 text-xs py-1.5 px-2 rounded-lg bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 transition-colors"
                      aria-label="Ver análises da propriedade"
                    >
                      <Eye size={11} />
                    </Link>
                  </div>
                </div>
              );
            })}

            {/* Propriedades não monitoradas */}
            {unmonitoredProperties.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Sem monitoramento</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {unmonitoredProperties.map(prop => (
                  <div key={prop.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 opacity-75 hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                          <h3 className="font-medium text-gray-700 text-sm truncate">{prop.name}</h3>
                        </div>
                        {(prop.city || prop.state) && (
                          <p className="text-xs text-gray-500 mt-0.5 ml-4">{[prop.city, prop.state].filter(Boolean).join(' / ')}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 border border-gray-300 px-2 py-0.5 rounded-full">Inativo</span>
                    </div>
                    <button
                      onClick={() => toggleMonitoring(prop.id, true)}
                      className="w-full text-xs py-1.5 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/20 text-brand-green font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Shield size={11} />
                      Ativar monitoramento
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Coluna direita: Feed de alertas */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Bell size={14} className="text-brand-green" /> Central de Alertas
              </h2>
              {unreadAlerts.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-brand-green transition-colors flex items-center gap-1">
                  <BellOff size={12} /> Marcar todos como lidos
                </button>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border border-emerald-200 animate-ping opacity-40" />
                  <div className="absolute inset-2 rounded-full border border-emerald-200 opacity-30" />
                  <Shield className="absolute inset-0 m-auto text-emerald-500" size={24} />
                </div>
                <p className="text-emerald-600 font-semibold mb-1">Nenhuma anomalia detectada</p>
                <p className="text-gray-500 text-sm">Execute uma varredura para iniciar o monitoramento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => {
                  const cfg = getSeverityConfig(alert.severity);
                  const propName = alert.properties?.name || 'Propriedade';

                  return (
                    <div
                      key={alert.id}
                      className={`rounded-xl p-4 transition-all ${alert.is_read ? 'bg-white border border-gray-100 opacity-70 hover:opacity-100' : cfg.bg}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className={`w-2 h-2 rounded-full block mt-1 ${cfg.dot}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className="text-gray-400 text-xs">·</span>
                            <span className="text-gray-700 text-xs font-medium">{propName}</span>
                            <span className="text-gray-500 text-xs ml-auto flex-shrink-0">{timeAgo(alert.created_at)}</span>
                          </div>
                          <p className={`text-sm font-semibold mb-1 ${cfg.color}`}>{alert.title}</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{alert.description}</p>
                          <div className="flex gap-3 mt-2">
                            <Link
                              href="/dashboard"
                              className="text-xs text-gray-500 hover:text-brand-green flex items-center gap-1 transition-colors"
                            >
                              <ChevronRight size={11} /> Ver análises
                            </Link>
                            {!alert.is_read && (
                              <button
                                onClick={() => markRead(alert.id)}
                                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
                              >
                                <XCircle size={11} /> Dispensar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upsell card — monitoramento automático */}
            <div className="mt-6 rounded-xl bg-brand-green text-white overflow-hidden shadow-md">
              <div className="px-5 py-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <Zap size={16} className="text-brand-gold" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                    <span className="text-brand-gold text-[10px] font-bold uppercase tracking-widest">Assinatura Recorrente</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Ative o monitoramento automático</h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Varreduras quinzenais automáticas, alertas por e-mail e relatório mensal de delta fundiário por propriedade. Saiba de qualquer gravame antes que ele afete sua operação.
                  </p>
                  <div className="flex gap-4 flex-wrap mt-3">
                    {[
                      'Varredura quinzenal automática',
                      'Alertas em até 24h',
                      'Delta report mensal',
                    ].map(f => (
                      <div key={f} className="flex items-center gap-1.5 text-xs text-white/80">
                        <CheckCircle2 size={11} className="text-brand-gold flex-shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xl font-black text-white">R$ 49<span className="text-sm font-bold text-white/70">,90</span></div>
                  <div className="text-[10px] text-white/60">/propriedade/mês</div>
                </div>
              </div>
              <div className="border-t border-white/15 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[11px] text-white/70">R$ 49,90/propriedade/mês · Cancele quando quiser</p>
                <Link
                  href="/dashboard/planos"
                  className="flex items-center gap-2 bg-brand-gold hover:brightness-110 text-brand-green font-bold px-5 py-2 rounded-lg transition-all text-xs shadow-sm whitespace-nowrap"
                >
                  Ver planos e assinar →
                </Link>
              </div>
            </div>

            {/* Info footer */}
            <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
              <Info size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
              <p>O radar analisa os dados das suas análises existentes. Para detectar novos ônus registrados após a data da análise, atualize os documentos e execute nova auditoria completa.</p>
            </div>
          </div>
        </div>

        {/* Status do Radar */}
        {radarStatus && (
          <div className="mt-6 flex items-center justify-center gap-3 text-xs">
            {radarStatus.has_active_subscription ? (
              <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                <CheckCircle2 size={12} /> Assinatura Radar ativa
              </span>
            ) : radarStatus.trial_available ? (
              <span className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                <Zap size={12} /> 1 varredura gratuita disponível
              </span>
            ) : (
              <button
                onClick={() => setShowSubscribeModal(true)}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full font-medium hover:bg-amber-100 transition-colors"
              >
                <Shield size={12} /> Varredura gratuita utilizada — Assinar Radar
              </button>
            )}
          </div>
        )}
      </main>

      {/* Modal de Assinatura */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center">
                <Shield size={20} className="text-brand-green" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Assinar Radar Fundiário</h3>
                <p className="text-xs text-gray-500">Monitoramento contínuo das suas propriedades</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                'Varredura quinzenal automática',
                'Consulta a SIGEF, CAR, Tribunais',
                'Alertas por e-mail em tempo real',
                'Relatório mensal de delta fundiário',
                'Detecção de gravames, penhoras e litígios',
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Sem monitoramento contínuo, um novo gravame, penhora ou ação de terceiro só é
                descoberto quando <strong>já virou problema</strong>. O Radar te avisa no momento em que muda.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5 text-center">
              <div className="text-3xl font-black text-gray-900">
                R$ 49<span className="text-lg text-gray-500">,90</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">por propriedade / mês</div>
              <div className="text-xs text-gray-500 mt-2">Cancele a qualquer momento</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors"
              >
                Agora não
              </button>
              <button
                onClick={handleSubscribeRadar}
                disabled={subscribing}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand-green text-white hover:brightness-110 transition-all shadow-sm disabled:opacity-50"
              >
                {subscribing ? 'Processando...' : 'Assinar Radar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-brand-green text-sm font-bold animate-pulse tracking-widest">INICIALIZANDO RADAR...</div>
      </div>
    }>
      <RadarContent />
    </Suspense>
  );
}
