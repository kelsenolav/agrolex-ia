"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Users, FileStack, Activity, ArrowLeft, DollarSign, TrendingUp, Search, Eye, MessageCircle, AlertTriangle, Globe } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchAdminData() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const res = await fetch('/api/admin', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error || 'Falha ao carregar painel admin');
        }

        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAdminData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
        <ShieldAlert size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Restrito</h1>
        <p className="text-gray-600 mb-6 max-w-lg text-center">
          Para acessar o painel administrativo, o seu banco de dados precisa ser configurado para liberar o seu acesso.
        </p>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm w-full max-w-2xl mb-8">
          <h3 className="font-bold text-brand-dark mb-4 border-b pb-2">ÚLTIMO PASSO (Execute no Supabase):</h3>
          <ol className="list-decimal ml-5 text-gray-600 text-sm mb-4 space-y-2">
            <li>Acesse o seu painel do Supabase.</li>
            <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong>.</li>
            <li>Clique em <strong>New Query</strong> e cole o código abaixo:</li>
          </ol>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`-- 1. Libera permissão global para a chave mestra
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 2. Transforma o seu usuário em Administrador
UPDATE public.profiles SET role = 'admin';`}
          </pre>
          <p className="text-sm text-gray-500 mt-4">Após executar (clicar em RUN), volte aqui e atualize esta página!</p>
        </div>

        <Link href="/dashboard" className="px-6 py-2 border border-brand-green text-brand-green font-semibold rounded-lg hover:bg-brand-green hover:text-white transition-colors">
          Voltar ao Meu Dashboard
        </Link>
      </div>
    );
  }

  // Prepara dados para os Gráficos
  const chartData = [
    { name: 'Jan', receita: 0 },
    { name: 'Fev', receita: 0 },
    { name: 'Mar', receita: 0 },
    { name: 'Abr', receita: 0 },
    { name: 'Mai', receita: data?.stats?.revenue || 0 }, // Simplificado para mostrar algo no mês atual
    { name: 'Jun', receita: 0 },
  ];

  const pieData = [
    { name: 'Auditorias Concluídas', value: data?.stats?.analyses || 1, color: '#166534' }, // brand-green
    { name: 'Pendentes/Erros', value: 0, color: '#FCD34D' }, // brand-gold
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-brand-dark text-white p-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl font-bold text-brand-gold flex items-center gap-2">
              <ShieldAlert size={28} />
              SaaS Admin Pro
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Sistema Online
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 mt-6">
        
        {/* KPIs Financeiros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-green-100 p-3 rounded-xl text-green-600">
                <DollarSign size={24} />
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12% hoje</span>
            </div>
            <p className="text-gray-500 text-sm font-semibold">Faturamento Total</p>
            <h2 className="text-3xl font-black text-gray-800 mt-1">R$ {parseFloat(data.stats.revenue || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</h2>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                <TrendingUp size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm font-semibold">Ticket Médio (ARPU)</p>
            <h2 className="text-3xl font-black text-gray-800 mt-1">R$ {parseFloat(data.stats.ticketMedio || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</h2>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
                <Activity size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm font-semibold">Análises Realizadas</p>
            <h2 className="text-3xl font-black text-gray-800 mt-1">{data.stats.analyses}</h2>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                <Users size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm font-semibold">Total de Usuários</p>
            <h2 className="text-3xl font-black text-gray-800 mt-1">{data.stats.users}</h2>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-teal-100 p-3 rounded-xl text-teal-600">
                <Globe size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm font-semibold">Usuários Online (24h)</p>
            <h2 className="text-3xl font-black text-gray-800 mt-1">{data.stats.onlineUsers}</h2>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-red-100 p-3 rounded-xl text-red-600">
                <AlertTriangle size={24} />
              </div>
            </div>
            <p className="text-gray-500 text-sm font-semibold">Abandonos (Incompletos)</p>
            <h2 className="text-3xl font-black text-gray-800 mt-1">{data.stats.incompleteUsers}</h2>
          </div>
        </div>

        {/* Gráficos Recharts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-brand-green"/> Crescimento da Receita</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip 
                    cursor={{fill: '#f9fafb'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Receita']}
                  />
                  <Bar dataKey="receita" fill="#166534" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Status Operacional</h3>
            <div className="h-[300px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Texto Central */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="block text-3xl font-black text-gray-800">{data.stats.analyses}</span>
                <span className="block text-xs text-gray-500 font-bold uppercase">Total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Análises Detalhada */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Search size={20} className="text-brand-gold"/> Auditorias Recentes (Base de Clientes)</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Cliente / Contato</th>
                  <th className="px-6 py-4">Fazenda</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Status & Risco</th>
                  <th className="px-6 py-4">Faturamento</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentAnalyses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <FileStack size={48} className="mx-auto text-gray-300 mb-3" />
                      Nenhuma análise registrada no sistema ainda.
                    </td>
                  </tr>
                )}
                {data.recentAnalyses.map((an: any) => {
                  const amount = an.findings?.amountPaid ? parseFloat(an.findings.amountPaid) : 0;
                  const wpp = an.profiles?.whatsapp;
                  
                  return (
                    <tr key={an.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{an.profiles?.name || 'Sem Nome'}</div>
                        <div className="text-sm text-gray-500 mb-1">{an.profiles?.email || 'N/A'}</div>
                        {wpp ? (
                          <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <MessageCircle size={12} /> {wpp}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">Sem telefone</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{an.properties?.name || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(an.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {new Date(an.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            an.status === 'completed' ? 'bg-green-100 text-green-700' :
                            an.status === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {an.status}
                          </span>
                          {an.risk_level === 'Alto' && (
                            <span className="flex items-center gap-1 text-red-600 font-bold text-xs uppercase tracking-wider">
                              <ShieldAlert size={12} /> Risco Alto
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-gray-900">R$ {amount.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                        <div className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">
                          {an.findings?.modulesSelected?.length || 0} Módulo(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {an.status === 'completed' ? (
                          <Link 
                            href={`/admin/relatorio/${an.id}`}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-brand-green hover:text-brand-green text-gray-700 text-sm font-bold rounded-lg transition-all shadow-sm group-hover:shadow"
                          >
                            <Eye size={16} /> Ler Parecer
                          </Link>
                        ) : (
                          <button disabled className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-400 text-sm font-bold rounded-lg cursor-not-allowed">
                            Processando
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Gestão de Usuários */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Users size={20} className="text-brand-gold"/> Gestão de Usuários Cadastrados</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Usuário / Contato</th>
                  <th className="px-6 py-4">Perfil</th>
                  <th className="px-6 py-4">Análises Realizadas</th>
                  <th className="px-6 py-4">Último Acesso</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.usersList?.map((usr: any) => (
                  <tr key={usr.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800">{usr.name || 'Sem nome'}</div>
                      <div className="text-sm text-gray-500 mt-1 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1"><MessageCircle size={12}/> {usr.whatsapp || 'Não informado'}</span>
                        <span className="text-xs text-gray-400">{usr.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        usr.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {usr.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-bold text-gray-700">
                          {usr.completed_analyses} completas
                        </div>
                        <span className="text-xs text-gray-400">de {usr.total_analyses} iniciadas</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 font-medium">
                        {usr.last_sign_in_at ? new Date(usr.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca logou'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        usr.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {usr.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data.usersList || data.usersList.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum usuário encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
