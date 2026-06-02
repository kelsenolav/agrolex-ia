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
          findings,
          properties (id, name, city, state, risk_score),
          documents (document_type)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setAnalises(data);
      } else {
        setAnalises([]);
      }
      setLoading(false);
    };
    
    checkUserAndFetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  const handleReleaseProcessing = async (analysisId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Sua sessão expirou, faça login novamente.");
        router.push('/login');
        return;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ analysisId })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Erro ao liberar análise');
      }

      alert("Análise liberada com sucesso para processamento!");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao liberar processamento: " + err.message);
    }
  };

  const analisesConcluidas = analises.filter(a => a.status === 'completed').length;
  const analisesEmAndamento = analises.filter(a => a.status === 'processing' || a.status === 'pending' || a.status === 'payment_pending' || a.status === 'ready_for_processing').length;
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
            <Link href="/dashboard/planos" className="flex items-center gap-2 bg-white text-brand-dark border-2 border-brand-gold px-5 py-3 rounded-lg font-bold hover:bg-amber-50 transition-all shadow-sm">
              <Plus size={20} className="text-brand-gold" />
              {credits > 0 ? `${credits} Crédito(s) B2B` : 'Planos B2B'}
            </Link>
            <Link href="/dashboard/nova-analise" className="flex items-center gap-2 bg-brand-gold text-brand-green px-5 py-3 rounded-lg font-bold hover:brightness-110 transition-all shadow-lg hover:-translate-y-1">
              <Plus size={20} />
              Nova Análise
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Link href="/dashboard/fornecedores" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-full"><Clock size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center">Fornecedores</h3>
            <span className="text-xs text-gray-500 text-center">Análise de Cadeia</span>
          </Link>
          <Link href="/dashboard/cofre" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-purple-50 text-purple-600 p-3 rounded-full"><FileText size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center">Data Room</h3>
            <span className="text-xs text-gray-500 text-center">Cofre Criptografado</span>
          </Link>
          <Link href="/dashboard/calendario" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-orange-50 text-orange-600 p-3 rounded-full"><MapPin size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center">Calendário</h3>
            <span className="text-xs text-gray-500 text-center">Condicionantes</span>
          </Link>
          <Link href="/dashboard/radar" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 transition-transform hover:shadow-md cursor-pointer">
            <div className="bg-red-50 text-red-600 p-3 rounded-full"><AlertTriangle size={24} /></div>
            <h3 className="font-bold text-gray-800 text-center">Radar Fundiário</h3>
            <span className="text-xs text-gray-500 text-center">Monitoramento</span>
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
                {analises.map((analise) => {
                  const rawStatus = (analise.status || '').toLowerCase().trim();
                  
                  // Normalizar status
                  let statusText = 'Pendente';
                  let statusColorClass = 'bg-gray-100 text-gray-700';
                  let statusType = 'pending'; // pending, processing, completed, error
                  
                  if (rawStatus === 'pending' || rawStatus === 'payment_pending') {
                    statusText = 'Pendente';
                    statusColorClass = 'bg-amber-100 text-amber-700';
                    statusType = 'pending';
                  } else if (rawStatus === 'ready_for_processing') {
                    statusText = 'Liberada';
                    statusColorClass = 'bg-purple-100 text-purple-700';
                    statusType = 'ready_for_processing';
                  } else if (rawStatus === 'processing' || rawStatus === 'analisando') {
                    statusText = 'Analisando';
                    statusColorClass = 'bg-blue-100 text-blue-700 animate-pulse';
                    statusType = 'processing';
                  } else if (rawStatus === 'completed' || rawStatus === 'done' || rawStatus === 'concluido') {
                    statusText = 'Concluído';
                    statusColorClass = 'bg-green-100 text-green-700';
                    statusType = 'completed';
                  } else if (rawStatus === 'error' || rawStatus === 'failed') {
                    statusText = 'Falha';
                    statusColorClass = 'bg-red-100 text-red-700';
                    statusType = 'error';
                  }

                  // Verificar se tem parecer (findings.resumo)
                  const hasParecer = analise.findings && analise.findings.resumo && String(analise.findings.resumo).trim().length > 0;

                  return (
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
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColorClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {statusType === 'completed' && analise.risk_level ? (
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
                        {statusType === 'completed' ? (
                          hasParecer ? (
                            <div className="flex items-center gap-3">
                              <Link href={`/dashboard/resultado?id=${analise.id}`} className="text-brand-green font-bold hover:text-brand-gold transition-colors text-sm">
                                Ver Parecer
                              </Link>
                              <Link href={`/dashboard/radar?property_id=${analise.properties?.id}`} className="bg-gray-900 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-800 transition-colors">
                                Ativar Radar
                              </Link>
                            </div>
                          ) : (
                            <span className="text-red-500 text-xs font-semibold">Anomalia: parecer não localizado</span>
                          )
                        ) : statusType === 'processing' ? (
                          <span className="text-gray-400 text-sm font-medium">Aguarde...</span>
                        ) : statusType === 'ready_for_processing' ? (
                          <span className="text-purple-600 text-xs font-semibold">Aguardando início da IA</span>
                        ) : statusType === 'error' ? (
                          <span className="text-red-600 text-xs font-semibold">Falha / Reprocessamento necessário</span>
                        ) : statusType === 'pending' ? (
                          <button
                            onClick={() => handleReleaseProcessing(analise.id)}
                            className="bg-brand-gold text-brand-green px-3 py-1 rounded text-xs font-bold hover:brightness-110 transition-all shadow"
                          >
                            Liberar processamento
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm font-medium">-</span>
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
