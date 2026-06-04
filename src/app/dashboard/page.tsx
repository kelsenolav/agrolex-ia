"use client";
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Plus, FileText, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Analysis, AnalysisFindings } from '@/types/analise';
import { normalizeStatus } from '@/types/analise';

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("Produtor");
  const [analises, setAnalises] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [loadingAnalysisId, setLoadingAnalysisId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  const refreshAnalises = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
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
        setAnalises(data as unknown as Analysis[]);
      }
    } catch (err) {
      console.error('Erro ao atualizar análises:', err);
      showToast('Erro ao atualizar lista de análises.', 'error');
    }
  };

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
      const { data } = await supabase
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
        setAnalises(data as unknown as Analysis[]);
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
        showToast("Sua sessão expirou, faça login novamente.", 'error');
        setTimeout(() => router.push('/login'), 2000);
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

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao liberar análise');
      }

      showToast("Análise liberada com sucesso para processamento!", 'success');
      await refreshAnalises();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao liberar:', err);
      showToast("Erro ao liberar processamento: " + message, 'error');
    }
  };

  const isRecoverableAnalysisError = (analysis: Analysis): boolean => {
    if (analysis.findings?.retry_exhausted === true) {
      return false;
    }
    const technicalErrorType = analysis.findings?.technical_error_type;
    return analysis.findings?.retry_available === true ||
      technicalErrorType === 'ai_timeout' ||
      technicalErrorType === 'ai_unavailable' ||
      technicalErrorType === 'ai_incomplete_response';
  };

  const getRetryMessage = (analysis: Analysis): string => {
    const technicalErrorType = analysis.findings?.technical_error_type;
    if (technicalErrorType === 'ai_timeout') {
      return 'A IA demorou demais na tentativa anterior. Vamos tentar novamente sem reenviar os documentos.';
    }
    if (technicalErrorType === 'ai_unavailable') {
      return 'A IA estava temporariamente indisponível. Vamos tentar novamente.';
    }
    if (technicalErrorType === 'ai_incomplete_response') {
      return 'A IA retornou um parecer incompleto. Vamos reprocessar esta análise.';
    }
    return 'Vamos reprocessar esta análise sem reenviar os documentos.';
  };

  const handleStartAnalysis = async (analysisId: string, propertyId: string, retryOptions?: { retryMessage?: string; forceRetry?: boolean }) => {
    if (loadingAnalysisId) return;
    setLoadingAnalysisId(analysisId);
    try {
      if (retryOptions?.retryMessage) {
        showToast(retryOptions.retryMessage, 'success');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Sua sessão expirou, faça login novamente.", 'error');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ analysisId, propertyId, forceRetry: retryOptions?.forceRetry === true })
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao processar análise com IA');
      }

      showToast("Auditoria finalizada com sucesso!", 'success');
      router.push(`/dashboard/resultado?id=${analysisId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível concluir agora. A análise pode ser reprocessada.";
      console.error('Erro ao processar:', err);
      showToast("Falha ao processar parecer com IA: " + message, 'error');
      await refreshAnalises();
    } finally {
      setLoadingAnalysisId(null);
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
            <span className="text-xl font-bold text-white">AgroLex</span>
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
              {credits > 0 ? `${credits} Crédito(s)` : 'Planos'}
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
                  // Usar função centralizada de normalização de status
                  const { text: statusText, colorClass: statusColorClass, type: statusType } = normalizeStatus(analise.status || '');

                  // Verificar se tem parecer (findings.resumo)
                  const hasParecer = analise.findings && analise.findings.resumo && String(analise.findings.resumo).trim().length > 0;
                  const canRetryAnalysis = statusType === 'error' && isRecoverableAnalysisError(analise);

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
                        <FileText size={18} className="text-brand-gold" /> {analise.documents?.[0]?.document_type}
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
                            <Link href={`/dashboard/resultado?id=${analise.id}`} className="text-brand-green font-bold hover:text-brand-gold transition-colors text-sm">
                              Ver Parecer
                            </Link>
                          ) : (
                            <span className="text-red-500 text-xs font-semibold">Anomalia: parecer não localizado</span>
                          )
                        ) : statusType === 'processing' ? (
                          <span className="text-gray-400 text-sm font-medium">Aguarde...</span>
                        ) : statusType === 'ready_for_processing' ? (
                          <button
                            disabled={loadingAnalysisId !== null}
                            onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '')}
                            className="bg-brand-green text-white px-3 py-1 rounded text-xs font-bold hover:brightness-110 transition-all shadow disabled:opacity-50"
                          >
                            {loadingAnalysisId === analise.id ? 'Auditando...' : 'Iniciar parecer'}
                          </button>
                        ) : statusType === 'error' ? (
                        analise.findings?.retry_exhausted === true ? (
                            <div className="flex flex-col gap-1.5 max-w-[280px]">
                              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide w-fit">
                                Exige processamento em etapas
                              </span>
                              <span className="text-gray-500 text-[10px] leading-tight">
                                Esta matrícula possui volume ou complexidade acima do limite de processamento único. Você pode tentar reprocessar ou dividir a auditoria em etapas:
                              </span>
                              <ol className="list-decimal pl-4 space-y-0.5">
                                <li className="text-gray-500 text-[10px] leading-tight"><strong className="text-gray-700">Análise de Matrícula Individual</strong> — revisar atos, averbações, ônus, inconsistências internas e riscos diretos do registro.</li>
                                <li className="text-gray-500 text-[10px] leading-tight"><strong className="text-gray-700">Cadeia Dominial Registral</strong> — reconstruir a origem e a sequência de transmissões do imóvel.</li>
                                <li className="text-gray-500 text-[10px] leading-tight"><strong className="text-gray-700">Auditoria de Origem Pública / Título Fundiário</strong> — verificar título originário, cláusulas resolutivas, INCRA/ITERINS/Estado e possível vício de origem.</li>
                                <li className="text-gray-500 text-[10px] leading-tight"><strong className="text-gray-700">Mapeamento de Nulidades e Indícios de Fraude</strong> — aprofundar inconsistências, simulação, sobreposição documental, fraude documental e pontos de impugnação.</li>
                              </ol>
                              <button
                                disabled={loadingAnalysisId !== null}
                                onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '', { retryMessage: 'Tentando reprocessar com tempo estendido...', forceRetry: true })}
                                className="bg-amber-600 text-white px-3 py-1.5 rounded text-[11px] font-bold hover:brightness-110 transition-all shadow disabled:opacity-50 mt-1 w-fit"
                              >
                                {loadingAnalysisId === analise.id ? 'Reprocessando...' : 'Tentar novamente'}
                              </button>
                            </div>
                          ) : canRetryAnalysis ? (
                            <button
                              disabled={loadingAnalysisId !== null}
                              onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '', { retryMessage: getRetryMessage(analise) })}
                              className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:brightness-110 transition-all shadow disabled:opacity-50"
                            >
                              {loadingAnalysisId === analise.id ? 'Reprocessando...' : 'Tentar novamente'}
                            </button>
                          ) : (
                            <span className="text-red-600 text-xs font-semibold">Falha / Reprocessamento necessário</span>
                          )
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

      {/* Toast de notificação */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl text-white font-medium transition-all duration-300 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckCircle size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white/80 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}