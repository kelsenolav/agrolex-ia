"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  TrendingUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  Award,
  Zap,
  Filter,
  Flame,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { calculateInterestScore, getCommercialScoreBadge } from '@/lib/commercial/scoring';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface MarketingLead {
  id: string;
  created_at: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  tipo_usuario: string | null;
  origem: string;
  converteu: boolean;
  converted_at: string | null;
  trial_utilizado: boolean;
  ultima_atividade: string;
  metadata?: Record<string, any> | null;
  // Campos estruturados que podem vir do banco futuramente
  interest_registered?: boolean;
  interest_registered_at?: string | null;
  interest_plan?: string | null;
  interest_volume?: string | null;
  interest_status?: string | null;
}

interface LeadMetrics {
  total: number;
  ultimos7dias: number;
  convertidos: number;
  taxaConversao: number;
  totalInteressados: number;
  leadScoreMedio: number;
  planoMaisDesejado: string;
  potencialUsoMensal: number;
  perfilMaisFrequente: string;
}

const STATUS_VALORES = ['Novo', 'Contato Realizado', 'Qualificado', 'Aguardando Mercado Pago', 'Convertido'];

// Helper para extrair informações de interesse de um lead (estruturado ou metadata JSONB)
function getLeadInterestInfo(lead: MarketingLead) {
  const metadataInfo = lead.metadata?.interest_info || {};
  return {
    interest_registered: lead.interest_registered || metadataInfo.interest_registered || false,
    interest_registered_at: lead.interest_registered_at || metadataInfo.interest_registered_at || null,
    interest_plan: lead.interest_plan || metadataInfo.interest_plan || null,
    interest_volume: lead.interest_volume || metadataInfo.interest_volume || null,
    interest_status: lead.interest_status || metadataInfo.interest_status || 'Novo',
    tipo_usuario: lead.tipo_usuario || metadataInfo.tipo_usuario || null,
    whatsapp: lead.whatsapp || metadataInfo.whatsapp || null,
    nome: lead.nome || metadataInfo.nome || '',
  };
}

// Helper para calcular o score comercial consolidado
function getLeadCommercialScore(lead: MarketingLead) {
  const info = getLeadInterestInfo(lead);
  if (!info.interest_registered) return 10; // Score base do lead
  return calculateInterestScore(info.interest_plan, info.interest_volume);
}

