"use client";
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Plus, FileText, MapPin, AlertTriangle, CheckCircle, Clock, ArrowUpRight, Search, Filter, BarChart3, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Analysis, AnalysisFindings } from '@/types/analise';
import { normalizeStatus, calcularScoreAgroLex } from '@/types/analise';
import ScoreAgroLex from '@/components/ScoreAgroLex';
import { isfTelemetry } from '@/lib/isf/isfTelemetry';
import { getAnalysisRiskLevel } from '@/lib/isf/getAnalysisRiskLevel';
import type { ISFTelemetryResult } from '@/lib/isf/isfTelemetry';
import {
  getISFStyle,
  getISFLabel,
  getISFHex,
  getISFBgTint,
  getISFTextTint,
  getISFDescription,
  classifyISFScore,
  normalizeISFLevel,
} from '@/lib/isf/isfTaxonomy';
import type { ISFLevel } from '@/lib/isf/isfTaxonomy';
import { getCommercialAccess, type TrialProfile } from '@/lib/commercial/trial';
import { getPlanPermissions } from '@/lib/commercial/plans';

const planLimits: Record<string, number> = {
  trial: 10,
  starter: 150,
  pro: 1000,
  premium: 5000,
  enterprise: 5000,
};

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("Profissional");
  const [analises, setAnalises] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [planType, setPlanType] = useState<string>('trial');
  const [loadingAnalysisId, setLoadingAnalysisId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FASE 5 — Proteção contra loop infinito no encadeamento automático
  const chainCountRef = useRef<Record<string, number>>({});
  const MAX_AUTO_CHAIN = 8;

  // SPRINT 5 — Telemetria ISF v2
  const [isfData, setIsfData] = useState<ISFTelemetryResult | null>(null);

  // SPRINT COMERCIAL P0 — FASE 2: Trial profile e acesso comercial
  const [trialProfile, setTrialProfile] = useState<TrialProfile | null>(null);
  const [trialBlockModal, setTrialBlockModal] = useState(false);

  // FASE 2.0.2 — Modal de recomendação
  const [recommendModal, setRecommendModal] = useState<{
    analysisId: string;
    propertyName: string;
    modules: Array<{ module_id: string; title: string; priority?: string; price?: number | null }>;
  } | null>(null);
  const [acceptingModules, setAcceptingModules] = useState(false);

  // SPRINT COMERCIAL P0.2 — Trial control e mensagens rotativas
  const [trialUsed, setTrialUsed] = useState(false);
  const [rotatingMessage, setRotatingMessage] = useState("Analisando mais de 50 critérios fundiários...");

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loadingAnalysisId) {
      const messages = [
        "Analisando mais de 50 critérios fundiários...",
        "Validando cadeia dominial...",
        "Verificando inconsistências registrais...",
        "Calculando Índice de Segurança Fundiária...",
        "Conferindo sinais de litígio...",
        "Mapeando riscos ocultos..."
      ];
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % messages.length;
        setRotatingMessage(messages[idx]);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [loadingAnalysisId]);

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

      // Buscar Assinatura & Créditos Reais
      let currentSub;
      try {
        const res = await fetch('/api/subscription', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (res.ok) {
          currentSub = await res.json();
          setCredits(currentSub.credits_available);
          if (currentSub && currentSub.plan_type) {
            setPlanType(currentSub.plan_type);
          }
        } else {
          console.error('Erro ao buscar assinatura:', await res.text());
        }
      } catch (err) {
        console.error('Erro ao buscar assinatura:', err);
      }

      // SPREAD TRIAL → PLANO PAGO: Bloquear nova análise se o teste gratuito/créditos acabaram
      if (currentSub) {
        if (currentSub.plan_type === 'trial') {
          // Se o plano for trial e ele já usou (ou se tem 0 créditos), consideramos o trial terminado
          const { data: analysesCount } = await supabase
            .from('analyses')
            .select('id', { count: 'exact' })
            .eq('user_id', session.user.id);
          const hasUsedTrial = (analysesCount?.length || 0) >= 1;
          if (hasUsedTrial || currentSub.credits_available === 0) {
            setTrialUsed(true);
          }
        } else if (currentSub.credits_available === 0) {
          // Se for outro plano com 0 créditos, exibe aviso ou bloqueia
          setTrialUsed(true); // Reutiliza o estado de bloqueio/aviso de upgrade
        }
      }

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

        // SPRINT 5 — Calcular telemetria ISF v2 com análises completas
        const concluidas = data.filter((a: any) => a.status === 'completed');
        if (concluidas.length > 0) {
          setIsfData(isfTelemetry(concluidas));
        }
      }
      setLoading(false);
    };
    
    checkUserAndFetchData();
  }, [router]);

  // Polling para atualizações em background
  useEffect(() => {
    const hasProcessing = analises.some(a => a.status === 'processing');
    
    // Auto-chain para etapas pendentes
    const hasPendingStage = analises.find(a => 
      a.status === 'ready_for_processing' && 
      (a.findings as any)?.current_step?.includes('Aguardando processamento da próxima etapa')
    );

    if (!hasProcessing && !hasPendingStage) return;

    // Se houver uma etapa pendente esperando chain e não estiver carregando algo
    if (hasPendingStage && !loadingAnalysisId) {
      handleStartAnalysis(hasPendingStage.id, hasPendingStage.properties?.id ?? '', { isAutoChain: true });
    }

    const interval = setInterval(() => {
      refreshAnalises();
    }, 5000);

    return () => clearInterval(interval);
  }, [analises, loadingAnalysisId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  // Refatorado na P0.5: Não há mais pagamento por análise individual. Redireciona para o fluxo de tentar iniciar a IA.
  const handlePayNow = async (analysisId: string) => {
    const analise = analises.find(a => a.id === analysisId);
    if (analise) {
      handleStartAnalysis(analysisId, analise.properties?.id ?? '');
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
      technicalErrorType === 'ai_incomplete_response' ||
      technicalErrorType === 'ai_quota_exceeded';
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
    if (technicalErrorType === 'ai_quota_exceeded') {
      return 'Limite temporário da IA atingido. Tente novamente mais tarde.';
    }
    return 'Vamos reprocessar esta análise sem reenviar os documentos.';
  };

  const getRecommendedModules = (analysis: Analysis): Array<{ module_id: string; title: string; priority?: string; price?: number | null }> => {
    const recs = (analysis.findings as any)?.case_file?.recommended_modules;
    if (!Array.isArray(recs) || recs.length === 0) return [];
    
    // HOTFIX P0 — Verificar módulos já processados no pai (module_results) e filhos existentes (complementary_children)
    const moduleResults = (analysis.findings as any)?.case_file?.module_results || {};
    const completedModules = new Set<string>(
      Object.keys(moduleResults).filter((modId) => moduleResults[modId]?.status === 'completed')
    );
    
    const complementaryChildren = Array.isArray((analysis.findings as any)?.complementary_children)
      ? (analysis.findings as any).complementary_children
      : [];
    for (const child of complementaryChildren) {
      if (Array.isArray(child.modules)) {
        for (const modId of child.modules) {
          completedModules.add(modId);
        }
      }
    }
    
    return recs.map((r: any) => ({
      module_id: String(r.module_id || ''),
      title: String(r.title || r.module_id || ''),
      priority: typeof r.priority === 'string' ? r.priority : undefined,
      price: typeof r.price === 'number' ? r.price : null,
      already_processed: completedModules.has(String(r.module_id || ''))
    }));
  };

  function getRiskStyle(level: string): string {
    // P1B — Consumir taxonomy centralizada
    return getISFStyle(level);
  }

  /**
   * P1B — Extrai ISF v2 dos findings de forma segura.
   * Fonte primária: findings.isf_v2
   * Fallback: análise legada (risk_level + calcularScoreAgroLex)
   */
  function getISFV2FromFindings(findings: any): {
    isf_score: number | null;
    risk_label: string | null;
    risk_level: string | null;
  } {
    const isfV2 = findings?.isf_v2;
    if (isfV2 && typeof isfV2.isf_score === 'number') {
      return {
        isf_score: isfV2.isf_score,
        risk_label: isfV2.risk_label || null,
        risk_level: isfV2.risk_level || null,
      };
    }
    return { isf_score: null, risk_label: null, risk_level: null };
  }

  const handleStartAnalysis = async (analysisId: string, propertyId: string, retryOptions?: { retryMessage?: string; forceRetry?: boolean; isAutoChain?: boolean }) => {
    if (loadingAnalysisId) return;

    const isAutoChain = retryOptions?.isAutoChain === true;
    const currentChainCount = chainCountRef.current[analysisId] || 0;

    if (isAutoChain && currentChainCount >= MAX_AUTO_CHAIN) {
      showToast("Processamento pausado por segurança. Clique em iniciar novamente.", 'error');
      delete chainCountRef.current[analysisId];
      await refreshAnalises();
      return;
    }

    setLoadingAnalysisId(analysisId);

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

      if (res.status === 402) {
        delete chainCountRef.current[analysisId];
        showToast("Saldo insuficiente. Redirecionando para planos...", 'error');
        setTimeout(() => router.push('/dashboard/planos'), 1500);
        return;
      }

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao processar análise com IA');
      }

      const data = await res.json();

      if (data.status === 'modules_already_processed') {
        // HOTFIX P0 — Módulos já processados no pai: não é erro, redirecionar para dossiê existente
        delete chainCountRef.current[analysisId];
        const targetId = data.parentAnalysisId || data.currentAnalysisId || analysisId;
        showToast('Esses módulos já foram processados. Você pode acessar o dossiê existente.', 'success');
        router.push(`/dashboard/resultado?id=${targetId}`);
        return;
      }

      if (data.status === 'processing_stage_completed') {
        showToast("Etapa concluída. Continuando próxima etapa...", 'success');
        await refreshAnalises();
        setTimeout(() => handleStartAnalysis(analysisId, propertyId, { isAutoChain: true }), 0);
        return;
      }

      if (data.status === 'completed') {
        delete chainCountRef.current[analysisId];
        showToast("Auditoria finalizada com sucesso!", 'success');
        router.push(`/dashboard/resultado?id=${analysisId}`);
        return;
      }

      delete chainCountRef.current[analysisId];
      showToast("Processamento em andamento. Atualize o painel para acompanhar.", 'success');
      await refreshAnalises();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível concluir agora. A análise pode ser reprocessada.";
      console.error('Erro ao processar:', err);
      showToast("Falha ao processar parecer com IA: " + message, 'error');
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

      // HOTFIX P0 — Filtrar apenas módulos não processados antes de enviar
      const moduleIds = recommendModal.modules
        .filter((m) => !(m as any).already_processed)
        .map((m) => m.module_id);

      if (moduleIds.length === 0) {
        showToast('Todos os módulos selecionados já foram processados anteriormente.', 'error');
        setAcceptingModules(false);
        return;
      }

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
        // HOTFIX P0 — Tratar modules_already_processed como informação, não erro
        if (err.status === 'modules_already_processed') {
          showToast(err.message || 'Módulos já processados. Acesse o dossiê existente.', 'success');
          setRecommendModal(null);
          await refreshAnalises();
          return;
        }
        throw new Error(err.error || 'Erro ao criar análise complementar');
      }

      const data = await res.json();
      
      // HOTFIX P0 — Tratar modules_already_processed no retorno 200 também
      if (data.status === 'modules_already_processed') {
        showToast(data.message || 'Módulos já processados. Acesse o dossiê existente.', 'success');
        setRecommendModal(null);
        await refreshAnalises();
        return;
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

  // --- Métricas Executivas ---
  const analisesConcluidas = analises.filter(a => a.status === 'completed').length;
  const analisesEmAndamento = analises.filter(a => a.status === 'processing' || a.status === 'pending' || a.status === 'payment_pending' || a.status === 'ready_for_processing').length;
  const riscosAltos = analises.filter(a => getAnalysisRiskLevel(a) === 'alto_risco').length;
  const riscosCriticos = analises.filter(a => getAnalysisRiskLevel(a) === 'critico').length;
  const riscosMedios = analises.filter(a => getAnalysisRiskLevel(a) === 'atencao').length;
  const riscosBaixos = analises.filter(a => getAnalysisRiskLevel(a) === 'seguro' || getAnalysisRiskLevel(a) === 'muito_seguro').length;
  const semRisco = analises.filter(a => getAnalysisRiskLevel(a) === 'desconhecido').length;
  const totalRiscos = riscosAltos + riscosCriticos;

  // Horas economizadas (benchmark: 8h por auditoria concluída)
  const horasEconomizadas = analisesConcluidas * 8;

  // RiskFilter precisa combinar com busca e status
  const analisesFiltradas = analises.filter(a => {
    const matchSearch = !searchTerm || 
      a.properties?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.properties?.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchRisk = !riskFilter || (
      riskFilter === 'sem_risco'
        ? getAnalysisRiskLevel(a) === 'desconhecido'
        : getAnalysisRiskLevel(a) === riskFilter.toLowerCase()
    );
    return matchSearch && matchStatus && matchRisk;
  });

  // P1B — Score médio do portfólio usando ISF v2 como fonte primária
  const scoresISFV2 = analises
    .filter(a => a.status === 'completed' && a.findings)
    .map(a => {
      const isfV2 = getISFV2FromFindings(a.findings);
      if (isfV2.isf_score !== null) return isfV2.isf_score;
      // Fallback: score legado
      return calcularScoreAgroLex(a.findings, a.risk_level).score;
    });
  const scoreMedio = scoresISFV2.length > 0
    ? Math.round(scoresISFV2.reduce((a, b) => a + b, 0) / scoresISFV2.length)
    : null;
  // P1B — Determinar nível de risco da média via taxonomy
  const scoreMedioLevel = scoreMedio !== null ? classifyISFScore(scoreMedio) : null;
  const scoreMedioStyle = scoreMedioLevel ? getISFStyle(scoreMedioLevel) : '';
  const scoreMedioBgTint = scoreMedioLevel ? getISFBgTint(scoreMedioLevel) : 'bg-slate-100';
  const scoreMedioTextTint = scoreMedioLevel ? getISFTextTint(scoreMedioLevel) : 'text-slate-600';
  const scoreMedioHex = scoreMedioLevel ? getISFHex(scoreMedioLevel) : '#94A3B8';
  const scoreMedioDesc = scoreMedioLevel ? getISFDescription(scoreMedioLevel) : 'Índice de Segurança Fundiária';


  // Paginação — 5 registros por página, considera resultado filtrado
  const totalPaginas = Math.max(1, Math.ceil(analisesFiltradas.length / ITEMS_PER_PAGE));
  const paginaAtual = Math.min(currentPage, totalPaginas);
  const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
  const fim = inicio + ITEMS_PER_PAGE;
  const analisesPaginadas = analisesFiltradas.slice(inicio, fim);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
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
        {/* Banner Trial Utilizado */}
        {trialUsed && (
          <div className="mb-8 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 rounded-r-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-amber-900 text-lg">Seu teste gratuito terminou.</h3>
              <p className="text-amber-800 text-sm font-medium">Você já utilizou seu acesso experimental ou limite de páginas. Escolha um dos nossos planos para continuar a mitigar riscos.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/dashboard/planos"
                className="px-4 py-2 bg-brand-green text-white font-bold rounded-lg hover:brightness-110 transition-all text-xs shadow-md"
              >
                Assinar Starter
              </Link>
              <Link
                href="/dashboard/planos"
                className="px-4 py-2 bg-brand-gold text-brand-green font-bold rounded-lg hover:brightness-110 transition-all text-xs shadow-md"
              >
                Assinar Pro
              </Link>
              <Link
                href="/dashboard/planos"
                className="px-4 py-2 bg-gray-900 text-white font-bold rounded-lg hover:brightness-110 transition-all text-xs shadow-md"
              >
                Assinar Premium
              </Link>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Centro de Inteligência Fundiária</h1>
            <p className="text-gray-600 mt-1">Acompanhe a segurança jurídica do seu portfólio de imóveis rurais.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/planos" className="flex items-center gap-2 bg-white text-brand-dark border-2 border-brand-gold px-5 py-3 rounded-lg font-bold hover:bg-amber-50 transition-all shadow-sm">
              <Plus size={20} className="text-brand-gold" />
              <div className="flex flex-col items-start leading-tight">
                <span>{credits > 0 ? `${credits} páginas` : 'Planos'}</span>
                {credits > 0 && (
                  <span className="text-[9px] font-normal text-gray-500">Saldo de páginas disponível</span>
                )}
              </div>
            </Link>
            <Link href="/dashboard/nova-analise" className="flex items-center gap-2 bg-brand-gold text-brand-green px-5 py-3 rounded-lg font-bold hover:brightness-110 transition-all shadow-lg hover:-translate-y-1">
              <Plus size={20} />
              + Nova Auditoria
            </Link>
          </div>
        </div>

        {/* BLOCO 5 — KPIs (Cards Executivos Premium) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
          {/* Card 1 — Auditorias Realizadas */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Auditorias Realizadas</span>
              <div className="p-2 bg-brand-green/10 rounded-lg">
                <ShieldCheck size={18} className="text-brand-green" />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">{analisesConcluidas}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${analisesEmAndamento > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
              {analisesEmAndamento > 0 ? `${analisesEmAndamento} em andamento` : 'Todas concluídas'}
            </div>
          </div>

          {/* Card 2 — Riscos Identificados */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Riscos Identificados</span>
              <div className={`p-2 ${totalRiscos > 0 ? 'bg-red-100' : 'bg-green-100'} rounded-lg`}>
                <AlertTriangle size={18} className={totalRiscos > 0 ? 'text-red-600' : 'text-green-600'} />
              </div>
            </div>
            <p className="text-3xl font-black text-gray-800">{totalRiscos}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="text-red-600 font-bold">{riscosAltos} alto</span>
              {riscosCriticos > 0 && <span className="text-red-700 font-bold ml-1">/ {riscosCriticos} crítico</span>}
            </div>
          </div>

          {/* Card 3 — Consumo Mensal */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Saldo de Páginas</span>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Layers size={18} className="text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-800 font-sans">
              {credits} pág(s) restando
            </p>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-brand-green h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (credits / (planLimits[planType] || 10)) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
              <span>Plano: {planType === 'internal_test' ? 'INTERNO DE TESTES' : planType.toUpperCase()}</span>
              <Link href="/dashboard/planos" className="text-brand-gold hover:underline font-bold">Comprar páginas</Link>
            </div>
          </div>

          {/* Card 4 — Segurança Fundiária (ISF v2) */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">SEGURANÇA FUNDIÁRIA</span>
              <div className={`p-2 rounded-lg ${scoreMedioBgTint}`}>
                <BarChart3 size={18} className={scoreMedioTextTint} />
              </div>
            </div>
            <p className={`text-3xl font-black ${scoreMedioTextTint}`}>
              {scoreMedio !== null ? `${scoreMedio}/100` : '--'}
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span title="ISF (Índice de Segurança Fundiária): quanto maior o valor, maior a segurança fundiária estimada.">
                {scoreMedioDesc}
              </span>
            </div>
          </div>
        </div>

        {/* BLOCO 1 — Resumo Executivo por Risco */}
        <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-brand-green" />
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Filtrar por Risco</span>
            <span className="text-[10px] text-gray-400 font-normal ml-1">Clique para filtrar a tabela abaixo</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {/* Críticos */}
            <button
              onClick={() => { setRiskFilter('critico'); setCurrentPage(1); }}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                riskFilter === 'critico'
                  ? 'border-red-500 bg-red-50 shadow-md'
                  : 'border-red-200 bg-red-50/50 hover:border-red-400'
              }`}
            >
              <span className="text-2xl font-black text-red-700">{riscosCriticos}</span>
              <span className="text-xs font-bold text-red-600 uppercase mt-1">Críticos</span>
              <span className="text-[10px] text-red-400 mt-0.5">{riscosCriticos === 1 ? 'análise' : 'análises'}</span>
            </button>
            {/* Altos */}
            <button
              onClick={() => { setRiskFilter('alto'); setCurrentPage(1); }}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                riskFilter === 'alto'
                  ? 'border-amber-500 bg-amber-50 shadow-md'
                  : 'border-amber-200 bg-amber-50/50 hover:border-amber-400'
              }`}
            >
              <span className="text-2xl font-black text-amber-700">{riscosAltos}</span>
              <span className="text-xs font-bold text-amber-600 uppercase mt-1">Altos</span>
              <span className="text-[10px] text-amber-400 mt-0.5">{riscosAltos === 1 ? 'análise' : 'análises'}</span>
            </button>
            {/* Médios */}
            <button
              onClick={() => { setRiskFilter('medio'); setCurrentPage(1); }}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                riskFilter === 'medio'
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-blue-200 bg-blue-50/50 hover:border-blue-400'
              }`}
            >
              <span className="text-2xl font-black text-blue-700">{riscosMedios}</span>
              <span className="text-xs font-bold text-blue-600 uppercase mt-1">Médios</span>
              <span className="text-[10px] text-blue-400 mt-0.5">{riscosMedios === 1 ? 'análise' : 'análises'}</span>
            </button>
            {/* Baixos */}
            <button
              onClick={() => { setRiskFilter('baixo'); setCurrentPage(1); }}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                riskFilter === 'baixo'
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-green-200 bg-green-50/50 hover:border-green-400'
              }`}
            >
              <span className="text-2xl font-black text-green-700">{riscosBaixos}</span>
              <span className="text-xs font-bold text-green-600 uppercase mt-1">Baixos</span>
              <span className="text-[10px] text-green-400 mt-0.5">{riscosBaixos === 1 ? 'análise' : 'análises'}</span>
            </button>
            {/* Sem risco */}
            <button
              onClick={() => { setRiskFilter('sem_risco'); setCurrentPage(1); }}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                riskFilter === 'sem_risco'
                  ? 'border-gray-500 bg-gray-50 shadow-md'
                  : 'border-gray-200 bg-gray-50/50 hover:border-gray-400'
              }`}
            >
              <span className="text-2xl font-black text-gray-700">{semRisco}</span>
              <span className="text-xs font-bold text-gray-600 uppercase mt-1">Sem risco</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{semRisco === 1 ? 'análise' : 'análises'}</span>
            </button>
          </div>
        </div>

        {/* BLOCO 2 — Semáforo Executivo (ISF v2) */}
        <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">
              {riscosCriticos > 0 ? '🔴' : riscosAltos > 0 ? '🟠' : riscosMedios > 0 ? '🟡' : '🟢'}
            </span>
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Status Geral da Carteira</span>
          </div>
          <p className="text-sm text-gray-700">
            {riscosCriticos > 0
              ? '🔴 Existem análises críticas que exigem atenção imediata.'
              : riscosAltos > 0
                ? '🟠 Existem análises de alto risco que merecem atenção prioritária.'
                : riscosMedios > 0
                  ? '🟡 Existem análises com pontos relevantes de atenção.'
                  : riscosBaixos > 0
                    ? '🟢 Carteira com boa segurança fundiária.'
                    : '🟢 Nenhum risco elevado identificado no momento.'}
          </p>
        </div>

        {/* SPRINT 5 — ISF Analytics Card (bloco discreto) */}
        {isfData && isfData.totalAnalyses > 0 && (
          <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-brand-green" />
              <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">ISF — Comparativo de Métricas</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div>
                <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Análises</span>
                <p className="text-xl font-black text-gray-800">{isfData.totalAnalyses}</p>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Média ISF</span>
                <p className="text-xl font-black text-brand-green">{isfData.averageISF}</p>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Média Legado</span>
                <p className="text-xl font-black text-gray-600">{isfData.averageLegacyScore}</p>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Diferença</span>
                <p className={`text-xl font-black ${isfData.averageDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {isfData.averageDifference >= 0 ? '+' : ''}{isfData.averageDifference}
                </p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Distribuição</span>
                <div className="flex gap-2 mt-1">
                  <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">{isfData.distribution.seguro}%</span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{isfData.distribution.atencao}%</span>
                  <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">{isfData.distribution.critico}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BLOCO 4 — Ação Recomendada (ISF v2) */}
        <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className={
              riscosCriticos > 0 ? 'text-red-600' :
              riscosAltos > 0 ? 'text-amber-600' :
              riscosMedios > 0 ? 'text-yellow-600' : 'text-green-600'
            } />
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Ação Recomendada</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-700">
              {riscosCriticos > 0
                ? 'Existem análises críticas que exigem atuação imediata.'
                : riscosAltos > 0
                  ? 'Existem análises de alto risco que merecem atenção prioritária.'
                  : riscosMedios > 0
                    ? 'Existem análises com pontos relevantes de atenção.'
                    : riscosBaixos > 0
                      ? 'Carteira com boa segurança fundiária.'
                      : 'Carteira com excelente segurança fundiária.'}
            </p>
            <a
              href="#tabela-auditorias"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap ${
                riscosCriticos > 0
                  ? 'bg-red-600 text-white hover:brightness-110'
                  : riscosAltos > 0
                    ? 'bg-amber-600 text-white hover:brightness-110'
                    : riscosMedios > 0
                      ? 'bg-yellow-600 text-white hover:brightness-110'
                      : 'bg-brand-green text-white hover:brightness-110'
              }`}
            >
              {riscosCriticos > 0
                ? 'Ver auditorias críticas'
                : riscosAltos > 0
                  ? 'Ver auditorias de alto risco'
                  : riscosMedios > 0
                    ? 'Ver auditorias com atenção'
                    : 'Ver todas as auditorias'}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Suas Auditorias</h2>
            <p className="text-gray-500 text-sm">{analisesFiltradas.length} registro(s) encontrado(s){analisesFiltradas.length > 0 && ` — Página ${paginaAtual} de ${totalPaginas}`}</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por propriedade..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="">Todos os Status</option>
              <option value="completed">Concluído</option>
              <option value="processing">Analisando</option>
              <option value="pending">Pendente</option>
              <option value="error">Falha</option>
            </select>
            <select
              value={riskFilter}
              onChange={e => { setRiskFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="">Todos os Riscos</option>
              <option value="critico">Crítico</option>
              <option value="alto">Alto</option>
              <option value="medio">Médio</option>
              <option value="baixo">Baixo</option>
              <option value="sem_risco">Sem risco</option>
            </select>
          </div>
        </div>

        {/* Tabela de Auditorias */}
        <div id="tabela-auditorias" className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {loading ? (
             <div className="p-10 text-center text-gray-500">Carregando seus dados...</div>
          ) : analisesFiltradas.length === 0 ? (
             <div className="p-10 text-center text-gray-500">
               {searchTerm || statusFilter 
                 ? 'Nenhuma auditoria encontrada com os filtros aplicados.' 
                 : 'Nenhum documento enviado ainda. Clique em "Nova Auditoria Fundiária" para começar!'}
             </div>
          ) : (
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Propriedade</th>
                  <th className="px-6 py-4 font-semibold">Documento</th>
                  <th className="px-6 py-4 font-semibold">Status da IA</th>
                  <th className="px-6 py-4 font-semibold">Risco</th>
                  <th className="px-6 py-4 font-semibold cursor-help">
                    ISF
                    <span className="ml-1.5 text-gray-400 cursor-help inline-block" title="ISF (Índice de Segurança Fundiária). Quanto maior o ISF, maior o risco fundiário identificado.">ⓘ</span>
                  </th>
                  <th className="px-6 py-4 font-semibold">Módulos Sugeridos</th>
                  <th className="px-6 py-4 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analisesPaginadas.map((analise) => {
                  const { text: statusText, colorClass: statusColorClass, type: statusType } = normalizeStatus(analise.status || '');
                  const hasParecer = analise.findings && analise.findings.resumo && String(analise.findings.resumo).trim().length > 0;
                  const canRetryAnalysis = statusType === 'error' && isRecoverableAnalysisError(analise);
                  const analysisDepth = (analise.findings as any)?.analysis_depth ?? 1;
                  const depthLabel = analysisDepth === 1
                    ? null
                    : analysisDepth === 2
                      ? 'Complementar 1'
                      : `Complementar ${analysisDepth - 1}`;
                  const recommended = getRecommendedModules(analise);
                  const complementaryChildren = (analise.findings as any)?.complementary_children as Array<{ child_analysis_id: string; created_at: string; modules: string[]; total: number }> | undefined;
                  
                  // HOTFIX UI — Detectar análise complementar com módulos já processados no pai
                  const findingsAny = analise.findings as any;
                  const isComplementarJaProcessado = 
                    findingsAny.parent_analysis_id != null &&
                    Array.isArray(findingsAny.selected_modules) &&
                    findingsAny.selected_modules.length > 0 &&
                    findingsAny.selected_modules.every(
                      (modId: string) => findingsAny.case_file?.module_results?.[modId]?.status === 'completed'
                    );
                  
                  // Score individual
                  const scoreData = calcularScoreAgroLex(analise.findings, analise.risk_level);

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
                        {complementaryChildren && complementaryChildren.length > 0 && (
                          <div className="mt-1 ml-6">
                            <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                              {complementaryChildren.length} {complementaryChildren.length === 1 ? 'documento complementar' : 'documentos complementares'}
                            </span>
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
                        {statusType === 'completed' ? (() => {
                          // P1B — Fonte primária: ISF v2, fallback: risk_level legado
                          const isfV2 = getISFV2FromFindings(analise.findings);
                          const riskLabel = isfV2.risk_label || analise.risk_level;
                          return riskLabel ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getISFStyle(riskLabel)}`}>
                              {isfV2.risk_label || analise.risk_level}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm font-medium">-</span>
                          );
                        })() : (
                          <span className="text-gray-400 text-sm font-medium">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {statusType === 'completed' ? (() => {
                          // P1B — Fonte primária: ISF v2 score, fallback: score legado
                          const isfV2 = getISFV2FromFindings(analise.findings);
                          const displayScore = isfV2.isf_score !== null ? isfV2.isf_score : scoreData.score;
                          const displayLevel = isfV2.risk_level || analise.risk_level || '';
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getISFStyle(displayLevel)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getISFHex(displayLevel)}`} style={{ backgroundColor: getISFHex(displayLevel) }} />
                              ISF {displayScore}
                            </span>
                          );
                        })() : (
                          <span className="text-gray-400 text-sm font-medium">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {recommended.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                            {recommended.slice(0, 3).map((mod) => (
                              <span
                                key={mod.module_id}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRiskStyle(getAnalysisRiskLevel(analise))}`}
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
                              <Link href={`/dashboard/resultado?id=${analise.id}`} className="text-brand-green font-bold hover:text-brand-gold transition-colors text-sm flex items-center gap-1">
                                Abrir Parecer <ArrowUpRight size={14} />
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
                          <span className="text-gray-400 text-sm font-medium flex items-center gap-1">
                            <span className="animate-pulse w-2 h-2 bg-blue-500 rounded-full inline-block" /> Aguarde...
                          </span>
                        ) : statusType === 'ready_for_processing' && isComplementarJaProcessado ? (
                          <Link href={`/dashboard/resultado?id=${(analise.findings as any).parent_analysis_id}`} className="text-brand-green font-bold hover:text-brand-gold transition-colors text-sm flex items-center gap-1">
                            Abrir Parecer <ArrowUpRight size={14} />
                          </Link>
                        ) : statusType === 'ready_for_processing' ? (
                          <button
                            disabled={loadingAnalysisId !== null}
                            onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '', { retryMessage: 'Processando auditoria...' })}
                            className="bg-brand-green text-white px-3 py-1 rounded text-xs font-bold hover:brightness-110 transition-all shadow disabled:opacity-50"
                          >
                            {loadingAnalysisId === analise.id ? 'Auditando...' : 'Iniciar Parecer'}
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
                            className="bg-brand-gold text-brand-green px-4 py-2 rounded text-xs font-bold hover:brightness-110 transition-all shadow"
                          >
                            Processar Pendência →
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

        {/* Paginação — Anterior / Próxima com página atual e total */}
        {analisesFiltradas.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-sm text-gray-500">
              Exibindo {inicio + 1}–{Math.min(fim, analisesFiltradas.length)} de {analisesFiltradas.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(paginaAtual - 1)}
                disabled={paginaAtual <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <span className="px-3 py-1.5 text-sm font-bold text-brand-green bg-green-50 rounded-lg border border-green-200">
                {paginaAtual} / {totalPaginas}
              </span>
              <button
                onClick={() => setCurrentPage(paginaAtual + 1)}
                disabled={paginaAtual >= totalPaginas}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Próxima
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal de confirmação de módulos complementares */}
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
              {recommendModal.modules.map((mod) => {
                const isProcessed = (mod as any).already_processed === true;
                return (
                  <div
                    key={mod.module_id}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                      isProcessed
                        ? 'bg-green-50 border-green-200 opacity-70'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        isProcessed ? 'bg-green-500' :
                        mod.priority === 'critica' ? 'bg-red-500' :
                        mod.priority === 'alta' ? 'bg-amber-500' :
                        mod.priority === 'media' ? 'bg-blue-500' : 'bg-gray-400'
                      }`} />
                      <span className={`text-sm font-semibold ${
                        isProcessed ? 'text-gray-400 line-through' : 'text-gray-800'
                      }`}>{mod.title}</span>
                      {isProcessed && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-200 text-green-800 border border-green-300">
                          Já processado
                        </span>
                      )}
                    </div>
                    {mod.price != null && !isProcessed && (
                      <span className="text-sm font-bold text-brand-green">
                        R$ {mod.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
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

      {/* Overlay de carregamento com mensagens rotativas de valor */}
      {loadingAnalysisId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center border-t-4 border-brand-green">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="animate-spin h-8 w-8 text-brand-green" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Auditoria Fundiária em Processamento</h3>
            <p className="text-sm text-gray-500 mb-4">Esta operação pode levar até 5 minutos para documentos complexos.</p>
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200 font-medium">
              ⚠️ Nota: Como este serviço utiliza Inteligência Artificial generativa, a operação está sujeita à disponibilidade dos servidores e pode apresentar momentos de instabilidade. Caso ocorra alguma falha de conexão, tente novamente após alguns minutos.
            </p>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-brand-green font-semibold text-sm animate-pulse">
              {rotatingMessage}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}