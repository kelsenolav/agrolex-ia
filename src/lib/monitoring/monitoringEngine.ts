export type AlertType =
  | 'isf_degradation'
  | 'isf_critical'
  | 'analysis_outdated'
  | 'no_analysis'
  | 'ccir_outdated'
  | 'critical_finding_unresolved'
  | 'onus_detected'
  | 'document_expiry';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface MonitoringAlert {
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export interface PropertyCheckResult {
  propertyId: string;
  propertyName: string;
  latestAnalysisId: string | null;
  latestIsfScore: number | null;
  latestAnalysisAt: string | null;
  overallStatus: 'seguro' | 'atencao' | 'critico' | 'sem_analise';
  alerts: MonitoringAlert[];
}

interface AnalysisRow {
  id: string;
  status: string;
  completed_at?: string | null;
  isf_score?: number | null;
  findings?: any;
  created_at: string;
}

export function runPropertyCheck(
  property: { id: string; name: string; city?: string | null; state?: string | null },
  analyses: AnalysisRow[],
  previousIsfScore: number | null
): PropertyCheckResult {
  const alerts: MonitoringAlert[] = [];
  const now = new Date();

  const completedAnalyses = analyses
    .filter(a => a.status === 'completed' && a.isf_score != null)
    .sort((a, b) =>
      new Date(b.completed_at || b.created_at).getTime() -
      new Date(a.completed_at || a.created_at).getTime()
    );

  const latest = completedAnalyses[0] ?? null;

  if (!latest) {
    alerts.push({
      alert_type: 'no_analysis',
      severity: 'info',
      title: 'Propriedade sem análise fundiária',
      description: `"${property.name}" não possui análise fundiária concluída. O monitoramento de riscos está inativo — recomenda-se realizar a primeira auditoria.`,
      metadata: { property_name: property.name },
    });
    return {
      propertyId: property.id,
      propertyName: property.name,
      latestAnalysisId: null,
      latestIsfScore: null,
      latestAnalysisAt: null,
      overallStatus: 'sem_analise',
      alerts,
    };
  }

  const analysisDate = new Date(latest.completed_at || latest.created_at);
  const daysSinceAnalysis = Math.floor(
    (now.getTime() - analysisDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isfScore = latest.isf_score as number;
  const findings = latest.findings || {};

  // [1] Análise desatualizada
  if (daysSinceAnalysis > 180) {
    alerts.push({
      alert_type: 'analysis_outdated',
      severity: 'critical',
      title: `Análise desatualizada — ${daysSinceAnalysis} dias sem verificação`,
      description: `A última análise de "${property.name}" tem ${daysSinceAnalysis} dias. Certidões de inteiro teor têm validade de 30 dias para atos registrais. Ônus, penhoras ou averbações registradas após esta data não estão sendo monitorados. Atualização imediata recomendada.`,
      metadata: { days_since_analysis: daysSinceAnalysis, analysis_date: latest.completed_at },
    });
  } else if (daysSinceAnalysis > 90) {
    alerts.push({
      alert_type: 'analysis_outdated',
      severity: 'warning',
      title: `Análise com ${daysSinceAnalysis} dias — renovação recomendada`,
      description: `A análise de "${property.name}" foi concluída há ${daysSinceAnalysis} dias. Recomenda-se nova verificação com certidão de inteiro teor atualizada para garantir ausência de novos gravames.`,
      metadata: { days_since_analysis: daysSinceAnalysis },
    });
  }

  // [2] ISF em faixa crítica
  if (isfScore < 40) {
    alerts.push({
      alert_type: 'isf_critical',
      severity: 'critical',
      title: `ISF Crítico: ${isfScore}/100 — risco jurídico elevado`,
      description: `O Índice de Segurança Fundiária de "${property.name}" está em faixa CRÍTICA (${isfScore}/100). Propriedades nesta faixa apresentam risco concreto de bloqueio judicial, litígio dominial ou perda parcial de domínio. Ação imediata recomendada.`,
      metadata: { isf_score: isfScore },
    });
  } else if (isfScore < 55) {
    alerts.push({
      alert_type: 'isf_critical',
      severity: 'warning',
      title: `ISF em faixa de atenção: ${isfScore}/100`,
      description: `O ISF de "${property.name}" está em ${isfScore}/100 — faixa ATENÇÃO. Existem achados que exigem acompanhamento ativo para evitar agravamento da situação fundiária.`,
      metadata: { isf_score: isfScore },
    });
  }

  // [3] ISF em queda vs varredura anterior
  if (previousIsfScore !== null && isfScore < previousIsfScore - 12) {
    const drop = previousIsfScore - isfScore;
    alerts.push({
      alert_type: 'isf_degradation',
      severity: 'critical',
      title: `ISF recuou ${drop} pontos desde a última varredura`,
      description: `O índice de segurança de "${property.name}" regrediu de ${previousIsfScore} para ${isfScore} pontos — queda de ${drop} pontos. Novos achados críticos foram identificados ou achados existentes se agravaram. Análise complementar recomendada com urgência.`,
      metadata: { previous_score: previousIsfScore, current_score: isfScore, drop },
    });
  }

  // [4] Achados críticos sem resolução
  const problemas: any[] = findings.problemas || findings.achados || [];
  const criticos = problemas.filter((p: any) => {
    const crit = (p.criticidade || '').toLowerCase().replace(/[.!?,;]+$/, '');
    return crit === 'crítico' || crit === 'critico';
  });

  if (criticos.length > 0) {
    const titulos = criticos.slice(0, 2).map((p: any) => p.titulo).filter(Boolean).join('; ');
    const mais = criticos.length > 2 ? ` e mais ${criticos.length - 2}` : '';
    alerts.push({
      alert_type: 'critical_finding_unresolved',
      severity: 'critical',
      title: `${criticos.length} achado${criticos.length > 1 ? 's' : ''} crítico${criticos.length > 1 ? 's' : ''} sem resolução documentada`,
      description: `"${property.name}" possui ${criticos.length} achado${criticos.length > 1 ? 's' : ''} de criticidade máxima: ${titulos}${mais}. Enquanto não houver registro de providências tomadas, o risco permanece ativo.`,
      metadata: { count: criticos.length, titles: criticos.map((p: any) => p.titulo) },
    });
  }

  // [5] Ônus detectados no parecer
  const resumo = (findings.resumo || '').toLowerCase();
  const onusKeywords = [
    'hipoteca', 'penhora', 'indisponibilidade', 'alienação fiduciária',
    'bloqueio judicial', 'arresto', 'sequestro de imóvel', 'cédula rural',
  ];
  const onusDetected = onusKeywords.filter(k => resumo.includes(k));

  if (onusDetected.length > 0) {
    alerts.push({
      alert_type: 'onus_detected',
      severity: 'warning',
      title: `Gravame${onusDetected.length > 1 ? 's' : ''} registral${onusDetected.length > 1 ? 'is' : ''} identificado${onusDetected.length > 1 ? 's' : ''}: ${onusDetected.slice(0, 2).join(', ')}`,
      description: `A análise de "${property.name}" identificou ${onusDetected.join(', ')} no registro. Esses gravames restringem a disponibilidade do imóvel e podem impedir transmissão, financiamento ou arrendamento. Verifique se foram cancelados na matrícula atualizada.`,
      metadata: { onus_types: onusDetected },
    });
  }

  // [6] CCIR desatualizado
  const currentYear = now.getFullYear();
  const ccirMatch = (findings.resumo || '').match(/ccir.*?(\d{4})/i);
  const ccirJsonYear = (() => {
    try {
      const mi = findings.matricula_individual_json?.dados_cadastrais?.ccir_exercicio;
      if (mi) {
        const m = String(mi).match(/(\d{4})/);
        return m ? parseInt(m[1]) : null;
      }
    } catch (_) {}
    return null;
  })();
  const ccirYear = ccirJsonYear ?? (ccirMatch ? parseInt(ccirMatch[1]) : null);

  if (ccirYear && ccirYear < currentYear - 1) {
    alerts.push({
      alert_type: 'ccir_outdated',
      severity: 'warning',
      title: `CCIR do exercício ${ccirYear} — desatualizado`,
      description: `O CCIR de "${property.name}" identificado na análise é do exercício ${ccirYear}. O CCIR deve ser atualizado para o exercício ${currentYear - 1}/${currentYear}. CCIR desatualizado gera impedimento para financiamentos rurais, emissão de DAP, PRONAF e CAR.`,
      metadata: { ccir_year: ccirYear, current_year: currentYear },
    });
  }

  const hasCritical = alerts.some(a => a.severity === 'critical');
  const hasWarning = alerts.some(a => a.severity === 'warning');

  let overallStatus: PropertyCheckResult['overallStatus'];
  if (hasCritical) overallStatus = 'critico';
  else if (hasWarning) overallStatus = 'atencao';
  else overallStatus = 'seguro';

  return {
    propertyId: property.id,
    propertyName: property.name,
    latestAnalysisId: latest.id,
    latestIsfScore: isfScore,
    latestAnalysisAt: latest.completed_at || latest.created_at,
    overallStatus,
    alerts,
  };
}

export function getStatusConfig(status: PropertyCheckResult['overallStatus']) {
  switch (status) {
    case 'critico':
      return {
        label: 'CRÍTICO',
        color: 'text-red-400',
        bg: 'bg-red-950',
        border: 'border-red-500',
        dot: 'bg-red-500',
        badgeBg: 'bg-red-900/60 text-red-300 border border-red-700',
      };
    case 'atencao':
      return {
        label: 'ATENÇÃO',
        color: 'text-amber-400',
        bg: 'bg-amber-950',
        border: 'border-amber-500',
        dot: 'bg-amber-400',
        badgeBg: 'bg-amber-900/60 text-amber-300 border border-amber-700',
      };
    case 'seguro':
      return {
        label: 'SEGURO',
        color: 'text-emerald-400',
        bg: 'bg-emerald-950',
        border: 'border-emerald-500',
        dot: 'bg-emerald-400',
        badgeBg: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
      };
    default:
      return {
        label: 'SEM ANÁLISE',
        color: 'text-gray-400',
        bg: 'bg-gray-900',
        border: 'border-gray-600',
        dot: 'bg-gray-500',
        badgeBg: 'bg-gray-800 text-gray-400 border border-gray-600',
      };
  }
}

export function getSeverityConfig(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return {
        icon: '🔴',
        color: 'text-red-400',
        bg: 'bg-red-950/50 border border-red-800',
        label: 'Crítico',
        dot: 'bg-red-500 animate-pulse',
      };
    case 'warning':
      return {
        icon: '🟡',
        color: 'text-amber-400',
        bg: 'bg-amber-950/40 border border-amber-800',
        label: 'Atenção',
        dot: 'bg-amber-400',
      };
    default:
      return {
        icon: '🔵',
        color: 'text-blue-400',
        bg: 'bg-blue-950/40 border border-blue-800',
        label: 'Info',
        dot: 'bg-blue-400',
      };
  }
}
