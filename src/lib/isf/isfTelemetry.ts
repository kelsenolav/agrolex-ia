/**
 * ISF Telemetry — Medição Estatística do ISF v2 em Produção
 *
 * Função pura que analisa um array de análises persistidas e retorna
 * métricas agregadas sobre o comportamento do ISF v2.
 *
 * NÃO recalcula ISF.
 * NÃO altera análises.
 * NÃO chama IA.
 * Funciona apenas com dados já persistidos (findings.isf_v2 e findings.score_comparison).
 *
 * Versão: 1.0
 */

export interface ISFTelemetryResult {
  /** Total de análises com ISF v2 disponível */
  totalAnalyses: number;
  /** Média aritmética do ISF v2 */
  averageISF: number;
  /** Média aritmética do score legado (v1) */
  averageLegacyScore: number;
  /** Diferença média entre ISF v2 e score legado */
  averageDifference: number;
  /** Percentual de cada classificação de risco (3 faixas consolidadas) */
  distribution: {
    seguro: number;   // muito_seguro + seguro
    atencao: number;  // atencao
    critico: number;  // alto_risco + critico
  };
  /** Percentual de cada nível de risco (5 níveis originais) */
  riskLevels: {
    baixo: number;   // muito_seguro
    medio: number;   // seguro
    alto: number;    // alto_risco
    critico: number; // critico
  };
}

interface AnalysisWithFindings {
  findings?: Record<string, unknown> | null;
}

/**
 * Extrai o ISF v2 score de uma análise.
 * Retorna null se a análise não tiver isf_v2 computado.
 */
function extrairISFScore(analysis: AnalysisWithFindings): number | null {
  const f = analysis.findings;
  if (!f) return null;
  const isfV2 = f.isf_v2 as Record<string, unknown> | undefined;
  if (!isfV2 || typeof isfV2.isf_score !== 'number') return null;
  return isfV2.isf_score;
}

/**
 * Extrai o score legado (v1) de uma análise.
 * Retorna null se não houver score_comparison.
 */
function extrairLegacyScore(analysis: AnalysisWithFindings): number | null {
  const f = analysis.findings;
  if (!f) return null;
  const sc = f.score_comparison as Record<string, unknown> | undefined;
  if (!sc || typeof sc.legacy_score !== 'number') return null;
  return sc.legacy_score;
}

/**
 * Extrai os scores para comparação.
 * Retorna { isf, legacy, difference } ou null.
 */
function extrairComparacao(analysis: AnalysisWithFindings): {
  isf: number;
  legacy: number;
  difference: number;
} | null {
  const f = analysis.findings;
  if (!f) return null;
  const sc = f.score_comparison as Record<string, unknown> | undefined;
  if (!sc || typeof sc.isf_score !== 'number' || typeof sc.legacy_score !== 'number') return null;
  return {
    isf: sc.isf_score,
    legacy: sc.legacy_score,
    difference: typeof sc.difference === 'number' ? sc.difference : sc.isf_score - sc.legacy_score,
  };
}

/**
 * Extrai a faixa de risco do ISF v2.
 * Retorna null se não houver isf_v2.
 */
function extrairFaixaRisco(analysis: AnalysisWithFindings): string | null {
  const f = analysis.findings;
  if (!f) return null;
  const isfV2 = f.isf_v2 as Record<string, unknown> | undefined;
  if (!isfV2 || typeof isfV2.risk_level !== 'string') return null;
  return isfV2.risk_level as string;
}

/**
 * Função principal de telemetria.
 *
 * @param analyses - Array de análises com findings persistidos (do Supabase)
 * @returns ISFTelemetryResult com todas as métricas agregadas
 */
export function isfTelemetry(analyses: AnalysisWithFindings[]): ISFTelemetryResult {
  // Filtrar apenas análises com ISF v2 computado
  const comISF = analyses.filter((a) => extrairISFScore(a) !== null);

  const totalAnalyses = comISF.length;

  // Se não há análises com ISF, retornar estrutura vazia
  if (totalAnalyses === 0) {
    return {
      totalAnalyses: 0,
      averageISF: 0,
      averageLegacyScore: 0,
      averageDifference: 0,
      distribution: { seguro: 0, atencao: 0, critico: 0 },
      riskLevels: { baixo: 0, medio: 0, alto: 0, critico: 0 },
    };
  }

  // Média ISF v2
  let somaISF = 0;
  for (const a of comISF) {
    const s = extrairISFScore(a);
    if (s !== null) somaISF += s;
  }
  const averageISF = Math.round(somaISF / totalAnalyses);

  // Média score legado e diferença
  let somaLegado = 0;
  let somaDiferenca = 0;
  let countComparacao = 0;
  for (const a of comISF) {
    const cmp = extrairComparacao(a);
    if (cmp !== null) {
      somaLegado += cmp.legacy;
      somaDiferenca += cmp.difference;
      countComparacao++;
    }
  }
  const averageLegacyScore = countComparacao > 0 ? Math.round(somaLegado / countComparacao) : 0;
  const averageDifference = countComparacao > 0
    ? Math.round((somaDiferenca / countComparacao) * 100) / 100
    : 0;

  // Distribuição por faixa (3 faixas consolidadas)
  let countSeguro = 0;
  let countAtencao = 0;
  let countCritico = 0;

  // Risk levels (5 níveis → 4 consolidados)
  let countBaixo = 0;
  let countMedio = 0;
  let countAlto = 0;
  let countCriticoLevel = 0;

  for (const a of comISF) {
    const faixa = extrairFaixaRisco(a);
    if (!faixa) continue;

    // Distribuição (3 faixas)
    if (faixa === 'muito_seguro' || faixa === 'seguro') {
      countSeguro++;
    } else if (faixa === 'atencao') {
      countAtencao++;
    } else {
      // alto_risco ou critico
      countCritico++;
    }

    // Risk levels (4 níveis)
    if (faixa === 'muito_seguro') {
      countBaixo++;
    } else if (faixa === 'seguro') {
      countMedio++;
    } else if (faixa === 'alto_risco') {
      countAlto++;
    } else if (faixa === 'critico') {
      countCriticoLevel++;
    }
    // 'atencao' não entra nos 4 níveis solicitados (somente baixo/medio/alto/critico)
  }

  const pct = (n: number) => Math.round((n / totalAnalyses) * 100);

  return {
    totalAnalyses,
    averageISF,
    averageLegacyScore,
    averageDifference,
    distribution: {
      seguro: pct(countSeguro),
      atencao: pct(countAtencao),
      critico: pct(countCritico),
    },
    riskLevels: {
      baixo: pct(countBaixo),
      medio: pct(countMedio),
      alto: pct(countAlto),
      critico: pct(countCriticoLevel),
    },
  };
}