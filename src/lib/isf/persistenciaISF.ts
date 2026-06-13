/**
 * ISF v2 — Persistência e Telemetria
 *
 * Persiste o resultado do ISF v2 dentro do JSONB existente (findings).
 * Sem migration. Sem alteração de schema.
 *
 * Estrutura:
 *   findings.isf_v2 = { isf_version, isf_score, registral_score, ... }
 *   findings.score_comparison = { legacy_score, isf_score, difference }
 *
 * Compatibilidade:
 *   - Não remove score atual (findings.isf_v2 convive com findings.resumo, etc.)
 *   - Não altera estrutura existente
 */
import type { ISFResult } from './isfEngine';
import type { ScoreComparison } from './isfV2';

/**
 * Prepara o payload para persistir o ISF v2 dentro do JSONB findings.
 *
 * @param isfResult - Resultado completo do cálculo ISF v2
 * @returns Objeto para ser mesclado ao findings (spread operator)
 */
export function prepararPayloadISF(isfResult: ISFResult): Record<string, unknown> {
  return {
    isf_v2: {
      isf_version: isfResult.isf_version,
      isf_score: isfResult.isf_score,
      registral_score: isfResult.registral_score,
      dominial_score: isfResult.dominial_score,
      litigio_score: isfResult.litigio_score,
      possessorio_score: isfResult.possessorio_score,
      fraude_score: isfResult.fraude_score,
      risk_level: isfResult.risk_level,
      risk_label: isfResult.risk_label,
      risk_color: isfResult.risk_color,
      factors: isfResult.factors,
      eixos: isfResult.eixos,
    },
  };
}

/**
 * Prepara o payload de telemetria de divergência entre score legado e ISF v2.
 *
 * @param comparison - Objeto de comparação entre v1 e v2
 * @returns Objeto para ser mesclado ao findings (spread operator)
 */
export function prepararScoreComparison(
  comparison: ScoreComparison
): Record<string, unknown> {
  return {
    score_comparison: {
      legacy_score: comparison.legacy_score,
      isf_score: comparison.isf_score,
      difference: comparison.difference,
    },
  };
}

/**
 * Função auxiliar que prepara ambos os payloads (ISF v2 + score comparison)
 * para serem mesclados ao findings existente.
 *
 * Uso típico:
 *   const findings = { ...existingFindings, ...gerarPayloadISFCompleto(isfResult, comparison) };
 *
 * @param isfResult - Resultado do cálculo ISF v2
 * @param comparison - Comparação entre v1 e v2
 * @returns Objeto completo para spread no findings
 */
export function gerarPayloadISFCompleto(
  isfResult: ISFResult,
  comparison: ScoreComparison
): Record<string, unknown> {
  return {
    ...prepararPayloadISF(isfResult),
    ...prepararScoreComparison(comparison),
  };
}
