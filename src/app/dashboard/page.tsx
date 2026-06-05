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

  // FASE 5 — Proteção contra loop infinito no encadeamento automático
  const chainCountRef = useRef<Record<string, number>>({});
  const MAX_AUTO_CHAIN = 8;

  // FASE 2.0.2 — Modal de recomendação
  const [recommendModal, setRecommendModal] = useState<{
    analysisId: string;
    propertyName: string;
    modules: Array<{ module_id: string; title: string; priority?: string; price?: number | null }>;
  } | null>(null);
  const [acceptingModules, setAcceptingModules] = useState(false);

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

  // FASE 4 — Pagamento via Mercado Pago (sandbox) com fallback dev
  const handlePayNow = async (analysisId: string) => {
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
        throw new Error(result.error || 'Erro ao iniciar pagamento');
      }

      const data = await res.json();

      // Se o checkout retornou URL do Mercado Pago, redirecionar
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        // Fallback dev: MP não configurado, pagamento simulado
        showToast('Pagamento aprovado! Análise liberada para processamento.', 'success');
        await refreshAnalises();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao iniciar pagamento:', err);
      showToast("Erro ao processar pagamento: " + message, 'error');
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

  // FASE 2 — Recommended Modules: extrai lista de módulos sugeridos do case_file
  // (somente leitura no dashboard; sem CTA até Fase 2.0.2 com migration parent_analysis_id)
  const getRecommendedModules = (analysis: Analysis): Array<{ module_id: string; title: string; priority?: string; price?: number | null }> => {
    const recs = (analysis.findings as any)?.case_file?.recommended_modules;
    if (!Array.isArray(recs) || recs.length === 0) return [];
    return recs.map((r: any) => ({
      module_id: String(r.module_id || ''),
      title: String(r.title || r.module_id || ''),
      priority: typeof r.priority === 'string' ? r.priority : undefined,
      price: typeof r.price === 'number' ? r.price : null
    }));
  };

  const priorityStyles: Record<string, string> = {
    critica: 'bg-red-100 text-red-800 border-red-200',
    alta: 'bg-amber-100 text-amber-800 border-amber-200',
    media: 'bg-blue-100 text-blue-800 border-blue-200',
    baixa: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const handleStartAnalysis = async (analysisId: string, propertyId: string, retryOptions?: { retryMessage?: string; forceRetry?: boolean; isAutoChain?: boolean }) => {
    if (loadingAnalysisId) return;

    const isAutoChain = retryOptions?.isAutoChain === true;
    const currentChainCount = chainCountRef.current[analysisId] || 0;

    // FASE 5 — Proteção contra loop infinito
    if (isAutoChain && currentChainCount >= MAX_AUTO_CHAIN) {
      showToast("Processamento pausado por segurança. Clique em iniciar novamente.", 'error');
      delete chainCountRef.current[analysisId];
      await refreshAnalises();
      return;
    }

    setLoadingAnalysisId(analysisId);

    // FASE 5 — Incrementar contador de encadeamento
    if (isAutoChain) {
      chainCountRef.current[analysisId] = currentChainCount + 1;
    }

    try {
      if (retryOptions?.retryMessage) {
        showToast(retryOptions.retryMessage, 'success');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Sua sessão expirou, faça login novamente.", 'error');
        setTimeout(() => router.push('/login'), 2000);
        delete chainCountRef.current[analysisId];
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

      const data = await res.json();

      // FASE 5 — Encadeamento automático: etapa concluída, há mais pendentes
      if (data.status === 'processing_stage_completed') {
        showToast("Etapa concluída. Continuando próxima etapa...", 'success');
        await refreshAnalises();
        // Diferir para o próximo tick para evitar que o finally limpe o loading da recursão
        setTimeout(() => handleStartAnalysis(analysisId, propertyId, { isAutoChain: true }), 0);
        return;
      }

      // FASE 5 — Processamento concluído (todas as etapas finalizadas ou análise única)
      if (data.status === 'completed') {
        // Resetar contador de encadeamento ao finalizar com sucesso
        delete chainCountRef.current[analysisId];
        showToast("Auditoria finalizada com sucesso!", 'success');
        router.push(`/dashboard/resultado?id=${analysisId}`);
        return;
      }

      // FASE 5 — Status inesperado (ex: processing, pending, etc.)
      // Resetar contador e informar o usuário sem redirecionar
      delete chainCountRef.current[analysisId];
      showToast("Processamento em andamento. Atualize o painel para acompanhar.", 'success');
      await refreshAnalises();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível concluir agora. A análise pode ser reprocessada.";
      console.error('Erro ao processar:', err);
      showToast("Falha ao processar parecer com IA: " + message, 'error');
      // Resetar contador de encadeamento no erro
      delete chainCountRef.current[analysisId];
      await refreshAnalises();
    } finally {
      setLoadingAnalysisId(null);
    }
  };

  const handleAcceptModules = async () => {
    if (!recommendModal || acceptingModules) return;
    setAcceptingModules(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Sua sessão expirou, faça login novamente.", 'error');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      const moduleIds = recommendModal.modules.map((m) => m.module_id);

      const res = await fetch('/api/recommendations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ analysisId: recommendModal.analysisId, moduleIds })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar análise complementar');
      }

      showToast('Módulos complementares adicionados! Acesse a nova análise no painel.', 'success');
      setRecommendModal(null);
      await refreshAnalises();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao aceitar módulos:', err);
      showToast('Erro: ' + message, 'error');
    } finally {
      setAcceptingModules(false);
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
                  <th className="px-6 py-4 font-semibold">Módulos Sugeridos</th>
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

                  // FASE 3 — Profundidade da análise (analysis_depth)
                  const analysisDepth = (analise.findings as any)?.analysis_depth ?? 1;
                  const depthLabel = analysisDepth === 1
                    ? null
                    : analysisDepth === 2
                      ? 'Complementar 1'
                      : `Complementar ${analysisDepth - 1}`;

                  // Extrair módulos sugeridos (FASE 2 — Recommended Modules)
                  const recommended = getRecommendedModules(analise);

                  // FASE 3 — Complementary children info
                  const complementaryChildren = (analise.findings as any)?.complementary_children as Array<{ child_analysis_id: string; created_at: string; modules: string[]; total: number }> | undefined;

                  return (
                    <tr key={analise.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin size={18} className="text-brand-green" />
                          <span className="font-semibold text-gray-800">{analise.properties?.name}</span>
                          {depthLabel && (
                            <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                              {depthLabel}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 ml-6">{analise.properties?.city}, {analise.properties?.state}</span>
                        {/* FASE 3 — Indicador visual de análises complementares vinculadas */}
                        {complementaryChildren && complementaryChildren.length > 0 && (
                          <div className="mt-1 ml-6 flex flex-wrap gap-1">
                            {complementaryChildren.map((child, idx) => (
                              <span key={idx} className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                                +{child.modules.length} módulo(s) complementar(es)
                              </span>
                            ))}
                          </div>
                        )}
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
                        {recommended.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                            {recommended.slice(0, 3).map((mod) => (
                              <span
                                key={mod.module_id}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${priorityStyles[mod.priority || ''] || 'bg-gray-50 text-gray-600 border-gray-200'}`}
                                title={`${mod.title}${mod.price ? ` — R$ ${mod.price.toFixed(2)}` : ''}`}
                              >
                                {mod.title.length > 18 ? mod.title.substring(0, 16) + '…' : mod.title}
                              </span>
                            ))}
                            {recommended.length > 3 && (
                              <span className="text-gray-400 text-[10px] font-medium self-center">+{recommended.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px] font-medium">-</span>
                        )}
                      </td>
                    <td className="px-6 py-4">
                        {statusType === 'completed' ? (
                          <div className="flex flex-col gap-1.5">
                            {hasParecer ? (
                              <Link href={`/dashboard/resultado?id=${analise.id}`} className="text-brand-green font-bold hover:text-brand-gold transition-colors text-sm">
                                Ver Parecer
                              </Link>
                            ) : (
                              <span className="text-red-500 text-xs font-semibold">Anomalia: parecer não localizado</span>
                            )}
                            {recommended.length > 0 && (
                              <button
                                onClick={() =>
                                  setRecommendModal({
                                    analysisId: analise.id,
                                    propertyName: analise.properties?.name || 'Propriedade',
                                    modules: recommended
                                  })
                                }
                                className="text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded text-[10px] font-bold transition-colors w-fit"
                              >
                                + Adicionar Módulo
                              </button>
                            )}
                          </div>
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
                            <div className="flex flex-col gap-2 max-w-[300px]">
                              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide w-fit">
                                Exige processamento em etapas
                              </span>
                              <span className="text-gray-500 text-[10px] leading-tight">
                                Esta matrícula possui volume ou complexidade acima do limite de processamento único. Adquira as etapas abaixo para uma auditoria completa:
                              </span>
                              <div className="flex flex-col gap-1.5 mt-1">
                                {[
                                  { id: 'matricula_individual', name: 'Análise de Matrícula Individual', price: 99.90 },
                                  { id: 'cadeia_dominial', name: 'Cadeia Dominial Registral', price: 199.90 },
                                  { id: 'origem_publica', name: 'Auditoria de Origem Pública', price: 199.90 },
                                  { id: 'nulidades_fraudes', name: 'Mapeamento de Nulidades e Fraudes', price: 249.90 },
                                ].map((etapa) => {
                                  // Verificar se o módulo já existe na análise original
                                  const selectedModules = (analise.findings as any)?.selected_modules || [];
                                  const alreadyHasModule = selectedModules.includes(etapa.id);
                                  return (
                                    <div key={etapa.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${alreadyHasModule ? 'bg-green-500' : 'bg-amber-400'}`} />
                                        <span className={`text-[10px] leading-tight ${alreadyHasModule ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>
                                          {etapa.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        {alreadyHasModule ? (
                                          <span className="text-[9px] text-green-600 font-bold uppercase">Contratado</span>
                                        ) : (
                                          <>
                                            <span className="text-[10px] font-bold text-brand-green">R$ {etapa.price.toFixed(2)}</span>
                                            <button
                                              onClick={() => {
                                                // Abrir modal com módulo específico
                                                setRecommendModal({
                                                  analysisId: analise.id,
                                                  propertyName: analise.properties?.name || 'Propriedade',
                                                  modules: [{
                                                    module_id: etapa.id,
                                                    title: etapa.name,
                                                    price: etapa.price
                                                  }]
                                                });
                                              }}
                                              className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold hover:brightness-110 transition-all"
                                            >
                                              Comprar
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <span className="text-gray-400 text-[9px] leading-tight mt-1">
                                * Cada etapa gera uma nova análise complementar vinculada a esta. Preço total estimado: <strong className="text-gray-700">R$ 749,60</strong>.
                              </span>
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
                            onClick={() => handlePayNow(analise.id)}
                            className="bg-brand-gold text-brand-green px-3 py-1 rounded text-xs font-bold hover:brightness-110 transition-all shadow"
                          >
                            Pagar
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

      {/* Modal de confirmação de módulos complementares — FASE 2.0.2 */}
      {recommendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Adicionar Módulos Complementares
              </h3>
              <button
                onClick={() => !acceptingModules && setRecommendModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={acceptingModules}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              A análise de <strong>{recommendModal.propertyName}</strong> detectou oportunidades de aprofundamento. Os seguintes módulos serão adicionados a uma nova análise complementar:
            </p>
            <div className="space-y-2 mb-4">
              {recommendModal.modules.map((mod) => (
                <div
                  key={mod.module_id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      mod.priority === 'critica' ? 'bg-red-500' :
                      mod.priority === 'alta' ? 'bg-amber-500' :
                      mod.priority === 'media' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-sm font-semibold text-gray-800">{mod.title}</span>
                  </div>
                  {mod.price != null && (
                    <span className="text-sm font-bold text-brand-green">
                      R$ {mod.price.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-amber-50 rounded-lg px-4 py-3 border border-amber-200 mb-6">
              <span className="text-sm font-semibold text-amber-800">Valor total estimado</span>
              <span className="text-lg font-bold text-amber-800">
                R$ {recommendModal.modules.reduce((sum, m) => sum + (m.price || 0), 0).toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-4 leading-relaxed">
              <p className="mb-1"><strong>Tempo estimado:</strong> 3-5 minutos por módulo.</p>
              <p>Uma nova análise será criada com status "Pendente". Acesse-a pelo painel, realize o pagamento e aguarde o parecer complementar.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRecommendModal(null)}
                disabled={acceptingModules}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAcceptModules}
                disabled={acceptingModules}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-green text-white font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acceptingModules ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Criando...
                  </>
                ) : (
                  'Confirmar e Criar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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