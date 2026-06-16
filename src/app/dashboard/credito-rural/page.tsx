'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Landmark,
  ShieldCheck,
  Gavel,
  Leaf,
  BookOpen,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  FileText,
  DollarSign,
  Scale,
  TreePine,
} from 'lucide-react';

// ─── Tipos locais ───────────────────────────────────────────────────────────

type TabId = 'hub' | 'elegibilidade' | 'defesa' | 'ambiental' | 'conhecimento';

interface PropertyForCredit {
  id: string;
  name: string;
  city?: string;
  state?: string;
  area?: number;
  car_number?: string;
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function CreditoRuralPage() {
  const router = useRouter();
  // supabase imported from @/lib/supabase
  const [activeTab, setActiveTab] = useState<TabId>('hub');
  const [properties, setProperties] = useState<PropertyForCredit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Elegibilidade state
  const [eligForm, setEligForm] = useState({
    tipo_produtor: 'medio' as 'familiar' | 'medio' | 'grande',
    renda_bruta_anual: '',
    car_ativo: true,
    ccir_vigente: true,
    itr_regular: true,
    dap_caf_valida: false,
    credito_rural_vigente: false,
    inadimplencia_credito_rural: false,
    cadin_serasa: false,
    embargo_ibama: false,
    prodes_clean: true,
    hipotecas_vigentes: '0',
    penhoras_vigentes: '0',
    area_gravada_ha: '0',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [eligResult, setEligResult] = useState<any>(null);
  const [eligLoading, setEligLoading] = useState(false);

  // Defesa state
  const [defForm, setDefForm] = useState({
    tipo_cedula: 'CPR' as string,
    credor: '',
    devedor: '',
    valor_principal: '',
    taxa_juros_contratual: '',
    taxa_mora_contratual: '',
    data_emissao: '',
    data_vencimento: '',
    praca_pagamento: '',
    bens_vinculados: '',
    capitalizacao_juros: false,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [defResult, setDefResult] = useState<any>(null);
  const [defLoading, setDefLoading] = useState(false);

  // Ambiental state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ambResult, setAmbResult] = useState<any | null>(null);
  const [ambLoading, setAmbLoading] = useState(false);

  // Conhecimento state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [programas, setProgramas] = useState<any[]>([]);
  const [conhecLoading, setConhecLoading] = useState(false);

  // Integração com a análise da matrícula
  interface MatriculaDerived {
    found: boolean;
    matricula_limpa: boolean;
    hipotecas_vigentes: number;
    penhoras_vigentes: number;
    onus_count: number;
    area_total_ha: number | null;
    numero_matricula: string | null;
    risk_level: string | null;
    analysis_id: string | null;
  }
  const [matriculaData, setMatriculaData] = useState<MatriculaDerived | null>(null);
  const [matriculaLoading, setMatriculaLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: props } = await supabase
        .from('properties')
        .select('id, name, city, state, area, car_number')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setProperties(props ?? []);
      if (props && props.length > 0) setSelectedPropertyId(props[0].id);
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const getAuthHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? `Bearer ${session.access_token}` : '';
  }, [supabase]);

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // ─── Integração com a análise da matrícula ────────────────────────────────
  // Deriva ônus/área/limpeza da última auditoria concluída da propriedade,
  // eliminando a digitação manual e o antigo `matricula_limpa: true` hardcoded.

  const deriveFromMatricula = useCallback(async (propertyId: string): Promise<MatriculaDerived> => {
    const vazio: MatriculaDerived = {
      found: false, matricula_limpa: false, hipotecas_vigentes: 0, penhoras_vigentes: 0,
      onus_count: 0, area_total_ha: null, numero_matricula: null, risk_level: null, analysis_id: null,
    };
    const { data: analyses } = await supabase
      .from('analyses')
      .select('id, status, risk_level, findings')
      .eq('property_id', propertyId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    const a = analyses?.[0];
    if (!a) return vazio;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f: any = a.findings || {};
    const mr = f.module_results?.matricula_individual || {};
    const onus: unknown[] = f.onus_restricoes || mr.onus_restricoes || [];
    const atos: unknown[] = f.atos_registrais || mr.atos_registrais || [];
    const itens = [...onus, ...atos];

    const matchCount = (re: RegExp) => itens.filter((it) => {
      const s = JSON.stringify(it ?? '').toLowerCase();
      return re.test(s);
    }).length;

    const hipotecas = matchCount(/hipotec/);
    // penhora, arresto, indisponibilidade, sequestro = bloqueios graves vigentes
    const penhoras = matchCount(/penhora|arresto|indisponibil|sequestro|constri[çc]/);
    const onusCount = onus.length;

    // Área: tenta extrair de identificacao.area_numerica; fallback p/ a propriedade
    const ident = f.identificacao || mr.identificacao || {};
    let area: number | null = null;
    const areaStr = String(ident.area_numerica ?? ident.area ?? '').replace(/\./g, '').replace(',', '.');
    const areaNum = parseFloat(areaStr.replace(/[^\d.]/g, ''));
    if (Number.isFinite(areaNum) && areaNum > 0) area = areaNum;

    const risk = a.risk_level || f.risk_level || null;
    const riskLimpo = !risk || !/cr[íi]tico|alto/i.test(String(risk));
    const matriculaLimpa = riskLimpo && penhoras === 0;

    return {
      found: true,
      matricula_limpa: matriculaLimpa,
      hipotecas_vigentes: hipotecas,
      penhoras_vigentes: penhoras,
      onus_count: onusCount,
      area_total_ha: area,
      numero_matricula: ident.numero_matricula || null,
      risk_level: risk,
      analysis_id: a.id,
    };
  }, [supabase]);

  const aplicarDadosMatricula = useCallback((d: MatriculaDerived) => {
    setEligForm(prev => ({
      ...prev,
      hipotecas_vigentes: String(d.hipotecas_vigentes),
      penhoras_vigentes: String(d.penhoras_vigentes),
    }));
  }, []);

  // Auto-carrega ao trocar de propriedade
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedPropertyId) { setMatriculaData(null); return; }
      setMatriculaLoading(true);
      const d = await deriveFromMatricula(selectedPropertyId);
      if (cancelled) return;
      setMatriculaData(d);
      if (d.found) aplicarDadosMatricula(d);
      setMatriculaLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedPropertyId, deriveFromMatricula, aplicarDadosMatricula]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleEligibilidade() {
    if (!selectedProperty) return;
    setEligLoading(true);
    setEligResult(null);
    try {
      const res = await fetch('/api/credito-rural/elegibilidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: await getAuthHeader() },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          origem_matricula: matriculaData?.found === true,
          // matricula_limpa e ônus vêm da auditoria real quando disponível;
          // sem auditoria, usa o que o usuário informou nos campos.
          matricula_limpa: matriculaData?.found ? matriculaData.matricula_limpa : true,
          onus_count: matriculaData?.found
            ? matriculaData.onus_count
            : parseInt(eligForm.hipotecas_vigentes) + parseInt(eligForm.penhoras_vigentes),
          onus_types: [],
          hipotecas_vigentes: parseInt(eligForm.hipotecas_vigentes) || 0,
          penhoras_vigentes: parseInt(eligForm.penhoras_vigentes) || 0,
          area_total_ha: matriculaData?.area_total_ha ?? selectedProperty.area ?? 100,
          area_gravada_ha: parseFloat(eligForm.area_gravada_ha) || 0,
          car_ativo: eligForm.car_ativo,
          ccir_vigente: eligForm.ccir_vigente,
          itr_regular: eligForm.itr_regular,
          dap_caf_valida: eligForm.dap_caf_valida,
          tipo_produtor: eligForm.tipo_produtor,
          renda_bruta_anual: eligForm.renda_bruta_anual ? parseFloat(eligForm.renda_bruta_anual) : undefined,
          uf: selectedProperty.state ?? 'GO',
          credito_rural_vigente: eligForm.credito_rural_vigente,
          inadimplencia_credito_rural: eligForm.inadimplencia_credito_rural,
          cadin_serasa: eligForm.cadin_serasa,
          prodes_clean: eligForm.prodes_clean,
          embargo_ibama: eligForm.embargo_ibama,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEligResult({ error: data.message || data.error || 'Erro ao calcular elegibilidade' }); return; }
      setEligResult(data.resultado);
    } catch {
      setEligResult({ error: 'Erro ao calcular elegibilidade' });
    }
    setEligLoading(false);
  }

  async function handleDefesa() {
    setDefLoading(true);
    setDefResult(null);
    try {
      const res = await fetch('/api/credito-rural/defesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: await getAuthHeader() },
        body: JSON.stringify({
          ...defForm,
          property_id: selectedProperty?.id ?? null,
          valor_principal: parseFloat(defForm.valor_principal) || 0,
          taxa_juros_contratual: parseFloat(defForm.taxa_juros_contratual) || 0,
          taxa_mora_contratual: parseFloat(defForm.taxa_mora_contratual) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setDefResult({ error: data.message || data.error || 'Erro ao analisar cédula' }); return; }
      setDefResult(data.resultado);
    } catch {
      setDefResult({ error: 'Erro ao analisar cédula' });
    }
    setDefLoading(false);
  }

  async function handleAmbiental() {
    if (!selectedProperty) return;
    setAmbLoading(true);
    setAmbResult(null);
    try {
      const res = await fetch('/api/credito-rural/ambiental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: await getAuthHeader() },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          uf: selectedProperty.state ?? 'GO',
          area_total_ha: matriculaData?.area_total_ha ?? selectedProperty.area ?? 100,
          embargo_ibama: eligForm.embargo_ibama,
          desmatamento_recente: !eligForm.prodes_clean,
          reserva_legal_averbada: undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAmbResult({ error: data.message || data.error || 'Erro ao verificar conformidade' }); return; }
      setAmbResult(data.resultado);
    } catch {
      setAmbResult({ error: 'Erro ao verificar conformidade' });
    }
    setAmbLoading(false);
  }

  async function handleConhecimento() {
    setConhecLoading(true);
    try {
      const uf = selectedProperty?.state ?? '';
      const res = await fetch(`/api/credito-rural/conhecimento?uf=${uf}`, {
        headers: { Authorization: await getAuthHeader() },
      });
      const data = await res.json();
      setProgramas(data.programas ?? []);
    } catch {
      setProgramas([]);
    }
    setConhecLoading(false);
  }

  useEffect(() => {
    if (activeTab === 'conhecimento' && programas.length === 0) {
      const timer = setTimeout(() => handleConhecimento(), 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    );
  }

  // ─── Score color ──────────────────────────────────────────────────────────

  function scoreColor(score: number) {
    if (score >= 86) return 'text-emerald-600';
    if (score >= 71) return 'text-green-600';
    if (score >= 51) return 'text-yellow-600';
    if (score >= 31) return 'text-orange-600';
    return 'text-red-600';
  }

  function faixaBadge(faixa: string) {
    const colors: Record<string, string> = {
      premium: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      elegivel: 'bg-green-100 text-green-700 border-green-300',
      condicional: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      restrito: 'bg-orange-100 text-orange-700 border-orange-300',
      inelegivel: 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[faixa] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  }

  function statusIcon(status: string) {
    if (status === 'conforme') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    if (status === 'nao_conforme') return <XCircle className="w-5 h-5 text-red-600" />;
    if (status === 'verificacao_necessaria') return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <HelpCircle className="w-5 h-5 text-gray-400" />;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navbar */}
      <nav className="bg-brand-green text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/70 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Landmark className="w-6 h-6 text-white" />
            <h1 className="text-lg font-semibold text-white">Crédito Rural</h1>
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/20 text-white border border-white/30 font-medium">BETA</span>
          </div>
          {selectedProperty && (
            <div className="text-sm text-white/70">
              {selectedProperty.name} — {selectedProperty.state}
            </div>
          )}
        </div>
      </nav>

      {/* Property selector */}
      {properties.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 py-3">
          <select
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 w-full max-w-md shadow-sm"
            value={selectedPropertyId}
            onChange={e => setSelectedPropertyId(e.target.value)}
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.city}/{p.state}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-white rounded-xl p-1 overflow-x-auto shadow-sm border border-gray-100">
          {[
            { id: 'hub' as TabId, label: 'Visão Geral', icon: Landmark },
            { id: 'elegibilidade' as TabId, label: 'Elegibilidade', icon: TrendingUp },
            { id: 'defesa' as TabId, label: 'Defesa Judicial', icon: Gavel },
            { id: 'ambiental' as TabId, label: 'Ambiental', icon: Leaf },
            { id: 'conhecimento' as TabId, label: 'Base de Conhecimento', icon: BookOpen },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ─── HUB ──────────────────────────────────────────────────────── */}
        {activeTab === 'hub' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <Landmark className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Central de Crédito Rural</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Diagnóstico completo para acesso ao crédito rural: elegibilidade, conformidade ambiental, defesa em execuções e base de conhecimento jurídico atualizada.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  tab: 'elegibilidade' as TabId,
                  icon: TrendingUp,
                  color: 'green',
                  title: 'Diagnóstico de Elegibilidade',
                  desc: 'Avalie suas chances de aprovação em Pronaf, Pronamp, fundos constitucionais e crédito livre. Score de 4 eixos com matching automático de programas.',
                },
                {
                  tab: 'defesa' as TabId,
                  icon: Gavel,
                  color: 'amber',
                  title: 'Defesa em Execução de Crédito',
                  desc: 'Análise de cédulas de crédito rural: vícios formais (DL 167/67), juros abusivos, prescrição, anatocismo e estratégia de defesa.',
                },
                {
                  tab: 'ambiental' as TabId,
                  icon: Leaf,
                  color: 'emerald',
                  title: 'Conformidade Ambiental',
                  desc: 'Verificação de barreiras ambientais (PRODES/INPE, embargo IBAMA) conforme Resoluções CMN 5.193/2024 e 5.268/2025.',
                },
                {
                  tab: 'conhecimento' as TabId,
                  icon: BookOpen,
                  color: 'blue',
                  title: 'Base de Conhecimento',
                  desc: 'Programas de crédito rural, documentação necessária, taxas, prazos e requisitos atualizados (MCR, CMN, Banco Central).',
                },
              ].map(card => (
                <button
                  key={card.tab}
                  onClick={() => setActiveTab(card.tab)}
                  className={`text-left p-6 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-green-300 transition group`}
                >
                  <card.icon className={`w-8 h-8 text-${card.color}-600 mb-3`} />
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{card.title}</h3>
                  <p className="text-sm text-gray-500">{card.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-sm text-green-600 opacity-0 group-hover:opacity-100 transition">
                    Acessar <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="bg-white/50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 text-center">
              <Scale className="w-4 h-4 inline mr-1 opacity-50" />
              As informações fornecidas pelo AgrolexI têm caráter orientativo e educacional. Não substituem consultoria jurídica ou financeira especializada. Consulte sempre um advogado ou contador antes de tomar decisões sobre crédito rural.
            </div>
          </div>
        )}

        {/* ─── ELEGIBILIDADE ────────────────────────────────────────────── */}
        {activeTab === 'elegibilidade' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-600" /> Diagnóstico de Elegibilidade</h2>
              <p className="text-sm text-gray-400 mt-1">Os dados de ônus e área são puxados automaticamente da auditoria da matrícula quando disponível. Complemente o perfil cadastral abaixo.</p>
            </div>

            {/* Integração com a matrícula */}
            {matriculaLoading ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Buscando auditoria da matrícula desta propriedade...
              </div>
            ) : matriculaData?.found ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Dados integrados da auditoria da matrícula{matriculaData.numero_matricula ? ` nº ${matriculaData.numero_matricula}` : ''}
                </div>
                <div className="mt-1 text-xs text-green-700 grid grid-cols-2 md:grid-cols-4 gap-1">
                  <span>Situação: <strong>{matriculaData.matricula_limpa ? 'Limpa' : 'Com restrições'}</strong></span>
                  <span>Hipotecas: <strong>{matriculaData.hipotecas_vigentes}</strong></span>
                  <span>Penhoras: <strong>{matriculaData.penhoras_vigentes}</strong></span>
                  <span>Risco: <strong>{matriculaData.risk_level ?? '—'}</strong></span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Nenhuma auditoria de matrícula concluída para esta propriedade. Os ônus serão considerados conforme você informar manualmente. Para máxima precisão, faça primeiro a análise da matrícula.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Formulário */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2"><FileText className="w-4 h-4" /> Perfil do Produtor</h3>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-400">Tipo de produtor</span>
                    <select className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eligForm.tipo_produtor} onChange={e => setEligForm({...eligForm, tipo_produtor: e.target.value as 'familiar'|'medio'|'grande'})}>
                      <option value="familiar">Familiar (Pronaf)</option>
                      <option value="medio">Médio (Pronamp)</option>
                      <option value="grande">Grande</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Renda bruta anual (R$)</span>
                    <input type="number" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 500000" value={eligForm.renda_bruta_anual} onChange={e => setEligForm({...eligForm, renda_bruta_anual: e.target.value})} />
                  </label>
                </div>

                <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2 pt-2"><ShieldCheck className="w-4 h-4" /> Situação Cadastral</h3>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'car_ativo', label: 'CAR ativo' },
                    { key: 'ccir_vigente', label: 'CCIR vigente' },
                    { key: 'itr_regular', label: 'ITR regular' },
                    { key: 'dap_caf_valida', label: 'DAP/CAF válida' },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="rounded bg-white border-gray-300" checked={eligForm[f.key as keyof typeof eligForm] as boolean} onChange={e => setEligForm({...eligForm, [f.key]: e.target.checked})} />
                      {f.label}
                    </label>
                  ))}
                </div>

                <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2 pt-2"><DollarSign className="w-4 h-4" /> Histórico</h3>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'credito_rural_vigente', label: 'Crédito rural vigente' },
                    { key: 'inadimplencia_credito_rural', label: 'Inadimplência' },
                    { key: 'cadin_serasa', label: 'Restrição CADIN/SERASA' },
                    { key: 'embargo_ibama', label: 'Embargo IBAMA' },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="rounded bg-white border-gray-300" checked={eligForm[f.key as keyof typeof eligForm] as boolean} onChange={e => setEligForm({...eligForm, [f.key]: e.target.checked})} />
                      {f.label}
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-400">Hipotecas</span>
                    <input type="number" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eligForm.hipotecas_vigentes} onChange={e => setEligForm({...eligForm, hipotecas_vigentes: e.target.value})} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Penhoras</span>
                    <input type="number" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eligForm.penhoras_vigentes} onChange={e => setEligForm({...eligForm, penhoras_vigentes: e.target.value})} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Área gravada (ha)</span>
                    <input type="number" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eligForm.area_gravada_ha} onChange={e => setEligForm({...eligForm, area_gravada_ha: e.target.value})} />
                  </label>
                </div>

                <button
                  onClick={handleEligibilidade}
                  disabled={eligLoading || !selectedProperty}
                  className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {eligLoading ? 'Calculando...' : 'Calcular Elegibilidade'}
                </button>
              </div>

              {/* Resultado */}
              <div className="space-y-4">
                {eligResult && !eligResult.error && (
                  <>
                    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                      <div className={`text-5xl font-bold ${scoreColor(eligResult.score)}`}>{eligResult.score}</div>
                      <div className="text-sm text-gray-400 mt-1">Score de Elegibilidade</div>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium border ${faixaBadge(eligResult.faixa)}`}>
                        {eligResult.faixa?.toUpperCase()}
                      </span>
                    </div>

                    {/* Eixos */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700">Eixos de Avaliação</h3>
                      {Object.values(eligResult.axes ?? {}).map((ax: unknown) => {
                        const axis = ax as { label: string; score: number; weight: number; details: string[] };
                        return (
                          <div key={axis.label}>
                            <div className="flex justify-between text-sm">
                              <span>{axis.label} ({(axis.weight * 100).toFixed(0)}%)</span>
                              <span className={scoreColor(axis.score)}>{axis.score}/100</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                              <div className={`h-2 rounded-full ${axis.score >= 70 ? 'bg-green-500' : axis.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${axis.score}%` }} />
                            </div>
                            {axis.details?.map((d: string, i: number) => (
                              <p key={i} className="text-xs text-gray-500 mt-0.5 pl-2">- {d}</p>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Programas */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700">Programas de Crédito</h3>
                      {eligResult.programas_elegiveis?.map((p: { programa_id: string; nome: string; elegivel: boolean; motivo: string; taxa_juros_estimada: string; valor_max_estimado: number | null }) => (
                        <div key={p.programa_id} className={`p-3 rounded-lg border ${p.elegivel ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{p.nome}</span>
                            {p.elegivel ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-400" />}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{p.motivo}</p>
                          {p.elegivel && p.valor_max_estimado && (
                            <p className="text-xs text-green-700 mt-1">Valor estimado: R$ {p.valor_max_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Taxa: {p.taxa_juros_estimada}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {eligResult.observacoes?.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 className="font-semibold text-sm text-gray-700 mb-2">Observações</h3>
                        {eligResult.observacoes.map((o: string, i: number) => (
                          <p key={i} className="text-xs text-gray-400">- {o}</p>
                        ))}
                      </div>
                    )}

                    {/* Vigência + disclaimer + exportar */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 no-print">
                      {eligResult.parametros_vigencia && (
                        <p className="text-[11px] text-gray-500">Parâmetros: {eligResult.parametros_vigencia}</p>
                      )}
                      {eligResult.disclaimer && (
                        <p className="text-[11px] text-gray-500 leading-relaxed"><Scale className="w-3 h-3 inline mr-1 opacity-50" />{eligResult.disclaimer}</p>
                      )}
                      <button onClick={() => window.print()} className="w-full mt-1 py-2 rounded-lg border border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 transition flex items-center justify-center gap-2">
                        <FileText className="w-4 h-4" /> Exportar diagnóstico em PDF
                      </button>
                    </div>
                  </>
                )}

                {eligResult?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{eligResult.error}</div>
                )}

                {!eligResult && (
                  <div className="bg-white/50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Preencha o formulário e clique em &quot;Calcular&quot; para ver o diagnóstico.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── DEFESA ───────────────────────────────────────────────────── */}
        {activeTab === 'defesa' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><Gavel className="w-5 h-5 text-amber-600" /> Defesa em Execução de Crédito Rural</h2>
              <p className="text-sm text-gray-400 mt-1">Análise de cédulas de crédito rural para identificar vícios, abusividades e estratégias de defesa.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">Dados da Cédula</h3>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-400">Tipo de cédula</span>
                    <select className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.tipo_cedula} onChange={e => setDefForm({...defForm, tipo_cedula: e.target.value})}>
                      <option value="CPR">CPR — Cédula de Produto Rural</option>
                      <option value="CCR">CCR — Cédula de Crédito Rural</option>
                      <option value="CDCA">CDCA</option>
                      <option value="NCR">NCR — Nota de Crédito Rural</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Valor principal (R$)</span>
                    <input type="number" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.valor_principal} onChange={e => setDefForm({...defForm, valor_principal: e.target.value})} placeholder="100000" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-400">Credor (banco)</span>
                    <input type="text" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.credor} onChange={e => setDefForm({...defForm, credor: e.target.value})} placeholder="Banco do Brasil" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Devedor</span>
                    <input type="text" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.devedor} onChange={e => setDefForm({...defForm, devedor: e.target.value})} placeholder="Nome do produtor" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-400">Taxa juros contratual (% a.a.)</span>
                    <input type="number" step="0.01" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.taxa_juros_contratual} onChange={e => setDefForm({...defForm, taxa_juros_contratual: e.target.value})} placeholder="8.5" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Taxa mora contratual (% a.a.)</span>
                    <input type="number" step="0.01" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.taxa_mora_contratual} onChange={e => setDefForm({...defForm, taxa_mora_contratual: e.target.value})} placeholder="12" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-400">Data emissão</span>
                    <input type="date" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.data_emissao} onChange={e => setDefForm({...defForm, data_emissao: e.target.value})} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Data vencimento</span>
                    <input type="date" className="w-full mt-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" value={defForm.data_vencimento} onChange={e => setDefForm({...defForm, data_vencimento: e.target.value})} />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="rounded bg-white border-gray-300" checked={defForm.capitalizacao_juros} onChange={e => setDefForm({...defForm, capitalizacao_juros: e.target.checked})} />
                  Capitalização de juros (juros sobre juros)
                </label>

                <button
                  onClick={handleDefesa}
                  disabled={defLoading}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition disabled:opacity-50"
                >
                  {defLoading ? 'Analisando...' : 'Analisar Cédula'}
                </button>
              </div>

              <div className="space-y-4">
                {defResult && !defResult.error && (
                  <>
                    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                      <div className={`text-5xl font-bold ${scoreColor(defResult.score_defesa)}`}>{defResult.score_defesa}</div>
                      <div className="text-sm text-gray-400 mt-1">Score de Defesa</div>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium border ${
                        defResult.score_defesa >= 70 ? 'bg-green-100 text-green-700 border-green-300' :
                        defResult.score_defesa >= 40 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                        'bg-red-100 text-red-700 border-red-300'
                      }`}>
                        {defResult.estrategia_recomendada?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
                      {defResult.resumo}
                    </div>

                    {defResult.defects?.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                        <h3 className="font-semibold text-sm text-gray-700">Irregularidades Detectadas ({defResult.defects.length})</h3>
                        {defResult.defects.map((d: { titulo: string; descricao: string; base_legal: string; tese_defensiva: string; severity: string }, i: number) => (
                          <div key={i} className={`p-3 rounded-lg border ${d.severity === 'critico' ? 'border-red-200 bg-red-50' : d.severity === 'grave' ? 'border-orange-200 bg-orange-50' : 'border-yellow-200 bg-yellow-50'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-sm">{d.titulo}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded ${d.severity === 'critico' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{d.severity}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{d.descricao}</p>
                            <p className="text-xs text-amber-700 mt-1">Base legal: {d.base_legal}</p>
                            <p className="text-xs text-green-700 mt-1">Tese: {d.tese_defensiva}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {defResult.prescricao && (
                      <div className={`bg-white border rounded-xl p-4 ${defResult.prescricao.prescrita ? 'border-green-500/30' : 'border-gray-200'}`}>
                        <h3 className="font-semibold text-sm text-gray-700 mb-1">Prescrição</h3>
                        {defResult.prescricao.prescrita ? (
                          <p className="text-sm text-green-700">Crédito PRESCRITO em {defResult.prescricao.data_prescricao} — tese de defesa com alta chance de êxito</p>
                        ) : defResult.prescricao.dias_restantes !== null ? (
                          <p className="text-sm text-gray-400">Prescreve em {defResult.prescricao.data_prescricao} ({defResult.prescricao.dias_restantes} dias restantes)</p>
                        ) : (
                          <p className="text-sm text-gray-400">Data de vencimento não informada</p>
                        )}
                      </div>
                    )}

                    {defResult.disclaimer && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-[11px] text-amber-800 leading-relaxed"><Scale className="w-3 h-3 inline mr-1" />{defResult.disclaimer}</p>
                        <button onClick={() => window.print()} className="w-full mt-2 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-100 transition flex items-center justify-center gap-2 no-print">
                          <FileText className="w-4 h-4" /> Exportar análise em PDF
                        </button>
                      </div>
                    )}
                  </>
                )}

                {defResult?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{defResult.error}</div>
                )}

                {!defResult && (
                  <div className="bg-white/50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <Gavel className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Preencha os dados da cédula para analisar vícios e estratégias de defesa.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── AMBIENTAL ────────────────────────────────────────────────── */}
        {activeTab === 'ambiental' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><TreePine className="w-5 h-5 text-emerald-600" /> Conformidade Ambiental para Crédito</h2>
              <p className="text-sm text-gray-400 mt-1">Verificação de barreiras ambientais que podem impedir ou condicionar o acesso ao crédito rural.</p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleAmbiental}
                disabled={ambLoading || !selectedProperty}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition disabled:opacity-50"
              >
                {ambLoading ? 'Verificando...' : 'Verificar Conformidade Ambiental'}
              </button>
            </div>

            {ambResult && !ambResult.error && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {statusIcon(ambResult.status)}
                    <span className="text-lg font-semibold">
                      {ambResult.status === 'conforme' ? 'Conforme' :
                       ambResult.status === 'nao_conforme' ? 'Não Conforme' :
                       ambResult.status === 'verificacao_necessaria' ? 'Verificação Necessária' : 'Sem Dados'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">{ambResult.impacto_credito}</p>
                </div>

                {ambResult.recomendacoes?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="font-semibold text-sm text-gray-700 mb-2">Recomendações</h3>
                    {ambResult.recomendacoes.map((r: string, i: number) => (
                      <p key={i} className="text-sm text-gray-400 py-1">- {r}</p>
                    ))}
                  </div>
                )}

                <div className="bg-white/50 border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-2">Resoluções Aplicáveis</h3>
                  {ambResult.resolucoes_aplicaveis?.map((r: string, i: number) => (
                    <p key={i} className="text-xs text-gray-500 py-0.5">- {r}</p>
                  ))}
                </div>

                {/* Aviso de fonte autodeclarada — honestidade sobre a verificação */}
                {ambResult.fonte_dados === 'autodeclarado' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs text-amber-800 font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Verificação baseada em dados autodeclarados</p>
                    {ambResult.disclaimer && <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">{ambResult.disclaimer}</p>}
                  </div>
                )}

                <button onClick={() => window.print()} className="w-full py-2 rounded-lg border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition flex items-center justify-center gap-2 no-print">
                  <FileText className="w-4 h-4" /> Exportar verificação em PDF
                </button>
              </div>
            )}

            {ambResult?.error && (
              <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{ambResult.error}</div>
            )}
          </div>
        )}

        {/* ─── CONHECIMENTO ─────────────────────────────────────────────── */}
        {activeTab === 'conhecimento' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> Base de Conhecimento — Crédito Rural</h2>
              <p className="text-sm text-gray-400 mt-1">Programas, documentação e requisitos atualizados.</p>
            </div>

            {conhecLoading ? (
              <div className="text-center py-8 text-gray-500 animate-pulse">Carregando programas...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {programas.map((p: { id: string; nome: string; nome_completo: string; publico_alvo: string; taxa_juros: string; prazo_max: string; requisitos: string[]; base_legal: string[] }) => (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 hover:border-blue-300 hover:shadow-md transition">
                    <h3 className="font-semibold text-base">{p.nome}</h3>
                    <p className="text-xs text-gray-400">{p.nome_completo}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Público-alvo:</span> <span className="text-gray-700 text-right">{p.publico_alvo}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Taxa:</span> <span className="text-green-700">{p.taxa_juros}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Prazo máx:</span> <span className="text-gray-700">{p.prazo_max}</span></div>
                    </div>
                    {p.requisitos?.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500">Requisitos:</span>
                        <ul className="mt-1 space-y-0.5">
                          {p.requisitos.slice(0, 4).map((r: string, i: number) => (
                            <li key={i} className="text-xs text-gray-400">- {r}</li>
                          ))}
                          {p.requisitos.length > 4 && <li className="text-xs text-gray-500">+{p.requisitos.length - 4} mais</li>}
                        </ul>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600">
                      {p.base_legal?.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
