"use client";
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Plus, FileText, MapPin, AlertTriangle, CheckCircle, Clock, ArrowUpRight, Search, Filter, BarChart3, Layers, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import Logo from '@/components/Logo';
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
  const [credits, setCredits] = useState<number | null>(null);
  const [subError, setSubError] = useState(false);
  const [planType, setPlanType] = useState<string>('trial');
  const [loadingAnalysisId, setLoadingAnalysisId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
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

  const refreshDashboardData = async () => {
    console.log('[Dashboard] Iniciando refreshDashboardData...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[Dashboard] Sessão obtida:', session ? 'Sim' : 'Não', 'Erro:', sessionError);
    if (!session) {
      console.log('[Dashboard] Sem sessão válida, redirecionando para /login');
      router.push('/login');
      return;
    }
    
    const name = session.user.user_metadata?.full_name;
    if (name) setUserName(name.split(' ')[0]);

    // Buscar Assinatura & Créditos Reais
    let currentSub;
    try {
      console.log('[Dashboard] Buscando assinatura via API...');
      const res = await fetch('/api/subscription', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      console.log('[Dashboard] Resposta assinatura status:', res.status);
      if (res.ok) {
        currentSub = await res.json();
        setCredits(currentSub.credits_available);
        setSubError(false);
        if (currentSub && currentSub.plan_type) {
          setPlanType(currentSub.plan_type);
        }
      } else {
        const errorText = await res.text();
        console.warn('[Dashboard] Falha ao buscar assinatura:', res.status, errorText);
        setSubError(true);
        
        // Só redireciona se for 401 (Não autorizado) E de fato a sessão local estiver ausente/inválida
        if (res.status === 401) {
          const { data: { session: verifySession } } = await supabase.auth.getSession();
          if (!verifySession) {
            console.log('[Dashboard] Validação de sessão confirmou ausência de usuário. Redirecionando para /login');
            router.push('/login');
            return;
          }
        }
      }
    } catch (err) {
      console.error('[Dashboard] Erro ao buscar assinatura:', err);
      setSubError(true);
    }

    // SPREAD TRIAL → PLANO PAGO: Bloquear nova análise apenas se os créditos (páginas) acabaram
    if (currentSub) {
      if (currentSub.credits_available <= 0) {
        setTrialUsed(true);
      } else {
        setTrialUsed(false);
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
      } else {
        setIsfData(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      refreshDashboardData();
    });
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
   * Fonte primária: findings.isf_v2_2 (motor 6 dimensões)
   * Fallback: findings.isf_v2 (motor v2.1 legado)
   * Fallback: análise legada (risk_level + calcularScoreAgroLex)
   */
  function getISFV2FromFindings(findings: any): {
    isf_score: number | null;
    risk_label: string | null;
    risk_level: string | null;
    isf_version: string | null;
  } {
    // 1. Motor v2.2 (6 dimensões) — fonte primária
    const isfV2_2 = findings?.isf_v2_2;
    if (isfV2_2 && typeof isfV2_2.isf_score === 'number') {
      return {
        isf_score: isfV2_2.isf_score,
        risk_label: isfV2_2.faixa_label || null,
        risk_level: isfV2_2.faixa || null,
        isf_version: '2.2',
      };
    }
    // 2. Motor v2.1 (legado)
    const isfV2 = findings?.isf_v2;
    if (isfV2 && typeof isfV2.isf_score === 'number') {
      return {
        isf_score: isfV2.isf_score,
        risk_label: isfV2.risk_label || null,
        risk_level: isfV2.risk_level || null,
        isf_version: '2.1',
      };
    }
    return { isf_score: null, risk_label: null, risk_level: null, isf_version: null };
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

      if (res.status === 403) {
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

  const handleDeleteAnalysis = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta auditoria pendente?")) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("Erro de sessão: Sessão nula em handleDeleteAnalysis.");
        showToast("Sua sessão expirou, faça login novamente.", 'error');
        router.push('/login');
        return;
      }

      const res = await fetch('/api/analyses/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ analysisId: id })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao excluir no servidor');
      }

      // 1. Remove da tela APÓS a confirmação de sucesso
      setAnalises(prev => prev.filter(a => a.id !== id));

      showToast("Auditoria pendente excluída com sucesso.", 'success');

      // 2. Atualiza o saldo/credits imediatamente e recalcula as páginas negativas
      await refreshDashboardData();
    } catch (err: any) {
      console.error('Erro de exclusão de análise:', err);
      showToast("Erro ao excluir auditoria: " + (err.message || err), 'error');
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

  // RiskFilter — mapeia valores do dropdown para níveis retornados por getAnalysisRiskLevel
  const RISK_FILTER_MAP: Record<string, string> = {
    critico: 'critico',
    alto: 'alto_risco',
    medio: 'atencao',
    baixo: 'seguro',
    sem_risco: 'desconhecido',
  };

  const analisesFiltradas = analises.filter(a => {
    const matchSearch = !searchTerm || 
      a.properties?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.properties?.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchRisk = !riskFilter || (
      getAnalysisRiskLevel(a) === (RISK_FILTER_MAP[riskFilter] || riskFilter.toLowerCase())
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

  const pendingPagesSum = analises
    .filter(a => a.status === 'payment_pending' || a.status === 'pending')
    .reduce((sum, a) => {
      let pages = (a.findings as any)?.required_pages;
      if (typeof pages !== 'number') {
        const docs = (a.findings as any)?.case_file?.documents || [];
        if (docs.length > 0) {
          pages = 0;
          for (const doc of docs) {
            if (doc.size) {
              pages += Math.max(1, Math.floor(doc.size / (1024 * 1024)));
            } else {
              pages += 1;
            }
          }
        } else {
          pages = 0;
        }
      }
      return sum + pages;
    }, 0);
  const dynamicBalance = credits !== null ? credits - pendingPagesSum : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-brand-gold">
            <Logo size="sm" className="text-white" />
          </Link>
          <div className="flex gap-4 items-center">
            {dynamicBalance !== null ? (
              <span className={`text-sm bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 font-bold flex items-center gap-1.5 ${dynamicBalance < 0 ? 'text-red-400' : 'text-brand-gold'}`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${dynamicBalance < 0 ? 'bg-red-500' : 'bg-brand-gold'}`} />
                {dynamicBalance} pág(s) restantes
              </span>
            ) : subError ? (
              <span className="text-sm bg-white/10 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 font-bold">
                Erro ao carregar saldo
              </span>
            ) : (
              <span className="text-sm bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 text-gray-300 font-bold animate-pulse">
                Carregando saldo...
              </span>
            )}
            <span className="text-sm font-medium">Olá, {userName}</span>
            <button onClick={handleLogout} className="text-sm hover:text-brand-gold transition-colors font-medium">Sair</button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Banner de Déficit de Páginas */}
        {dynamicBalance !== null && dynamicBalance < 0 && (
          <div className="mb-8 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-l-4 border-red-500 rounded-r-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-red-950 text-lg">Déficit de Páginas Detectado</h3>
              <p className="text-red-900 text-sm font-medium">
                Faltam {Math.abs(dynamicBalance)} páginas para liberar o processamento dos seus laudos/documentos pendentes. Adquira créditos ou faça upgrade.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/dashboard/planos"
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:brightness-110 transition-all text-xs shadow-md"
              >
                Comprar Páginas
              </Link>
              <Link
                href="/dashboard/planos"
                className="px-4 py-2 bg-brand-gold text-brand-green font-bold rounded-lg hover:brightness-110 transition-all text-xs shadow-md"
              >
                Fazer Upgrade
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
            <Link href="/dashboard/planos" className={`flex items-center gap-2 bg-white text-brand-dark border-2 px-5 py-3 rounded-lg font-bold hover:bg-amber-50 transition-all shadow-sm ${dynamicBalance !== null && dynamicBalance < 0 ? 'border-red-500' : 'border-brand-gold'}`}>
              <Plus size={20} className={dynamicBalance !== null && dynamicBalance < 0 ? 'text-red-500' : 'text-brand-gold'} />
              <div className="flex flex-col items-start leading-tight">
                <span>
                  {dynamicBalance === null
                    ? subError ? 'Erro no Saldo' : 'Carregando saldo...'
                    : dynamicBalance > 0
                      ? `${dynamicBalance} páginas`
                      : dynamicBalance < 0
                        ? `${dynamicBalance} páginas (Déficit)`
                        : 'Planos'}
                </span>
                {dynamicBalance !== null && dynamicBalance !== 0 && (
                  <span className={`text-[9px] font-normal ${dynamicBalance < 0 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                    {dynamicBalance < 0 ? 'Regularize seu saldo' : 'Saldo de páginas disponível'}
                  </span>
                )}
              </div>
            </Link>
            {dynamicBalance !== null && dynamicBalance <= 0 ? (
              <button
                onClick={() => {
                  showToast("Você não possui saldo de páginas. Adquira créditos ou assine um plano.", "error");
                  router.push('/dashboard/planos');
                }}
                className="flex items-center gap-2 bg-gray-300 text-gray-600 px-5 py-3 rounded-lg font-bold cursor-not-allowed shadow"
                title="Você utilizou o limite de páginas do seu plano. Compre créditos para continuar."
              >
                <Plus size={20} />
                + Nova Auditoria
              </button>
            ) : (
              <Link href="/dashboard/nova-analise" className="flex items-center gap-2 bg-brand-gold text-brand-green px-5 py-3 rounded-lg font-bold hover:brightness-110 transition-all shadow-lg hover:-translate-y-1">
                <Plus size={20} />
                + Nova Auditoria
              </Link>
            )}
          </div>
        </div>

        {/* ─── PAINEL DE INTELIGÊNCIA COMPACTO ───────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

          {/* Card 1 — Análises */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Análises</span>
              <ShieldCheck size={15} className="text-brand-green" />
            </div>
            <p className="text-2xl font-black text-gray-800">{analisesConcluidas}</p>
            <span className="text-[10px]">
              {analisesEmAndamento > 0
                ? <span className="text-amber-500 font-bold">{analisesEmAndamento} em andamento</span>
                : <span className="text-gray-400">Todas concluídas</span>}
            </span>
          </div>

          {/* Card 2 — Riscos */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Riscos</span>
              <AlertTriangle size={15} className={totalRiscos > 0 ? 'text-red-500' : 'text-green-500'} />
            </div>
            <p className="text-2xl font-black text-gray-800">{totalRiscos}</p>
            <div className="flex gap-1.5 flex-wrap">
              {riscosCriticos > 0 && <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{riscosCriticos} crítico</span>}
              {riscosAltos > 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{riscosAltos} alto</span>}
              {riscosCriticos === 0 && riscosAltos === 0 && <span className="text-[10px] text-green-600">Sem riscos críticos</span>}
            </div>
          </div>

          {/* Card 3 — Saldo */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Saldo</span>
              <Layers size={15} className={dynamicBalance !== null && dynamicBalance < 0 ? 'text-red-500' : 'text-blue-500'} />
            </div>
            <p className={`text-2xl font-black ${dynamicBalance !== null && dynamicBalance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {dynamicBalance === null ? '—' : dynamicBalance}
              <span className="text-xs font-normal text-gray-400 ml-1">pág.</span>
            </p>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${dynamicBalance !== null && dynamicBalance < 0 ? 'bg-red-500 animate-pulse' : 'bg-brand-green'}`}
                style={{ width: `${Math.min(100, (Math.max(0, dynamicBalance ?? 0) / (planLimits[planType] || 10)) * 100)}%` }}
              />
            </div>
            <Link href="/dashboard/planos" className="text-[10px] text-brand-gold hover:underline font-bold">
              {planType === 'internal_test' ? 'INTERNO' : planType.toUpperCase()} · Comprar páginas →
            </Link>
          </div>

          {/* Card 4 — ISF Médio + distribuição */}
          <div className={`p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1.5 ${scoreMedioBgTint}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">ISF Médio</span>
              <BarChart3 size={15} className={scoreMedioTextTint} />
            </div>
            <p className={`text-2xl font-black ${scoreMedioTextTint}`}>
              {scoreMedio !== null ? scoreMedio : '—'}
              <span className="text-xs font-normal opacity-50 ml-1">/100</span>
            </p>
            {/* Barra de distribuição por criticidade */}
            {analises.length > 0 && (
              <div className="flex rounded-full overflow-hidden h-1.5 mt-0.5" title="Distribuição: vermelho=crítico, âmbar=alto, amarelo=médio, verde=baixo">
                <div className="bg-red-500 h-full" style={{ width: `${(riscosCriticos / analises.length) * 100}%` }} />
                <div className="bg-amber-400 h-full" style={{ width: `${(riscosAltos / analises.length) * 100}%` }} />
                <div className="bg-yellow-300 h-full" style={{ width: `${(riscosMedios / analises.length) * 100}%` }} />
                <div className="bg-green-400 h-full" style={{ width: `${(riscosBaixos / analises.length) * 100}%` }} />
              </div>
            )}
            <span className="text-[10px] opacity-60">{scoreMedioDesc}</span>
          </div>
        </div>

        {/* ─── FILTROS + BUSCA ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-4">
          {/* Linha 1: título + search */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Suas Auditorias</h2>
              <p className="text-gray-500 text-sm">
                {analisesFiltradas.length} registro(s){analisesFiltradas.length > 0 && ` — pág. ${paginaAtual}/${totalPaginas}`}
              </p>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por propriedade..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
          </div>

          {/* Linha 2: chips de risco */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Risco:</span>
            {[
              { value: '', label: 'Todos', count: analises.length, base: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200', active: 'bg-gray-800 text-white border-gray-800' },
              { value: 'critico', label: 'Crítico', count: riscosCriticos, base: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100', active: 'bg-red-600 text-white border-red-600' },
              { value: 'alto', label: 'Alto', count: riscosAltos, base: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', active: 'bg-amber-500 text-white border-amber-500' },
              { value: 'medio', label: 'Médio', count: riscosMedios, base: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100', active: 'bg-yellow-500 text-white border-yellow-500' },
              { value: 'baixo', label: 'Baixo', count: riscosBaixos, base: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100', active: 'bg-green-600 text-white border-green-600' },
            ].map(chip => (
              <button
                key={chip.value}
                onClick={() => { setRiskFilter(chip.value); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${riskFilter === chip.value ? chip.active : chip.base}`}
              >
                {chip.label}
                <span className={`text-[10px] font-black px-1 py-0.5 rounded-full min-w-[18px] text-center ${riskFilter === chip.value ? 'bg-white/25' : 'bg-black/8'}`}>
                  {chip.count}
                </span>
              </button>
            ))}
          </div>

          {/* Linha 3: chips de status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status:</span>
            {[
              { value: '', label: 'Todos' },
              { value: 'completed', label: '✓ Concluído' },
              { value: 'processing', label: '⏳ Analisando' },
              { value: 'pending', label: '⏸ Pendente' },
              { value: 'error', label: '✗ Falha' },
            ].map(chip => (
              <button
                key={chip.value}
                onClick={() => { setStatusFilter(chip.value); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${statusFilter === chip.value ? 'bg-brand-green text-white border-brand-green' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── AÇÃO RECOMENDADA — inline compacta (ISF v2) ────────────────── */}
        {analises.length > 0 && (
          <div className={`mb-4 px-4 py-3 rounded-xl border-l-4 flex items-center justify-between gap-4 text-sm ${
            riscosCriticos > 0 ? 'bg-red-50 border-red-500 text-red-800' :
            riscosAltos > 0 ? 'bg-amber-50 border-amber-500 text-amber-800' :
            riscosMedios > 0 ? 'bg-yellow-50 border-yellow-400 text-yellow-800' :
            'bg-green-50 border-green-500 text-green-800'
          }`}>
            <span className="font-medium">
              {riscosCriticos > 0 ? '🔴 Atenção: análises críticas exigem atuação imediata.'
                : riscosAltos > 0 ? '🟠 Análises de alto risco merecem atenção prioritária.'
                : riscosMedios > 0 ? '🟡 Existem pontos de atenção relevantes na carteira.'
                : '🟢 Carteira com boa segurança fundiária.'}
            </span>
            {riscosCriticos > 0 && (
              <button onClick={() => { setRiskFilter('critico'); setCurrentPage(1); document.getElementById('tabela-auditorias')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="whitespace-nowrap text-xs font-bold underline hover:no-underline flex-shrink-0">
                Ver críticos →
              </button>
            )}
          </div>
        )}


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
                  
                  // Score individual — fonte primária: ISF v2, fallback: legado
                  const isfV2ForScore = getISFV2FromFindings(analise.findings);
                  const scoreData = calcularScoreAgroLex(analise.findings, analise.risk_level, isfV2ForScore.isf_score);

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
                          <div className="flex items-center gap-2">
                            <button
                              disabled={loadingAnalysisId !== null}
                              onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '', { retryMessage: 'Processando auditoria...' })}
                              className="bg-brand-green text-white px-3 py-1 rounded text-xs font-bold hover:brightness-110 transition-all shadow disabled:opacity-50"
                            >
                              {loadingAnalysisId === analise.id ? 'Auditando...' : 'Iniciar Parecer'}
                            </button>
                            <button
                              onClick={() => handleDeleteAnalysis(analise.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="Excluir Auditoria Pendente"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
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
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                disabled={loadingAnalysisId !== null}
                                onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '', { retryMessage: getRetryMessage(analise) })}
                                className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:brightness-110 transition-all shadow disabled:opacity-50"
                              >
                                {loadingAnalysisId === analise.id ? 'Reprocessando...' : 'Tentar novamente'}
                              </button>
                              <button
                                onClick={() => handleDeleteAnalysis(analise.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                title="Excluir Análise"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )
                        ) : statusType === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePayNow(analise.id)}
                              className="bg-brand-gold text-brand-green px-4 py-2 rounded text-xs font-bold hover:brightness-110 transition-all shadow"
                            >
                              Processar Pendência →
                            </button>
                            <button
                              onClick={() => handleDeleteAnalysis(analise.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="Excluir Auditoria Pendente"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
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