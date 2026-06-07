/**
 * getAnalysisRiskLevel — Helper único para extrair o nível de risco de uma análise.
 *
 * Fonte primária: findings.isf_v2
 * Fallback: analyses.risk_level (legado)
 * Fallback final: "desconhecido"
 *
 * Uso: getAnalysisRiskLevel(analysis)
 * Retorno: string normalizada (sem acentos, caixa baixa, sem espaços extras)
 *   Exemplos: "critico", "alto_risco", "atencao", "seguro", "muito_seguro", "desconhecido"
 *
 * Versão: 1.0
 * P1C — Unificação Final dos Filtros, KPIs e Analytics no ISF v2
 */

export function getAnalysisRiskLevel(analysis: {
  findings?: any;
  risk_level?: string | null;
}): string {
  // 1. Tentar ISF v2 dos findings
  const findings = analysis.findings;
  if (findings) {
    const isfV2 = findings.isf_v2 as Record<string, unknown> | undefined;
    if (isfV2 && typeof isfV2.risk_level === 'string') {
      const normalized = isfV2.risk_level
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      if (normalized) return normalized;
    }
  }

  // 2. Fallback: analyses.risk_level (legado)
  if (analysis.risk_level) {
    const fallback = analysis.risk_level
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (fallback) {
      // Mapeamento de aliases legados para o formato ISF v2
      const aliasMap: Record<string, string> = {
        'alto': 'alto_risco',
        'medio': 'atencao',
        'médio': 'atencao',
        'baixo': 'seguro',
        'muito baixo': 'muito_seguro',
      };
      return aliasMap[fallback] || fallback;
    }
  }

  // 3. Fallback final
  return 'desconhecido';
}

/**
 * Verifica se o risco de uma análise se enquadra em uma categoria específica.
 * Exemplo: matchRiskLevel(analysis, 'critico') => true se for crítico
 */
export function matchRiskLevel(
  analysis: {
    findings?: any;
    risk_level?: string | null;
  },
  targetLevel: string
): boolean {
  const current = getAnalysisRiskLevel(analysis);
  return current === targetLevel;
}