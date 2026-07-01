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
  getISFTaxonomy,
  classifyISFScore,
  normalizeISFLevel,
} from '@/lib/isf/isfTaxonomy';
import type { ISFLevel } from '@/lib/isf/isfTaxonomy';
import { getCommercialAccess, type TrialProfile } from '@/lib/commercial/trial';
import { getPlanPermissions } from '@/lib/commercial/plans';
import { AUDIT_MODULES } from '@/lib/auditModules';

// Rótulo legível do módulo (catálogo oficial + fallback para chaves legadas)
const MODULE_NAME_BY_ID: Record<string, string> = AUDIT_MODULES.reduce((acc, mod) => {
  acc[mod.id] = mod.name;
  return acc;
}, {} as Record<string, string>);

function getModuleDisplayName(moduleId: string): string {
  return MODULE_NAME_BY_ID[moduleId] || moduleId;
}

function getModuleListLabel(moduleIds: string[]): string {
  if (!moduleIds || moduleIds.length === 0) return '';
  return moduleIds.map(getModuleDisplayName).join(', ');
}

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
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

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

  /**
   * Determina o pior (mais crítico) ISF entre a análise-mãe e suas análises
   * complementares concluídas. Cada análise complementar calcula seu ISF de forma
   * isolada (escopado ao módulo específico), então o card-topo da propriedade deve
   * refletir o maior risco real encontrado em qualquer uma delas — nunca esconder
   * um achado mais grave de uma complementar atrás de um score melhor da mãe.
   * Comparação por severidade da taxonomy (maior severidade = mais crítico).
   */
  function getWorstISFAcrossFamily(
    parent: Analysis,
    children: Analysis[]
  ): {
    isf_score: number | null;
    risk_level: string | null;
    risk_label: string | null;
    source: 'parent' | 'child';
    sourceModuleLabel: string | null;
  } {
    const parentISF = getISFV2FromFindings(parent.findings);
    const parentScoreData = calcularScoreAgroLex(parent.findings, parent.risk_level, parentISF.isf_score);
    const parentStatus = normalizeStatus(parent.status || '').type;
    const parentScore = parentStatus === 'completed' ? (parentISF.isf_score ?? parentScoreData.score) : null;
    const parentLevel = (parentISF.risk_level || parent.risk_level || '') as ISFLevel;

    let worst: {
      isf_score: number | null;
      risk_level: string | null;
      risk_label: string | null;
      source: 'parent' | 'child';
      sourceModuleLabel: string | null;
    } = {
      isf_score: parentScore,
      risk_level: parentLevel || null,
      risk_label: parentISF.risk_label || (parentLevel ? getISFLabel(parentLevel) : null),
      source: 'parent',
      sourceModuleLabel: null,
    };
    let worstSeverity = worst.risk_level ? getISFTaxonomy(worst.risk_level).severity : -1;

    for (const child of children) {
      if (normalizeStatus(child.status || '').type !== 'completed') continue;
      const childISF = getISFV2FromFindings(child.findings);
      const childScoreData = calcularScoreAgroLex(child.findings, child.risk_level, childISF.isf_score);
      const childScore = childISF.isf_score ?? childScoreData.score;
      const childLevel = (childISF.risk_level || child.risk_level || '') as ISFLevel;
      if (!childLevel) continue;
      const childSeverity = getISFTaxonomy(childLevel).severity;
      if (childSeverity > worstSeverity) {
        worstSeverity = childSeverity;
        const childModules = Array.isArray((child.findings as any)?.selected_modules)
          ? (child.findings as any).selected_modules
          : [];
        worst = {
          isf_score: childScore,
          risk_level: childLevel,
          risk_label: childISF.risk_label || getISFLabel(childLevel),
          source: 'child',
          sourceModuleLabel: childModules.length > 0 ? getModuleListLabel(childModules) : null,
        };
      }
    }

    return worst;
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

      const moduleIds = recommendModal.modules
        .filter((m) => !(m as any).already_processed && selectedModuleIds.has(m.module_id))
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

  // Mapa de filhas agrupadas por parent_analysis_id
  const childrenByParent = new Map<string, Analysis[]>();
  const childIds = new Set<string>();
  for (const a of analises) {
    const parentId = (a.findings as any)?.parent_analysis_id;
    if (parentId) {
      childIds.add(a.id);
      const list = childrenByParent.get(parentId) || [];
      list.push(a);
      childrenByParent.set(parentId, list);
    }
  }

  const analisesPai = analises.filter(a => !childIds.has(a.id));

  // --- Métricas Executivas (apenas análises-pai) ---
  const analisesConcluidas = analisesPai.filter(a => a.status === 'completed').length;
  const analisesEmAndamento = analisesPai.filter(a => a.status === 'processing' || a.status === 'pending' || a.status === 'payment_pending' || a.status === 'ready_for_processing').length;
  const riscosAltos = analisesPai.filter(a => getAnalysisRiskLevel(a) === 'alto_risco').length;
  const riscosCriticos = analisesPai.filter(a => getAnalysisRiskLevel(a) === 'critico').length;
  const riscosMedios = analisesPai.filter(a => getAnalysisRiskLevel(a) === 'atencao').length;
  const riscosBaixos = analisesPai.filter(a => getAnalysisRiskLevel(a) === 'seguro' || getAnalysisRiskLevel(a) === 'muito_seguro').length;
  const semRisco = analisesPai.filter(a => getAnalysisRiskLevel(a) === 'desconhecido').length;
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
    if (childIds.has(a.id)) return false;
    const matchSearch = !searchTerm ||
      a.properties?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.properties?.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchRisk = !riskFilter || (
      getAnalysisRiskLevel(a) === (RISK_FILTER_MAP[riskFilter] || riskFilter.toLowerCase())
    );
    return matchSearch && matchStatus && matchRisk;
  });

  // P1B — Score médio do portfólio usando ISF v2 (apenas análises-pai)
  const scoresISFV2 = analisesPai
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
            <Link href="/dashboard/radar" className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Radar
            </Link>
            <Link href="/dashboard/credito-rural" className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Crédito Rural
            </Link>
            <Link href="/dashboard/cofre" className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <span className="w-2 h-2 rounded-full bg-purple-300" />
              Data Room
            </Link>
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
                  <span className={`text-xs font-normal ${dynamicBalance < 0 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
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
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Análises</span>
              <ShieldCheck size={15} className="text-brand-green" />
            </div>
            <p className="text-2xl font-black text-gray-800">{analisesConcluidas}</p>
            <span className="text-xs">
              {analisesEmAndamento > 0
                ? <span className="text-amber-500 font-bold">{analisesEmAndamento} em andamento</span>
                : <span className="text-gray-500">Todas concluídas</span>}
            </span>
          </div>

          {/* Card 2 — Riscos */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Riscos</span>
              <AlertTriangle size={15} className={totalRiscos > 0 ? 'text-red-500' : 'text-green-500'} />
            </div>
            <p className="text-2xl font-black text-gray-800">{totalRiscos}</p>
            <div className="flex gap-1.5 flex-wrap">
              {riscosCriticos > 0 && <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{riscosCriticos} crítico</span>}
              {riscosAltos > 0 && <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{riscosAltos} alto</span>}
              {riscosCriticos === 0 && riscosAltos === 0 && <span className="text-xs text-green-600">Sem riscos críticos</span>}
            </div>
          </div>

          {/* Card 3 — Saldo */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Saldo</span>
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
            <Link href="/dashboard/planos" className="text-xs text-brand-gold hover:underline font-bold">
              {planType === 'internal_test' ? 'INTERNO' : planType.toUpperCase()} · Comprar páginas →
            </Link>
          </div>

          {/* Card 4 — ISF Médio + distribuição */}
          <div className={`p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1.5 ${scoreMedioBgTint}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">ISF Médio</span>
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
            <span className="text-xs opacity-70">{scoreMedioDesc}</span>
          </div>
        </div>

        {/* ─── BANNER RADAR ────────────────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#0d1117] to-[#0a1a12] border border-emerald-700/60 overflow-hidden shadow-md">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🛡️</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Radar Fundiário</span>
                </div>
                <p className="text-white text-base font-bold leading-snug">Sua propriedade pode ter um alerta agora mesmo</p>
                <p className="text-gray-300 text-sm mt-0.5">Gravames novos, queda de ISF, certidões vencidas — detectamos antes que vire problema.</p>
              </div>
            </div>
            <Link
              href="/dashboard/radar"
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/50 text-sm whitespace-nowrap flex-shrink-0"
            >
              Verificar minhas propriedades →
            </Link>
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
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Risco:</span>
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
                <span className={`text-xs font-black px-1 py-0.5 rounded-full min-w-[18px] text-center ${riskFilter === chip.value ? 'bg-white/25' : 'bg-black/8'}`}>
                  {chip.count}
                </span>
              </button>
            ))}
          </div>

          {/* Linha 3: chips de status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Status:</span>
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


        {/* ─── CARDS DE AUDITORIAS ─────────────────────────────────────────── */}
        <div id="tabela-auditorias" className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
              <div className="animate-pulse text-4xl mb-3">⏳</div>
              <p className="font-medium">Carregando seus dados...</p>
            </div>
          ) : analisesFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100 space-y-3">
              <div className="text-4xl">📂</div>
              <p className="font-semibold text-gray-700">
                {searchTerm || statusFilter || riskFilter
                  ? 'Nenhuma auditoria com os filtros aplicados.'
                  : 'Nenhuma auditoria ainda.'}
              </p>
              {!searchTerm && !statusFilter && !riskFilter && (
                <Link href="/dashboard/nova-analise" className="inline-flex items-center gap-2 bg-brand-gold text-brand-green px-5 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all shadow mt-2">
                  <Plus size={16} /> Iniciar primeira auditoria
                </Link>
              )}
            </div>
          ) : (
            analisesPaginadas.map((analise) => {
              const { text: statusText, colorClass: statusColorClass, type: statusType } = normalizeStatus(analise.status || '');
              const hasParecer = analise.findings && analise.findings.resumo && String(analise.findings.resumo).trim().length > 0;
              const canRetryAnalysis = statusType === 'error' && isRecoverableAnalysisError(analise);
              const analysisDepth = (analise.findings as any)?.analysis_depth ?? 1;
              const depthLabel = analysisDepth === 1 ? null : analysisDepth === 2 ? 'Complementar 1' : `Complementar ${analysisDepth - 1}`;
              const recommended = getRecommendedModules(analise);
              const complementaryChildren = (analise.findings as any)?.complementary_children as Array<{ child_analysis_id: string; created_at: string; modules: string[]; total: number }> | undefined;

              const findingsAny = analise.findings as any;
              const isComplementarJaProcessado =
                findingsAny.parent_analysis_id != null &&
                Array.isArray(findingsAny.selected_modules) &&
                findingsAny.selected_modules.length > 0 &&
                findingsAny.selected_modules.every(
                  (modId: string) => findingsAny.case_file?.module_results?.[modId]?.status === 'completed'
                );

              const isfV2ForScore = getISFV2FromFindings(analise.findings);
              const scoreData = calcularScoreAgroLex(analise.findings, analise.risk_level, isfV2ForScore.isf_score);
              const isfV2 = getISFV2FromFindings(analise.findings);
              const ownDisplayScore = statusType === 'completed' ? (isfV2.isf_score !== null ? isfV2.isf_score : scoreData.score) : null;
              const ownDisplayLevel = (isfV2.risk_level || analise.risk_level || '') as ISFLevel;

              // O card-topo deve refletir o PIOR risco entre a mãe e suas complementares
              // concluídas — uma complementar pode achar algo mais grave que a mãe.
              const familyWorst = statusType === 'completed'
                ? getWorstISFAcrossFamily(analise, childrenByParent.get(analise.id) || [])
                : null;
              const worstIsFromChild = familyWorst?.source === 'child';

              const displayScore = statusType === 'completed' ? (familyWorst?.isf_score ?? ownDisplayScore) : null;
              const displayLevel = (familyWorst?.risk_level || ownDisplayLevel || '') as ISFLevel;
              const riskLabel = familyWorst?.risk_label || (displayLevel ? getISFLabel(displayLevel) : '') || analise.risk_level || '';
              const worstSourceModuleLabel = worstIsFromChild ? familyWorst?.sourceModuleLabel : null;

              // Cor da borda-esquerda do card por criticidade / status
              const cardBorderLeft =
                statusType === 'processing' ? 'border-l-blue-400' :
                statusType === 'error' ? 'border-l-red-400' :
                statusType === 'pending' ? 'border-l-amber-400' :
                displayLevel ? (normalizeISFLevel(displayLevel) === 'critico' ? 'border-l-red-500' :
                  normalizeISFLevel(displayLevel) === 'alto_risco' ? 'border-l-amber-500' :
                  normalizeISFLevel(displayLevel) === 'atencao' ? 'border-l-yellow-400' : 'border-l-green-400')
                : 'border-l-gray-200';

              return (
                <div key={analise.id} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${cardBorderLeft} shadow-sm hover:shadow-md transition-all`}>
                  <div className="flex items-start gap-4 p-4">

                    {/* ── Âncora visual: ISF Score ── */}
                    <div className={`flex-shrink-0 w-[68px] h-[68px] rounded-xl flex flex-col items-center justify-center border ${
                      displayScore !== null ? getISFBgTint(displayLevel) + ' border-transparent' : 'bg-gray-50 border-gray-200'
                    }`}>
                      {displayScore !== null ? (
                        <>
                          <span className={`text-2xl font-black leading-none ${getISFTextTint(displayLevel)}`}>{displayScore}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-tight leading-none mt-0.5 text-center ${getISFTextTint(displayLevel)} opacity-70`}>
                            {getISFLabel(displayLevel) || 'ISF'}
                          </span>
                        </>
                      ) : statusType === 'processing' ? (
                        <span className="animate-pulse text-blue-400 text-2xl">⏳</span>
                      ) : (
                        <span className="text-gray-300 text-2xl">—</span>
                      )}
                    </div>

                    {/* ── Informações principais ── */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">

                        {/* Nome + localização + tipo */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2">{analise.properties?.name}</h3>
                            {depthLabel && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                                {depthLabel}
                              </span>
                            )}
                            {childrenByParent.has(analise.id) && (
                              <button
                                onClick={() => setExpandedParents(prev => {
                                  const next = new Set(prev);
                                  if (next.has(analise.id)) next.delete(analise.id); else next.add(analise.id);
                                  return next;
                                })}
                                className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                              >
                                {expandedParents.has(analise.id) ? '▾' : '▸'} {childrenByParent.get(analise.id)!.length} complementar{childrenByParent.get(analise.id)!.length > 1 ? 'es' : ''}
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin size={12} className="text-brand-green flex-shrink-0" />
                            {analise.properties?.city}, {analise.properties?.state}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <FileText size={11} className="text-brand-gold flex-shrink-0" />
                            {analise.documents?.[0]?.document_type || 'Documento'}
                          </p>
                        </div>

                        {/* Status + Ações */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColorClass}`}>
                            {statusText}
                          </span>

                          {statusType === 'completed' && hasParecer && (
                            <Link
                              href={`/dashboard/resultado?id=${analise.id}`}
                              className="inline-flex items-center gap-1.5 bg-brand-green text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-sm"
                            >
                              Abrir Parecer <ArrowUpRight size={14} />
                            </Link>
                          )}
                          {statusType === 'completed' && !hasParecer && (
                            <span className="text-red-500 text-xs font-semibold">Anomalia: parecer ausente</span>
                          )}
                          {statusType === 'processing' && (
                            <span className="text-sm text-gray-400 flex items-center gap-1.5">
                              <span className="animate-pulse w-2 h-2 bg-blue-500 rounded-full" /> Processando...
                            </span>
                          )}
                          {statusType === 'ready_for_processing' && isComplementarJaProcessado && (
                            <Link href={`/dashboard/resultado?id=${findingsAny.parent_analysis_id}`} className="inline-flex items-center gap-1.5 bg-brand-green text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-sm">
                              Abrir Parecer <ArrowUpRight size={14} />
                            </Link>
                          )}
                          {statusType === 'ready_for_processing' && !isComplementarJaProcessado && (
                            <div className="flex items-center gap-2">
                              <button
                                disabled={loadingAnalysisId !== null}
                                onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '', { retryMessage: 'Processando auditoria...' })}
                                className="bg-brand-green text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow disabled:opacity-50"
                              >
                                {loadingAnalysisId === analise.id ? 'Auditando...' : 'Iniciar Parecer'}
                              </button>
                              <button onClick={() => handleDeleteAnalysis(analise.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Excluir">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                          {statusType === 'error' && analise.findings?.retry_exhausted !== true && (
                            <div className="flex items-center gap-2">
                              <button
                                disabled={loadingAnalysisId !== null}
                                onClick={() => handleStartAnalysis(analise.id, analise.properties?.id ?? '', { retryMessage: getRetryMessage(analise) })}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow disabled:opacity-50"
                              >
                                {loadingAnalysisId === analise.id ? 'Reprocessando...' : 'Tentar novamente'}
                              </button>
                              <button onClick={() => handleDeleteAnalysis(analise.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Excluir">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                          {statusType === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handlePayNow(analise.id)}
                                className="bg-brand-gold text-brand-green px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow"
                              >
                                Processar Pendência →
                              </button>
                              <button onClick={() => handleDeleteAnalysis(analise.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Excluir">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Linha inferior: risco + módulos sugeridos + retry_exhausted ── */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {riskLabel && statusType === 'completed' && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getISFStyle(riskLabel)}`}>
                            {riskLabel}
                          </span>
                        )}
                        {worstIsFromChild && statusType === 'completed' && (
                          <span className="text-xs text-gray-500 italic">
                            conforme análise complementar{worstSourceModuleLabel ? `: ${worstSourceModuleLabel}` : ''}
                          </span>
                        )}
                        {recommended.length > 0 && statusType === 'completed' && (
                          <button
                            onClick={() => {
                              const mods = recommended;
                              setSelectedModuleIds(new Set(mods.filter((m: any) => !m.already_processed).map((m: any) => m.module_id)));
                              setRecommendModal({ analysisId: analise.id, propertyName: analise.properties?.name || 'Propriedade', modules: mods });
                            }}
                            className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors"
                          >
                            + {recommended.length} módulo{recommended.length > 1 ? 's' : ''} sugerido{recommended.length > 1 ? 's' : ''}
                          </button>
                        )}
                        {statusType === 'error' && analise.findings?.retry_exhausted === true && (
                          <div className="w-full mt-1 space-y-1.5">
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                              ⚠ Exige processamento em etapas
                            </span>
                            <div className="flex flex-col gap-1 pl-1">
                              {[
                                { id: 'matricula_individual', name: 'Análise de Matrícula Individual', price: 99.90 },
                                { id: 'cadeia_dominial', name: 'Cadeia Dominial Registral', price: 199.90 },
                                { id: 'origem_publica', name: 'Auditoria de Origem Pública', price: 199.90 },
                                { id: 'nulidades_fraudes', name: 'Mapeamento de Nulidades e Fraudes', price: 249.90 },
                              ].map((etapa) => {
                                const selectedModules = findingsAny?.selected_modules || [];
                                const alreadyHasModule = selectedModules.includes(etapa.id);
                                return (
                                  <div key={etapa.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-1.5 max-w-md">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${alreadyHasModule ? 'bg-green-500' : 'bg-amber-400'}`} />
                                      <span className={`text-xs leading-tight ${alreadyHasModule ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{etapa.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                      {alreadyHasModule ? (
                                        <span className="text-xs text-green-600 font-bold uppercase">Contratado</span>
                                      ) : (
                                        <>
                                          <span className="text-xs font-bold text-brand-green">R$ {etapa.price.toFixed(2)}</span>
                                          <button
                                            onClick={() => {
                                              setSelectedModuleIds(new Set([etapa.id]));
                                              setRecommendModal({ analysisId: analise.id, propertyName: analise.properties?.name || 'Propriedade', modules: [{ module_id: etapa.id, title: etapa.name, price: etapa.price }] });
                                            }}
                                            className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold hover:brightness-110"
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
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Sub-análises complementares (agrupadas) ── */}
                  {expandedParents.has(analise.id) && childrenByParent.has(analise.id) && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-4 pb-3 pt-2 space-y-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Análises complementares</span>
                      {childrenByParent.get(analise.id)!.map((child) => {
                        const childFindings = child.findings as any;
                        const childISF = getISFV2FromFindings(child.findings);
                        const childScore = child.status === 'completed' ? (childISF.isf_score ?? calcularScoreAgroLex(child.findings, child.risk_level, childISF.isf_score).score) : null;
                        const childLevel = (childISF.risk_level || child.risk_level || '') as ISFLevel;
                        const childStatus = normalizeStatus(child.status || '');
                        const childHasParecer = child.findings && child.findings.resumo && String(child.findings.resumo).trim().length > 0;
                        const childModules = Array.isArray(childFindings?.selected_modules) ? childFindings.selected_modules : [];
                        const childDepth = childFindings?.analysis_depth ?? 2;
                        return (
                          <div key={child.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2">
                            {/* Mini ISF badge */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                              childScore !== null ? getISFBgTint(childLevel) : 'bg-gray-100'
                            }`}>
                              {childScore !== null ? (
                                <>
                                  <span className={`text-sm font-black leading-none ${getISFTextTint(childLevel)}`}>{childScore}</span>
                                  <span className={`text-[7px] font-bold uppercase leading-none ${getISFTextTint(childLevel)} opacity-60`}>ISF</span>
                                </>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-800">
                                  Complementar {childDepth - 1}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${childStatus.colorClass}`}>
                                  {childStatus.text}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {childModules.map((m: string) => {
                                  const modName: Record<string, string> = {
                                    matricula_individual: 'Matrícula Individual',
                                    cadeia_dominial: 'Cadeia Dominial',
                                    cruzamento_matriculas: 'Cruzamento de Matrículas',
                                    origem_publica: 'Origem Pública',
                                    geoespacial: 'Geoespacial',
                                    nulidades_fraudes: 'Nulidades e Fraudes',
                                    cruzamento_total: 'Cruzamento Total',
                                  };
                                  return modName[m] || m;
                                }).join(', ')}
                              </p>
                              {childStatus.type === 'completed' && childScore !== null && (
                                <p className="text-[11px] text-gray-400 italic mt-0.5 leading-snug">
                                  ISF desta análise (módulo: {childModules.length > 0 ? getModuleListLabel(childModules) : 'complementar'}) — não substitui o risco geral da matrícula.
                                </p>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex-shrink-0">
                              {childStatus.type === 'completed' && childHasParecer && (
                                <Link
                                  href={`/dashboard/resultado?id=${child.id}`}
                                  className="inline-flex items-center gap-1 bg-brand-green text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all"
                                >
                                  Parecer <ArrowUpRight size={12} />
                                </Link>
                              )}
                              {childStatus.type === 'ready_for_processing' && (
                                <button
                                  disabled={loadingAnalysisId !== null}
                                  onClick={() => handleStartAnalysis(child.id, child.properties?.id ?? '', { retryMessage: 'Processando...' })}
                                  className="bg-brand-green text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                                >
                                  {loadingAnalysisId === child.id ? 'Auditando...' : 'Iniciar'}
                                </button>
                              )}
                              {childStatus.type === 'processing' && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <span className="animate-pulse w-1.5 h-1.5 bg-blue-500 rounded-full" /> Processando
                                </span>
                              )}
                              {childStatus.type === 'error' && (
                                <button
                                  disabled={loadingAnalysisId !== null}
                                  onClick={() => handleStartAnalysis(child.id, child.properties?.id ?? '', { retryMessage: 'Reprocessando...' })}
                                  className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                                >
                                  Tentar novamente
                                </button>
                              )}
                              {childStatus.type === 'pending' && (
                                <button
                                  onClick={() => handlePayNow(child.id)}
                                  className="bg-brand-gold text-brand-green px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all"
                                >
                                  Processar →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
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
                const isSelected = selectedModuleIds.has(mod.module_id);
                return (
                  <label
                    key={mod.module_id}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 border cursor-pointer transition-colors ${
                      isProcessed
                        ? 'bg-green-50 border-green-200 opacity-70 cursor-default'
                        : isSelected
                          ? 'bg-brand-green/5 border-brand-green/30'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {!isProcessed ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedModuleIds(prev => {
                              const next = new Set(prev);
                              if (next.has(mod.module_id)) next.delete(mod.module_id);
                              else next.add(mod.module_id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-brand-green focus:ring-brand-green accent-green-600"
                        />
                      ) : (
                        <span className="w-4 h-4 flex items-center justify-center text-green-500">✓</span>
                      )}
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
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase bg-green-200 text-green-800 border border-green-300">
                          Já processado
                        </span>
                      )}
                    </div>
                    {mod.price != null && !isProcessed && (
                      <span className={`text-sm font-bold ${isSelected ? 'text-brand-green' : 'text-gray-400'}`}>
                        R$ {mod.price.toFixed(2)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-between bg-amber-50 rounded-lg px-4 py-3 border border-amber-200 mb-6">
              <span className="text-sm font-semibold text-amber-800">Valor total estimado</span>
              <span className="text-lg font-bold text-amber-800">
                R$ {recommendModal.modules.filter(m => selectedModuleIds.has(m.module_id) && !(m as any).already_processed).reduce((sum, m) => sum + (m.price || 0), 0).toFixed(2)}
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
                disabled={acceptingModules || selectedModuleIds.size === 0}
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