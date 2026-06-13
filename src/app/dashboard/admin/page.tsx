"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Search, Filter, Download, RefreshCw, Layers } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import MetricsGrid from '@/components/admin/MetricsGrid';

interface LeadAdmin {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  state: string;
  plan: 'trial' | 'starter' | 'pro' | 'premium' | 'enterprise';
  status: 'lead' | 'trial_active' | 'trial_expired' | 'converted';
  createdAt: string;
  pagesProcessed: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Admin");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Mock de Leads de Alto Nível
  const [leads, setLeads] = useState<LeadAdmin[]>([
    {
      id: 'lead-1',
      name: 'Oliveira & Associados Advocacia',
      email: 'contato@oliveiraadvocacia.com.br',
      whatsapp: '(45) 99887-1122',
      state: 'PR',
      plan: 'pro',
      status: 'converted',
      createdAt: '08/06/2026 10:30',
      pagesProcessed: 120
    },
    {
      id: 'lead-2',
      name: 'Fazenda Rio Verde (Dr. Marcos)',
      email: 'marcos@rioverde.agr.br',
      whatsapp: '(66) 99654-3210',
      state: 'MT',
      plan: 'trial',
      status: 'trial_active',
      createdAt: '08/06/2026 09:15',
      pagesProcessed: 8
    },
    {
      id: 'lead-3',
      name: 'Dra. Sandra Agronegócios',
      email: 'sandra@sandra.adv.br',
      whatsapp: '(34) 99122-3344',
      state: 'MG',
      plan: 'starter',
      status: 'converted',
      createdAt: '07/06/2026 16:40',
      pagesProcessed: 45
    },
    {
      id: 'lead-4',
      name: 'Produtor Valdir Silva',
      email: 'valdir@silva.com.br',
      whatsapp: '(94) 98111-2222',
      state: 'PA',
      plan: 'trial',
      status: 'trial_expired',
      createdAt: '05/06/2026 14:00',
      pagesProcessed: 10
    },
    {
      id: 'lead-5',
      name: 'Grupo Bom Jesus Participações',
      email: 'diretoria@bomjesus.com.br',
      whatsapp: '(11) 98888-7777',
      state: 'SP',
      plan: 'enterprise',
      status: 'trial_active',
      createdAt: '08/06/2026 15:20',
      pagesProcessed: 5
    }
  ]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const checkAdminSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const name = session.user.user_metadata?.full_name;
      if (name) setUserName(name.split(' ')[0]);
      setLoading(false);
    };
    checkAdminSession();
  }, [router]);

  const handleExportCSV = () => {
    showToast("Dados de exportação comerciais estruturados!", "success");
    console.log("CSV Exported: Leads list");
  };

  const handleRefresh = () => {
    showToast("Atualizando dados da Torre de Controle...", "info");
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.state.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = planFilter ? lead.plan === planFilter : true;
    const matchesStatus = statusFilter ? lead.status === statusFilter : true;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  const getPlanLabel = (plan: LeadAdmin['plan']) => {
    const labels: Record<string, string> = {
      trial: 'Trial (10p)',
      starter: 'Starter',
      pro: 'Profissional',
      premium: 'Premium',
      enterprise: 'Empresarial'
    };
    return labels[plan] || plan;
  };

  const getStatusBadge = (status: LeadAdmin['status']) => {
    switch (status) {
      case 'converted':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            Convertido
          </span>
        );
      case 'trial_active':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-blue-100 text-blue-850 border border-blue-200">
            Trial Ativo
          </span>
        );
      case 'trial_expired':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-red-100 text-red-800 border border-red-200">
            Trial Esgotado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-gray-100 text-gray-700 border border-gray-250">
            Lead Frio
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-bold">Autenticando credenciais administrativas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold transition-all text-white ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-blue-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Admin Safety Notice */}
      <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-xs font-black tracking-wider flex items-center justify-center gap-2 border-b border-amber-600 shadow-sm">
        <ShieldAlert size={14} className="animate-pulse" />
        <span>AMBIENTE RESTRITO. ACESSO CONCEDIDO EXCLUSIVAMENTE PARA ADMINISTRADORES CADASTRADOS (ROLE: &apos;ADMIN&apos;)</span>
      </div>

      {/* Navbar */}
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold hover:scale-105 transition-transform">
            <Logo size="sm" className="text-white" />
            <span className="text-xl font-bold text-white ml-1">Admin</span>
          </Link>
          <div className="flex gap-4 items-center">
            <span className="text-sm font-medium">Olá, {userName}</span>
            <Link href="/dashboard" className="text-sm text-brand-gold hover:underline font-bold">Voltar ao Painel</Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Link */}
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-bold">
          <ArrowLeft size={20} /> Retornar ao Dashboard
        </Link>

        {/* Dashboard Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers size={18} className="text-brand-gold" />
              <span className="text-brand-green font-bold text-xs uppercase tracking-wider">Métricas Comerciais & Conversão</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800">
              Torre de Controle Comercial
            </h1>
            <p className="text-gray-600 mt-1">Visão analítica de leads do trial de páginas e taxas de vendas do ecossistema.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
              <RefreshCw size={16} />
              Sincronizar
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-brand-green text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-sm"
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="mb-10">
          <MetricsGrid />
        </div>

        {/* Table Filter Actions */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-extrabold text-gray-800">Monitoramento Geral de Leads</h2>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar lead, e-mail ou UF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-gray-250 rounded-lg focus:outline-none focus:border-brand-green w-full sm:w-64"
                />
              </div>

              {/* Plan Filter */}
              <div className="relative">
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm border border-gray-250 rounded-lg focus:outline-none focus:border-brand-green appearance-none w-full bg-white font-medium text-gray-700"
                >
                  <option value="">Todos os Planos</option>
                  <option value="trial">Trial (10p)</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Profissional</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Empresarial</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm border border-gray-250 rounded-lg focus:outline-none focus:border-brand-green appearance-none w-full bg-white font-medium text-gray-700"
                >
                  <option value="">Todos os Status</option>
                  <option value="converted">Convertido</option>
                  <option value="trial_active">Trial Ativo</option>
                  <option value="trial_expired">Trial Esgotado</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              </div>
            </div>
          </div>

          {/* Leads Table */}
          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="text-gray-300 mx-auto mb-2" size={40} />
              <p className="text-gray-500 font-bold">Nenhum lead encontrado com os filtros selecionados.</p>
              <p className="text-gray-400 text-xs mt-1">Tente remover os filtros ou buscar por outro termo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs font-black uppercase text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-4">Nome / Empresa</th>
                    <th className="px-6 py-4">E-mail</th>
                    <th className="px-6 py-4">WhatsApp</th>
                    <th className="px-6 py-2 text-center">UF</th>
                    <th className="px-6 py-4">Plano</th>
                    <th className="px-6 py-4">Páginas Processadas</th>
                    <th className="px-6 py-4">Status de Vendas</th>
                    <th className="px-6 py-4">Data do Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-extrabold text-gray-800">
                        {lead.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {lead.email}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono">
                        {lead.whatsapp}
                      </td>
                      <td className="px-6 py-2 text-center font-bold text-gray-700">
                        {lead.state}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-gray-800 text-xs bg-gray-100 px-2.5 py-1 rounded border border-gray-200">
                          {getPlanLabel(lead.plan)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-gray-800">
                        {lead.pagesProcessed}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs font-mono">
                        {lead.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
