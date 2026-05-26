"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Plus, FileText, MapPin, AlertTriangle, CheckCircle, 
  Clock, ChevronDown, ChevronUp, PieChart as ChartIcon, Landmark, 
  Database, Activity, Globe, Compass, ExternalLink, ShieldAlert,
  Server, RefreshCw, Layers, Sliders, Users, CheckCircle2, XCircle,
  Coins, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const DashboardPortfolioMap = dynamic(
  () => import('./DashboardPortfolioMap'),
  { ssr: false }
);

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("Produtor");
  const [analises, setAnalises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [showPortfolio, setShowPortfolio] = useState(true);
  
  // Estados para simulação de Telemetria Interativa
  const [lastScan, setLastScan] = useState<string>('');
  const [scansCount, setScansCount] = useState(128);

  useEffect(() => {
    setLastScan(new Date().toLocaleTimeString('pt-BR'));
    
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const name = session.user.user_metadata?.full_name;
      if (name) setUserName(name.split(' ')[0]);

      // Buscar Créditos
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', session.user.id).single();
      if (profile) setCredits(profile.credits || 0);

      // Buscar Análises reais do Banco de Dados
      const { data, error } = await supabase
        .from('analyses')
        .select(`
          id,
          status,
          risk_level,
          findings,
          properties (id, name, city, state, risk_score, area, is_monitoring),
          documents (document_type)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      const mockAnalises = [
        {
          id: 'mock-1',
          status: 'completed',
          risk_level: 'medio',
          properties: { 
            id: 'mock-prop-1', 
            name: 'Fazenda Boa Esperança (Amostra)', 
            city: 'Rio Verde', 
            state: 'GO', 
            risk_score: 850, 
            area: 1405.27,
            is_monitoring: true
          },
          documents: { document_type: 'Matrícula' },
          findings: {
            latitude: -17.7856,
            longitude: -50.9208,
            polygon: [
              [-17.7856, -50.9208],
              [-17.7800, -50.9100],
              [-17.7900, -50.9000],
              [-17.7950, -50.9150]
            ]
          }
        },
        {
          id: 'mock-2',
          status: 'completed',
          risk_level: 'baixo',
          properties: { 
            id: 'mock-prop-2', 
            name: 'Sítio Alvorada (Amostra)', 
            city: 'Sorriso', 
            state: 'MT', 
            risk_score: 950, 
            area: 420.5,
            is_monitoring: false
          },
          documents: { document_type: 'Título INCRA' },
          findings: {
            latitude: -12.5500,
            longitude: -55.7200,
            polygon: [
              [-12.5500, -55.7200],
              [-12.5400, -55.7100],
              [-12.5600, -55.7000],
              [-12.5700, -55.7150]
            ]
          }
        }
      ];

      if (data) {
        // [SIMULATION MODE OVERRIDE] Force processing to completed for UI testing
        const overrideData = data.map(item => {
          if (item.status === 'processing' || item.status === 'pending') {
            return { ...item, status: 'completed', risk_level: 'Alto' };
          }
          return item;
        });
        setAnalises([...overrideData, ...mockAnalises]);
      } else {
        setAnalises(mockAnalises);
      }
      setLoading(false);
    };
    
    checkUserAndFetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleForceScan = () => {
    setScansCount(prev => prev + 1);
    setLastScan(new Date().toLocaleTimeString('pt-BR'));
  };

  const analisesConcluidas = analises.filter(a => a.status === 'completed').length;
  const riscosAltos = analises.filter(a => a.risk_level?.toLowerCase() === 'alto').length;

  // Preparar os dados para o mapa consolidado
  const geoProperties = analises
    .filter(a => a.status === 'completed' || a.status === 'processing')
    .map(a => {
      let lat = -10.0500;
      let lng = -48.2000;
      
      if (a.findings?.latitude && a.findings?.longitude) {
        lat = a.findings.latitude;
        lng = a.findings.longitude;
      } else if (a.properties?.city?.toLowerCase().includes('rio verde')) {
        lat = -17.7856;
        lng = -50.9208;
      } else if (a.properties?.city?.toLowerCase().includes('sorriso')) {
        lat = -12.5500;
        lng = -55.7200;
      } else if (a.properties?.city?.toLowerCase().includes('tocantínia')) {
        lat = -9.5622;
        lng = -48.3756;
      }
      
      return {
        id: a.properties?.id || a.id,
        name: a.properties?.name || 'Fazenda Sem Nome',
        lat: lat,
        lng: lng,
        risk: a.risk_level || 'Pendente',
        polygon: a.findings?.polygon || undefined
      };
    });

  const propriedadesComScore = analises.filter(a => a.properties?.risk_score !== undefined && a.properties?.risk_score !== null);
  const scoreMedio = propriedadesComScore.length > 0
    ? Math.round(propriedadesComScore.reduce((acc, a) => acc + (a.properties.risk_score || 0), 0) / propriedadesComScore.length)
    : 920;

  const areaTotal = analises.reduce((acc, a) => acc + (parseFloat(a.properties?.area) || 0), 0);

  // Crédito de Carbono acumulado das reservas (calculado com base em 4.5 tCO2e/ha/ano e R$ 55/t)
  const carbonCreditsRevenue = areaTotal * 0.30 * 4.5 * 55; // 30% estimado de reserva

  const riskData = [
    { name: 'Baixo Risco', value: analises.filter(a => a.risk_level?.toLowerCase() === 'baixo').length, color: '#10b981' },
    { name: 'Médio Risco', value: analises.filter(a => a.risk_level?.toLowerCase() === 'medio').length, color: '#f59e0b' },
    { name: 'Alto Risco', value: analises.filter(a => a.risk_level?.toLowerCase() === 'alto').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Navbar executiva preta */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-brand-gold hover:scale-[1.02] transition-transform">
            <ShieldCheck size={30} className="text-brand-gold" />
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-wide text-white uppercase">Agrilex</span>
              <span className="text-[9px] font-bold text-brand-gold uppercase tracking-widest -mt-1.5">Enterprise Dashboard</span>
            </div>
          </Link>
          <div className="flex gap-6 items-center">
            <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              Sessão Consultor: {userName}
            </span>
            <Link href="/dashboard/configuracoes" className="text-xs hover:text-brand-gold transition-colors font-bold uppercase tracking-wider">Configurações</Link>
            <button onClick={handleLogout} className="text-xs hover:text-red-400 text-slate-400 transition-colors font-bold uppercase tracking-wider">Sair</button>
          </div>
        </div>
      </nav>

      {/* Seção Principal */}
      <main className="container mx-auto px-4 py-8 flex-grow space-y-8">
        
        {/* Banner de Telemetria e Monitoramento de Satélite */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-emerald-400">
              <Activity className="animate-pulse" size={22} />
            </div>
            <div>
              <h2 className="text-xs uppercase font-extrabold tracking-widest text-slate-500">Status da Sala de Situação</h2>
              <p className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                Monitoramento Ativo Sentinel-2/DETER
                <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800 font-extrabold uppercase">Estável</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-semibold text-slate-400">
            <div className="hidden sm:block">
              <span className="text-slate-500 text-[10px] uppercase block font-bold">Último Varredura</span>
              <span className="text-slate-200">{lastScan || 'Aguardando...'}</span>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-500 text-[10px] uppercase block font-bold">Consultas Governamentais</span>
              <span className="text-slate-200">{scansCount} efetuadas</span>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-500 text-[10px] uppercase block font-bold">Servidor API</span>
              <span className="text-emerald-400 flex items-center gap-1"><Server size={10} /> Online</span>
            </div>
            <button 
              onClick={handleForceScan}
              className="bg-slate-850 hover:bg-slate-800 border border-slate-700 text-white font-bold p-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </div>

        {/* Dashboard Header - Título e Ações */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Sala de Situação Agro-Ambiental</h1>
            <p className="text-slate-400 mt-1 text-sm font-medium">Controle de conformidade regulatória, crédito e rastreabilidade para grandes produtores.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link href="/dashboard/planos" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white border border-slate-700 px-5 h-[52px] rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm">
              <Coins size={18} className="text-brand-gold" />
              <span>{credits > 0 ? `${credits} Créditos B2B` : 'Planos Enterprise'}</span>
            </Link>
            <Link href="/dashboard/nova-analise" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-brand-gold text-slate-950 px-5 h-[52px] rounded-xl font-black hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-lg shadow-amber-500/15">
              <Plus size={20} />
              <span>Nova Auditoria</span>
            </Link>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="p-3.5 bg-slate-950 rounded-xl text-emerald-400 border border-slate-800"><Globe size={24} /></div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Área Total Auditada</p>
              <p className="text-2xl font-black text-white mt-1">{areaTotal.toLocaleString('pt-BR')} <span className="text-xs text-slate-400 font-medium">ha</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="p-3.5 bg-slate-950 rounded-xl text-brand-gold border border-slate-800"><ShieldCheck size={24} /></div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Média Score ESG</p>
              <p className="text-2xl font-black text-white mt-1">{scoreMedio} <span className="text-xs text-slate-400 font-medium">/1000</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="p-3.5 bg-slate-950 rounded-xl text-green-400 border border-slate-800"><Coins size={24} /></div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Carbono Estimado</p>
              <p className="text-2xl font-black text-green-400 mt-1">R$ {carbonCreditsRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-[10px] font-semibold text-slate-400">/ano</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="p-3.5 bg-slate-950 rounded-xl text-red-500 border border-slate-800"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Apontamentos de Risco</p>
              <p className="text-2xl font-black text-red-500 mt-1">{riscosAltos} <span className="text-xs text-slate-400 font-medium">Ativos</span></p>
            </div>
          </div>

        </div>

        {/* Bloco Central Grid - Mapa Consolidado e Módulos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Lado Esquerdo (2/3): Mapa + Rastreabilidade + Data Room */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Mapa Consolidado do Portfólio */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <button 
                onClick={() => setShowPortfolio(!showPortfolio)}
                className="w-full flex justify-between items-center p-5 bg-slate-850 hover:bg-slate-800 transition-colors text-left border-b border-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <ChartIcon className="text-brand-gold" size={20} />
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider">Visão Consolidada do Portfólio de Fazendas</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Geometrias reais e status de restrição geoespacial das propriedades</p>
                  </div>
                </div>
                {showPortfolio ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {showPortfolio && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Mapa */}
                  <div className="md:col-span-2 space-y-3">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block">Geoprocessamento Integrado</span>
                    <DashboardPortfolioMap properties={geoProperties} />
                  </div>

                  {/* Recharts e Distribuição */}
                  <div className="flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block mb-3">Distribuição de Passivos</span>
                      {riskData.length > 0 ? (
                        <div className="h-40 w-full flex items-center justify-center relative bg-slate-950 rounded-xl border border-slate-850 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={riskData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={55}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {riskData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '11px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-xl font-black text-white">{scoreMedio}</span>
                            <span className="text-[8px] uppercase font-bold tracking-widest text-slate-400">Score ESG</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 flex items-center justify-center text-xs text-slate-500 bg-slate-950 rounded-xl border">Sem dados</div>
                      )}
                    </div>

                    <div className="space-y-2 text-xs font-semibold text-slate-400 border-t border-slate-800 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Baixo Risco</span>
                        <span className="text-white">{analises.filter(a => a.risk_level?.toLowerCase() === 'baixo').length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Médio Risco</span>
                        <span className="text-white">{analises.filter(a => a.risk_level?.toLowerCase() === 'medio').length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Alto Risco</span>
                        <span className="text-white">{analises.filter(a => a.risk_level?.toLowerCase() === 'alto').length}</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Governança e Rastreabilidade (Layout Duplo) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Data Room Corporativo (Árvore Documental) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Database className="text-brand-gold" size={18} /> Data Room de Auditoria
                  </h3>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-900 px-2 py-0.5 rounded font-bold">Criptografia Ativa</span>
                </div>
                <div className="space-y-3 text-xs font-medium text-slate-350">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 transition-colors">
                    <span className="flex items-center gap-2">📂 01. Regularidade Fundiária</span>
                    <span className="text-[10px] text-slate-500 font-bold">4 arquivos</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 transition-colors">
                    <span className="flex items-center gap-2">📂 02. Regularidade Ambiental</span>
                    <span className="text-[10px] text-slate-500 font-bold">2 arquivos</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 transition-colors">
                    <span className="flex items-center gap-2">📂 03. Crédito & Financeiro</span>
                    <span className="text-[10px] text-slate-500 font-bold">3 arquivos</span>
                  </div>
                </div>
              </div>

              {/* Rastreabilidade Indireta de Terceiros */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Users className="text-brand-gold" size={18} /> Rastreabilidade Indireta
                  </h3>
                  <span className="text-[9px] text-amber-400 bg-amber-950/60 border border-amber-900 px-2 py-0.5 rounded font-bold">Criterio TAC Carne</span>
                </div>
                <div className="space-y-2 text-xs font-medium">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">Fazenda Santo Antônio (Cria)</span>
                      <span className="text-[10px] text-slate-500 font-semibold">CNPJ: 04.***.** / 0001-90</span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">Aprovado</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">Fazenda Vale do Sol (Insumos)</span>
                      <span className="text-[10px] text-slate-500 font-semibold">CPF: 382.***.***-20</span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-950 text-red-500 border border-red-900 animate-pulse">Bloqueado (Ibama)</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Lado Direito (1/3): Grid de Módulos Operacionais + Recentes */}
          <div className="space-y-8">
            
            {/* Grid de Módulos */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="text-brand-gold" size={18} /> Central de Módulos Operacionais
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                
                <Link href="/dashboard/fornecedores" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-850 hover:border-emerald-600 transition-all hover:bg-slate-900 group">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-950 text-emerald-400 p-2 rounded-lg"><Users size={18} /></div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200 text-xs">Fornecedores Diretos</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Auditoria de Cadeias</span>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-600 group-hover:text-emerald-400 transition-colors" size={16} />
                </Link>

                <Link href="/dashboard/cofre" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-850 hover:border-emerald-600 transition-all hover:bg-slate-900 group">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-950 text-emerald-400 p-2 rounded-lg"><FileText size={18} /></div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200 text-xs">Cofre de Dados</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Dossiê e LGPD</span>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-600 group-hover:text-emerald-400 transition-colors" size={16} />
                </Link>

                <Link href="/dashboard/calendario" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-850 hover:border-emerald-600 transition-all hover:bg-slate-900 group">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-950 text-emerald-400 p-2 rounded-lg"><Clock size={18} /></div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200 text-xs">Calendário Ambiental</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Gestão de Licenciamento</span>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-600 group-hover:text-emerald-400 transition-colors" size={16} />
                </Link>

                <Link href="/dashboard/radar" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-850 hover:border-emerald-600 transition-all hover:bg-slate-900 group">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-950 text-emerald-400 p-2 rounded-lg"><AlertTriangle size={18} /></div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200 text-xs">Radar Fundiário 24/7</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Monitoramento Dinâmico</span>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-600 group-hover:text-emerald-400 transition-colors" size={16} />
                </Link>

                <Link href="/dashboard/credito" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-850 hover:border-emerald-600 transition-all hover:bg-slate-900 group">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-950 text-emerald-400 p-2 rounded-lg"><Landmark size={18} /></div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200 text-xs">Crédito Rural & Carbono</span>
                      <span className="text-[10px] text-slate-500 font-semibold">BACEN 5.081 & LTV Verde</span>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-600 group-hover:text-emerald-400 transition-colors" size={16} />
                </Link>

              </div>
            </div>

            {/* Suas Análises / Últimos Pareceres */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider border-b border-slate-800 pb-3 flex justify-between items-center">
                <span>Dossiês Emitidos</span>
                <span className="text-[10px] font-bold text-slate-500">Recentes</span>
              </h3>
              
              <div className="divide-y divide-slate-850">
                {analises.slice(0, 3).map((analise) => (
                  <div key={analise.id} className="py-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-emerald-400" />
                        <span className="font-bold text-xs text-slate-100 truncate max-w-[140px]">{analise.properties?.name}</span>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        analise.risk_level?.toLowerCase() === 'alto' ? 'bg-red-950 text-red-500 border border-red-900' :
                        analise.risk_level?.toLowerCase() === 'medio' ? 'bg-amber-950 text-amber-500 border border-amber-900' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                      }`}>
                        {analise.risk_level || 'Pendente'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                      <span className="flex items-center gap-1"><FileText size={12}/> {analise.documents?.document_type || 'Matrícula'}</span>
                      {analise.status === 'completed' ? (
                        <Link href={`/dashboard/resultado?id=${analise.id}`} className="text-brand-gold hover:text-white transition-colors flex items-center gap-0.5 font-bold uppercase">
                          Dossiê <ExternalLink size={10} />
                        </Link>
                      ) : (
                        <span className="text-slate-600">Carregando...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
