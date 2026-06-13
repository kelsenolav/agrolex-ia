"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, BarChart3, TrendingUp, Target, ClipboardList, Filter, Thermometer, Flame, Snowflake, Wind } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import {
  calculateLeadScore,
  getCommercialScoreLevel,
  getCommercialScoreLabel,
  getCommercialScoreBadge,
  getLastCommercialEvent,
  compareLeadScores,
  type CommercialScoreLevel,
} from '@/lib/commercial/scoring';

interface LeadMetrics {
  totalLeads: number;
  totalTrials: number;
  totalConversoes: number;
  taxaConversao: number;
  isfMedio: number | null;
  // FASE 3: KPIs de temperatura
  leadsFrios: number;
  leadsMornos: number;
  leadsQuentes: number;
  leadsMuitoQuentes: number;
}

interface LeadComScore {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  origem: string | null;
  converted_at: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  // derivados
  score: number;
  nivel: CommercialScoreLevel;
  ultimoEvento: string | null;
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<LeadMetrics>({
    totalLeads: 0,
    totalTrials: 0,
    totalConversoes: 0,
    taxaConversao: 0,
    isfMedio: null,
    leadsFrios: 0,
    leadsMornos: 0,
    leadsQuentes: 0,
    leadsMuitoQuentes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadComScore[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (leadsData) {
          // FASE 3: calcular score e nível para cada lead
          const leadsComScore: LeadComScore[] = leadsData.map((l: any) => {
            const metadata = (l.metadata as Record<string, unknown> | null) ?? null;
            const score = calculateLeadScore(metadata);
            const nivel = getCommercialScoreLevel(score);
            const ultimoEvt = getLastCommercialEvent(metadata);
            const ultimoEvento = ultimoEvt
              ? `${ultimoEvt.type} (${new Date(ultimoEvt.timestamp).toLocaleDateString('pt-BR')})`
              : null;
            return {
              id: l.id,
              nome: l.nome ?? null,
              email: l.email ?? null,
              telefone: l.telefone ?? null,
              cidade: l.cidade ?? null,
              estado: l.estado ?? null,
              origem: l.origem ?? null,
              converted_at: l.converted_at ?? null,
              created_at: l.created_at ?? null,
              metadata,
              score,
              nivel,
              ultimoEvento,
            };
          });

          // Ordenar: muito_quente → quente → morno → frio
          leadsComScore.sort((a, b) => compareLeadScores(a.score, b.score));

          setLeads(leadsComScore);

          // KPIs de temperatura
          const frios = leadsComScore.filter(l => l.nivel === 'frio').length;
          const mornos = leadsComScore.filter(l => l.nivel === 'morno').length;
          const quentes = leadsComScore.filter(l => l.nivel === 'quente').length;
          const muitoQuentes = leadsComScore.filter(l => l.nivel === 'muito_quente').length;

          setMetrics({
            totalLeads: leadsData.length,
            totalTrials: leadsData.filter((l: any) => l.origem === 'trial' || l.origem === 'cadastro').length,
            totalConversoes: leadsData.filter((l: any) => l.converted_at).length,
            taxaConversao: leadsData.length > 0
              ? Math.round((leadsData.filter((l: any) => l.converted_at).length / leadsData.length) * 100)
              : 0,
            isfMedio: null,
            leadsFrios: frios,
            leadsMornos: mornos,
            leadsQuentes: quentes,
            leadsMuitoQuentes: muitoQuentes,
          });
        }

        const { data: analysesData } = await supabase
          .from('analyses')
          .select('findings')
          .eq('status', 'completed');

        if (analysesData && analysesData.length > 0) {
          const scores: number[] = [];
          for (const a of analysesData) {
            const isf = (a.findings as any)?.isf_v2?.isf_score;
            if (typeof isf === 'number') scores.push(isf);
          }
          if (scores.length > 0) {
            const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            setMetrics(prev => ({ ...prev, isfMedio: avg }));
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard de leads:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold">
            <Logo size="sm" className="text-white" />
          </Link>
          <span className="text-xs bg-brand-gold/20 text-brand-gold px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            Admin
          </span>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Voltar ao painel
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard Comercial</h1>
          <p className="text-gray-600 mt-1">Métricas de Leads, Trials, Conversões e Lead Scoring</p>
        </div>

        {/* KPIs — Linha 1: métricas base */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
          {/* Total Leads */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Leads</span>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users size={18} className="text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">{metrics.totalLeads}</p>
            <div className="text-xs text-gray-400">Cadastros capturados</div>
          </div>

          {/* Total Trials */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Trials</span>
              <div className="p-2 bg-green-100 rounded-lg">
                <Target size={18} className="text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">{metrics.totalTrials}</p>
            <div className="text-xs text-gray-400">Usuários em trial</div>
          </div>

          {/* Total Conversões */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Conversões</span>
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp size={18} className="text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">{metrics.totalConversoes}</p>
            <div className="text-xs text-gray-400">Leads convertidos</div>
          </div>

          {/* Taxa de Conversão */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Taxa Conversão</span>
              <div className="p-2 bg-brand-gold/20 rounded-lg">
                <BarChart3 size={18} className="text-brand-gold" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">{metrics.taxaConversao}%</p>
            <div className="text-xs text-gray-400">Leads → Clientes</div>
          </div>

          {/* ISF Médio */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">ISF Médio</span>
              <div className="p-2 bg-purple-100 rounded-lg">
                <ClipboardList size={18} className="text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">
              {metrics.isfMedio !== null ? `${metrics.isfMedio}/100` : '--'}
            </p>
            <div className="text-xs text-gray-400">Segurança Fundiária</div>
          </div>
        </div>

        {/* KPIs — Linha 2: FASE 3 — Temperatura de Leads */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
          {/* Leads Frios */}
          <div className="bg-blue-50 p-5 rounded-xl shadow-sm border border-blue-200 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-blue-700 text-xs font-bold uppercase tracking-wider">Leads Frios</span>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Snowflake size={18} className="text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-blue-700">{metrics.leadsFrios}</p>
            <div className="text-xs text-blue-500">🧊 Score 0–30 pts</div>
          </div>

          {/* Leads Mornos */}
          <div className="bg-yellow-50 p-5 rounded-xl shadow-sm border border-yellow-200 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-yellow-700 text-xs font-bold uppercase tracking-wider">Leads Mornos</span>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Wind size={18} className="text-yellow-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-yellow-700">{metrics.leadsMornos}</p>
            <div className="text-xs text-yellow-500">🌤️ Score 31–60 pts</div>
          </div>

          {/* Leads Quentes */}
          <div className="bg-orange-50 p-5 rounded-xl shadow-sm border border-orange-200 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-orange-700 text-xs font-bold uppercase tracking-wider">Leads Quentes</span>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Flame size={18} className="text-orange-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-orange-700">{metrics.leadsQuentes}</p>
            <div className="text-xs text-orange-500">🔥 Score 61–100 pts</div>
          </div>

          {/* Leads Muito Quentes */}
          <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-red-200 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-red-700 text-xs font-bold uppercase tracking-wider">Muito Quentes</span>
              <div className="p-2 bg-red-100 rounded-lg">
                <Thermometer size={18} className="text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-red-700">{metrics.leadsMuitoQuentes}</p>
            <div className="text-xs text-red-500">🚀 Score acima de 100 pts</div>
          </div>
        </div>

        {/* Tabela de Leads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Filter size={18} className="text-brand-green" />
              Lista de Leads — Ranking por Temperatura
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {leads.length} lead(s) registrado(s) · Ordenado por score comercial (muito quente → frio)
            </p>
          </div>

          {leads.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              Nenhum lead capturado ainda.
            </div>
          ) : (
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                <tr>
                  <th className="px-5 py-4 font-semibold">Nome</th>
                  <th className="px-5 py-4 font-semibold">E-mail</th>
                  <th className="px-5 py-4 font-semibold">WhatsApp</th>
                  <th className="px-5 py-4 font-semibold">Cidade/UF</th>
                  <th className="px-5 py-4 font-semibold">Origem</th>
                  <th className="px-5 py-4 font-semibold">Score</th>
                  <th className="px-5 py-4 font-semibold">Temperatura</th>
                  <th className="px-5 py-4 font-semibold">Último Evento</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => {
                  const badge = getCommercialScoreBadge(lead.score);
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-gray-800 text-sm">{lead.nome || '—'}</td>
                      <td className="px-5 py-4 text-gray-600 text-sm">{lead.email || '—'}</td>
                      <td className="px-5 py-4 text-gray-600 text-sm">{lead.telefone || '—'}</td>
                      <td className="px-5 py-4 text-gray-600 text-sm">
                        {lead.cidade && lead.estado ? `${lead.cidade}/${lead.estado}` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          lead.origem === 'trial' ? 'bg-green-100 text-green-700' :
                          lead.origem === 'cadastro' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {lead.origem || '—'}
                        </span>
                      </td>
                      {/* Score Comercial */}
                      <td className="px-5 py-4">
                        <span className="text-sm font-black text-gray-800">{lead.score}</span>
                        <span className="text-xs text-gray-400 ml-1">pts</span>
                      </td>
                      {/* Temperatura */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${badge.colorClass}`}>
                          {badge.emoji} {badge.label}
                        </span>
                      </td>
                      {/* Último Evento */}
                      <td className="px-5 py-4 text-gray-500 text-xs max-w-[180px] truncate">
                        {lead.ultimoEvento || '—'}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        {lead.converted_at ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                            Convertido
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-500">
                            Lead
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
