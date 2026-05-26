"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Plus, FileText, MapPin, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("Produtor");
  const [analises, setAnalises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
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
          properties (id, name, city, state, risk_score),
          documents (document_type)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      const mockAnalises = [
        {
          id: 'mock-1',
          status: 'completed',
          risk_level: 'medio',
          properties: { name: 'Fazenda Boa Esperança (Amostra)', city: 'Rio Verde', state: 'GO' },
          documents: { document_type: 'Matrícula' }
        },
        {
          id: 'mock-2',
          status: 'processing',
          risk_level: null,
          properties: { name: 'Sítio Alvorada (Amostra)', city: 'Sorriso', state: 'MT' },
          documents: { document_type: 'Título INCRA' }
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

  const analisesConcluidas = analises.filter(a => a.status === 'completed').length;
  const analisesEmAndamento = analises.filter(a => a.status === 'processing' || a.status === 'pending').length;
  const riscosAltos = analises.filter(a => a.risk_level?.toLowerCase() === 'alto').length;

  const estatisticas = [
    { label: 'Análises Concluídas', valor: analisesConcluidas, icone: <CheckCircle className="text-green-500" /> },
    { label: 'Score Médio Portfólio', valor: '920/1000', icone: <ShieldCheck className="text-brand-gold" /> },
    { label: 'Riscos Altos Detectados', valor: riscosAltos, icone: <AlertTriangle className="text-red-500" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-brand-gold">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">Agrilex</span>
          </Link>
          <div className="flex gap-4 items-center">
            <span className="text-sm font-medium">Olá, {userName}</span>
            <Link href="/dashboard/configuracoes" className="text-sm hover:text-brand-gold transition-colors font-medium">Configurações</Link>
            <button onClick={handleLogout} className="text-sm hover:text-brand-gold transition-colors font-medium">Sair</button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Seu Painel</h1>
            <p className="text-gray-600 mt-1">Acompanhe a segurança jurídica das suas propriedades.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/planos" className="flex items-center justify-center gap-2 bg-white text-brand-dark border-2 border-brand-gold px-5 h-[52px] rounded-lg font-bold hover:bg-amber-50 transition-all shadow-sm">
              <Plus size={20} className="text-brand-gold" />
              <span>{credits > 0 ? `${credits} Crédito(s) B2B` : 'Planos B2B'}</span>
            </Link>
            <Link href="/dashboard/nova-analise" className="flex items-center justify-center gap-2 bg-brand-gold text-brand-green px-5 h-[52px] rounded-lg font-bold hover:brightness-110 transition-all shadow-lg hover:-translate-y-1">
              <Plus size={20} />
              <span>Nova Análise</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {estatisticas.map((est, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="p-4 bg-gray-50 rounded-full">{est.icone}</div>
              <div>
                <p className="text-gray-500 text-sm font-medium">{est.label}</p>
                <p className="text-3xl font-bold text-gray-800">{est.valor}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Módulos Enterprise</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10" translate="no">
          <Link href="/dashboard/fornecedores" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-full"><Clock size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center"><span>Fornecedores</span></h3>
            <span className="text-xs text-gray-500 text-center">Análise de Cadeia</span>
          </Link>
          <Link href="/dashboard/cofre" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-purple-50 text-purple-600 p-3 rounded-full"><FileText size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center"><span>Cofre de Dados</span></h3>
            <span className="text-xs text-gray-500 text-center">Ambiente Criptografado</span>
          </Link>
          <Link href="/dashboard/calendario" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-orange-50 text-orange-600 p-3 rounded-full"><MapPin size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center"><span>Calendário</span></h3>
            <span className="text-xs text-gray-500 text-center">Condicionantes</span>
          </Link>
          <Link href="/dashboard/radar" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-red-50 text-red-600 p-3 rounded-full"><AlertTriangle size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center"><span>Radar Fundiário</span></h3>
            <span className="text-xs text-gray-500 text-center">Monitoramento 24/7</span>
          </Link>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Suas Análises</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {loading ? (
             <div className="p-10 text-center text-gray-500">Carregando seus dados...</div>
          ) : analises.length === 0 ? (
             <div className="p-10 text-center text-gray-500">Nenhum documento enviado ainda. Clique em "Nova Análise" para começar!</div>
          ) : (
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Propriedade</th>
                  <th className="px-6 py-4 font-semibold">Documento</th>
                  <th className="px-6 py-4 font-semibold">Status da IA</th>
                  <th className="px-6 py-4 font-semibold">Risco</th>
                  <th className="px-6 py-4 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analises.map((analise) => (
                  <tr key={analise.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-brand-green" />
                        <span className="font-semibold text-gray-800">{analise.properties?.name}</span>
                      </div>
                      <span className="text-sm text-gray-500 ml-6">{analise.properties?.city}, {analise.properties?.state}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 flex items-center gap-2 mt-2">
                      <FileText size={18} className="text-brand-gold" /> {analise.documents?.document_type}
                    </td>
                    <td className="px-6 py-4">
                      {analise.status === 'processing' || analise.status === 'pending' ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">Analisando</span>
                      ) : (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider">Concluído</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {analise.risk_level ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          analise.risk_level.toLowerCase() === 'alto' ? 'bg-red-100 text-red-800' :
                          analise.risk_level.toLowerCase() === 'medio' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {analise.risk_level}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm font-medium">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {analise.status === 'completed' ? (
                        <div className="flex items-center gap-3">
                          <Link href={`/dashboard/resultado?id=${analise.id}`} className="text-brand-green font-bold hover:text-brand-gold transition-colors text-sm">
                            Ver Parecer
                          </Link>
                          <Link href={`/dashboard/radar?property_id=${analise.properties?.id}`} className="bg-gray-900 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-800 transition-colors">
                            Ativar Radar
                          </Link>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm font-medium cursor-not-allowed">Aguarde...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