// Helper para converter volume de interesse em número de análises estimadas para o KPI
function parseVolumeToNumber(volumeStr?: string | null): number {
  if (!volumeStr) return 0;
  const vol = volumeStr.toLowerCase();
  if (vol.includes('mais de 100') || vol.includes('> 100')) return 150;
  if (vol.includes('até 100')) return 100;
  if (vol.includes('até 25') || vol.includes('25')) return 25;
  if (vol.includes('até 5') || vol.includes('5')) return 5;
  return 0;
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [metrics, setMetrics] = useState<LeadMetrics>({
    total: 0,
    ultimos7dias: 0,
    convertidos: 0,
    taxaConversao: 0,
    totalInteressados: 0,
    leadScoreMedio: 0,
    planoMaisDesejado: '—',
    potencialUsoMensal: 0,
    perfilMaisFrequente: '—',
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Estados dos Filtros
  const [filtroPlano, setFiltroPlano] = useState<string>('');
  const [filtroPerfil, setFiltroPerfil] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroScoreMin, setFiltroScoreMin] = useState<string>('');

  const trackDashboardEvent = async (accessToken: string, eventType: string, meta: Record<string, any> = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      if (!user) return;
      await fetch('/api/marketing/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_event',
          userId: user.id,
          email: user.email,
          eventType,
          meta,
        }),
      });
    } catch (err) {
      console.error('[dashboard/leads] erro ao enviar telemetria:', err);
    }
  };

  const fetchLeads = async (accessToken: string) => {
    const res = await fetch('/api/marketing/leads', {
      headers: { 'x-agrolex-session': accessToken },
    });

    if (!res.ok) return [];

    const body = await res.json();
    return (body.leads ?? []) as MarketingLead[];
  };

  useEffect(() => {
    const init = async () => {
      // Verificar sessão
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Verificar role admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setIsAdmin(true);

      try {
        const data = await fetchLeads(session.access_token);
        setLeads(data);

        // Envia telemetria de visualização do painel comercial
        await trackDashboardEvent(session.access_token, 'commercial_dashboard_view');

        // Calcular métricas executivas
        const agora = new Date();
        const sete = new Date(agora);
        sete.setDate(agora.getDate() - 7);

        const ultimos7 = data.filter(
          (l) => new Date(l.created_at) >= sete
        ).length;
        const convertidos = data.filter((l) => l.converteu).length;

        const interessadosLeads = data.filter((l) => {
          const info = getLeadInterestInfo(l);
          return info.interest_registered;
        });

        const totalInteressados = interessadosLeads.length;

        // Calcular Score Comercial Médio dos leads interessados
        const scores = interessadosLeads.map(l => getLeadCommercialScore(l));
        const leadScoreMedio = totalInteressados > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalInteressados)
          : 0;

        // Calcular Plano Mais Desejado
        const planosCount: Record<string, number> = {};
        interessadosLeads.forEach(l => {
          const info = getLeadInterestInfo(l);
          if (info.interest_plan) {
            planosCount[info.interest_plan] = (planosCount[info.interest_plan] || 0) + 1;
          }
        });
        let planoMaisDesejado = '—';
        let maxPlanoCount = 0;
        Object.entries(planosCount).forEach(([plano, count]) => {
          if (count > maxPlanoCount) {
            maxPlanoCount = count;
            planoMaisDesejado = plano;
          }
        });

        // Calcular Potencial de Uso Mensal
        let potencialUsoMensal = 0;
        interessadosLeads.forEach(l => {
          const info = getLeadInterestInfo(l);
          potencialUsoMensal += parseVolumeToNumber(info.interest_volume);
        });

        // Calcular Perfil Mais Frequente
        const perfisCount: Record<string, number> = {};
        interessadosLeads.forEach(l => {
          const info = getLeadInterestInfo(l);
          if (info.tipo_usuario) {
            perfisCount[info.tipo_usuario] = (perfisCount[info.tipo_usuario] || 0) + 1;
          }
        });
        let perfilMaisFrequente = '—';
        let maxPerfilCount = 0;
        Object.entries(perfisCount).forEach(([perfil, count]) => {
          if (count > maxPerfilCount) {
            maxPerfilCount = count;
            perfilMaisFrequente = perfil;
          }
        });

        setMetrics({
          total: data.length,
          ultimos7dias: ultimos7,
          convertidos,
          taxaConversao:
            data.length > 0
              ? Math.round((convertidos / data.length) * 100)
              : 0,
          totalInteressados,
          leadScoreMedio,
          planoMaisDesejado,
          potencialUsoMensal,
          perfilMaisFrequente,
        });
      } catch (err) {
        console.error('[dashboard/leads] erro ao carregar:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const handleStatusChange = async (email: string, status: string) => {
    setUpdatingId(email);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch('/api/marketing/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_interest_status',
          email,
          status,
        }),
      });

      if (res.ok) {
        // Envia telemetria de mudança de status
        await trackDashboardEvent(session.access_token, 'lead_status_changed', { email, status });
        const updatedLeads = await fetchLeads(session.access_token);
        setLeads(updatedLeads);
      }
    } catch (err) {
      console.error('[dashboard/leads] erro ao atualizar status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const trackPriorityView = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      await trackDashboardEvent(session.access_token, 'lead_priority_view');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Carregando leads...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  // Processamento e filtragem de leads
  const processedLeads = leads.map(l => {
    const interest = getLeadInterestInfo(l);
    const score = getLeadCommercialScore(l);
    return {
      ...l,
      interest,
      score,
    };
  });

  // Ordenação principal: Maior Score → Menor Score (Leads mais quentes primeiro)
  const sortedLeads = [...processedLeads].sort((a, b) => b.score - a.score);

  // Aplicação dos filtros
  const filteredLeads = sortedLeads.filter(lead => {
    if (filtroPlano && lead.interest.interest_plan !== filtroPlano) return false;
    if (filtroPerfil && lead.interest.tipo_usuario !== filtroPerfil) return false;
    if (filtroStatus && lead.interest.interest_status !== filtroStatus) return false;
    if (filtroScoreMin && lead.score < Number(filtroScoreMin)) return false;
    return true;
  });

  // Oportunidades Comerciais: Top 10 leads interessados mais quentes
  const top10HotLeads = sortedLeads
    .filter(lead => lead.interest.interest_registered)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-brand-gold"
          >
            <Logo size="sm" className="text-white" />
          </Link>
          <span className="text-xs bg-brand-gold/20 text-brand-gold px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            Admin
          </span>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-medium"
        >
          <ArrowLeft size={20} /> Voltar ao painel
        </Link>

        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Painel Comercial & CRM
            </h1>
            <p className="text-gray-600 mt-1">
              Priorização de leads interessados · Fila comercial · Conversão de planos
            </p>
          </div>
          <button
            onClick={() => {
              trackPriorityView();
              alert("Modo de Visão de Prioridade Comercial Ativado. Telemetria enviada.");
            }}
            className="flex items-center justify-center gap-2 bg-brand-gold hover:bg-brand-gold/90 text-gray-900 font-bold px-4 py-2 rounded-lg transition-all shadow-sm text-sm"
          >
            <Zap size={16} /> Visão de Prioridade
          </button>
        </div>

        {/* KPIs Executivos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-10">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                Total Interessados
              </span>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users size={18} className="text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {metrics.totalInteressados}
            </p>
            <div className="text-xs text-gray-400">Na fila de prioridade</div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                Lead Score Médio
              </span>
              <div className="p-2 bg-amber-100 rounded-lg">
                <Award size={18} className="text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {metrics.leadScoreMedio} pts
            </p>
            <div className="text-xs text-gray-400">Qualificação média</div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                Plano Mais Desejado
              </span>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp size={18} className="text-green-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800 truncate" title={metrics.planoMaisDesejado}>
              {metrics.planoMaisDesejado}
            </p>
            <div className="text-xs text-gray-400">Maior volume de interesse</div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                Potencial Mensal
              </span>
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign size={18} className="text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {metrics.potencialUsoMensal}
            </p>
            <div className="text-xs text-gray-400">Análises potenciais/mês</div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                Perfil Frequente
              </span>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Users size={18} className="text-indigo-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800 truncate" title={metrics.perfilMaisFrequente}>
              {metrics.perfilMaisFrequente}
            </p>
            <div className="text-xs text-gray-400">Principal persona</div>
          </div>
        </div>

        {/* Grid de Seções Principais (Esquerda: Tabela & Filtros, Direita: Oportunidades Quentes) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Coluna da Tabela (Ocupa 2/3 no Desktop) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filtros */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                <Filter size={16} className="text-brand-green" />
                Filtros de Segmentação
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Plano de Interesse</label>
                  <select
                    value={filtroPlano}
                    onChange={(e) => setFiltroPlano(e.target.value)}
                    className="w-full border border-gray-200 rounded p-2 text-xs focus:ring-1 focus:ring-brand-green focus:outline-none"
                  >
                    <option value="">Todos os Planos</option>
                    <option value="Usuário Ocasional">Usuário Ocasional</option>
                    <option value="Profissional">Profissional</option>
                    <option value="Empresarial">Empresarial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Perfil / Tipo</label>
                  <select
                    value={filtroPerfil}
                    onChange={(e) => setFiltroPerfil(e.target.value)}
                    className="w-full border border-gray-200 rounded p-2 text-xs focus:ring-1 focus:ring-brand-green focus:outline-none"
                  >
                    <option value="">Todos os Perfis</option>
                    <option value="Produtor Rural">Produtor Rural</option>
                    <option value="Advogado">Advogado</option>
                    <option value="Corretor">Corretor</option>
                    <option value="Investidor">Investidor</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Status do Lead</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full border border-gray-200 rounded p-2 text-xs focus:ring-1 focus:ring-brand-green focus:outline-none"
                  >
                    <option value="">Todos os Status</option>
                    {STATUS_VALORES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Score Mínimo</label>
                  <input
                    type="number"
                    value={filtroScoreMin}
                    onChange={(e) => setFiltroScoreMin(e.target.value)}
                    placeholder="Ex: 50"
                    className="w-full border border-gray-200 rounded p-2 text-xs focus:ring-1 focus:ring-brand-green focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Tabela de Leads */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <BarChart3 size={18} className="text-brand-green" />
                    Lista Geral de Leads
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {filteredLeads.length} lead(s) encontrado(s) · Ordenado por Score Comercial (Mais quentes primeiro)
                  </p>
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  Nenhum lead corresponde aos filtros aplicados.
                </div>
              ) : (
                <table className="w-full text-left min-w-[1000px]">
                  <thead className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Nome / E-mail</th>
                      <th className="px-5 py-4 font-semibold">Plano Desejado</th>
                      <th className="px-5 py-4 font-semibold">Volume / Perfil</th>
                      <th className="px-5 py-4 font-semibold">Data de Interesse</th>
                      <th className="px-5 py-4 font-semibold">Score</th>
                      <th className="px-5 py-4 font-semibold">Status Comercial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLeads.map((lead) => {
                      const scoreBadge = getCommercialScoreBadge(lead.score);
                      return (
                        <tr
                          key={lead.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-5 py-4 text-sm">
                            <div className="font-semibold text-gray-800">{lead.interest.nome || lead.nome || '—'}</div>
                            <div className="text-xs text-gray-400">{lead.email}</div>
                            {lead.interest.whatsapp && (
                              <div className="text-xs text-gray-500 font-medium mt-0.5">WhatsApp: {lead.interest.whatsapp}</div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {lead.interest.interest_registered ? (
                              <div>
                                <span className="font-semibold text-brand-green">{lead.interest.interest_plan || '—'}</span>
                                <span className="text-[10px] block text-gray-400">Origem: {lead.origem}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">Não manifestou interesse</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <div className="font-medium text-gray-700">{lead.interest.interest_volume || '—'}</div>
                            <div className="text-xs text-gray-400">{lead.interest.tipo_usuario || '—'}</div>
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-500">
                            {lead.interest.interest_registered_at ? (
                              new Date(lead.interest.interest_registered_at).toLocaleString('pt-BR')
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-800">{lead.score}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${scoreBadge.colorClass}`}
                                title={`Temperatura: ${scoreBadge.label}`}
                              >
                                {scoreBadge.emoji} {scoreBadge.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {lead.interest.interest_registered ? (
                              <select
                                disabled={updatingId === lead.email}
                                value={lead.interest.interest_status}
                                onChange={(e) => handleStatusChange(lead.email, e.target.value)}
                                className="border border-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-brand-green focus:outline-none bg-white font-medium text-gray-700 disabled:opacity-50"
                              >
                                {STATUS_VALORES.map(st => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Coluna Oportunidades Comerciais (Top 10 Quentes - 1/3) */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-md font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Flame size={18} className="text-red-500 fill-red-500" />
              Oportunidades Quentes (Top 10)
            </h3>
            <p className="text-xs text-gray-500">
              Leads que demonstraram intenção comercial ordenados pela pontuação de temperatura.
            </p>

            {top10HotLeads.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs italic">
                Nenhum lead com interesse registrado.
              </div>
            ) : (
              <div className="space-y-3">
                {top10HotLeads.map((lead, idx) => {
                  const badge = getCommercialScoreBadge(lead.score);
                  return (
                    <div
                      key={lead.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-brand-gold/50 transition-all flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-green truncate max-w-[140px]" title={lead.interest.nome || lead.nome}>
                          {idx + 1}. {lead.interest.nome || lead.nome || 'Lead'}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          <span className="text-gray-700">{lead.score} pts</span>
                          <span>{badge.emoji}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium">
                        Plano: <span className="text-gray-700">{lead.interest.interest_plan}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium">
                        Volume: <span className="text-gray-700">{lead.interest.interest_volume}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-400 pt-1 border-t border-gray-200/60 mt-1">
                        <span>{lead.interest.interest_registered_at ? new Date(lead.interest.interest_registered_at).toLocaleDateString('pt-BR') : '—'}</span>
                        <span className="font-bold text-gray-600 uppercase bg-gray-200/50 px-1 rounded">{lead.interest.interest_status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
