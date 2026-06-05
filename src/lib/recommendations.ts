/**
 * buildRecommendedModules — Fase 2 do Roadmap AgroLex
 *
 * A partir de um `case_file` (resultado da análise) e de um `DocumentProfile`
 * (snapshot dos documentos anexados), sugere módulos complementares da AgroLex
 * que o usuário pode contratar para aprofundar a auditoria fundiária.
 *
 * REGRAS (PLANO_TRABALHO_AGROLEX §A.6.2):
 * 1. Risco crítico detectado → nulidades_fraudes
 * 2. Múltiplas matrículas sem cruzamento → cruzamento_matriculas
 * 3. CAR/SIGEF/Memorial sem geoespacial → geoespacial
 * 4. Origem pública não confirmada → origem_publica
 * 5. Faltam certidões de cadeia/cartório → cadeia_dominial
 *
 * REGRAS DE EXCLUSÃO:
 * - Nunca recomendar módulo já contratado (`selectedModules`)
 * - Nunca recomendar `cruzamento_total` automaticamente (decisão manual)
 * - Não duplicar recomendação para o mesmo `module_id`
 * - Se `cruzamento_total` está nos selecionados, não sugerir módulos individuais
 *
 * IMPORTANTE:
 * - Esta função é PURA. Não toca em banco, nem em Supabase.
 * - Determinística: mesmas entradas → mesma saída (exceto `now` em `evidence`).
 * - Retorna no máximo 5 itens, na ordem de prioridade definida.
 */

import {
  AUDIT_MODULES,
  MODULE_PRICES,
  normalizeModuleId,
  type DocumentProfile,
} from "./auditModules";
import type {
  CaseFile,
  CaseFileRecommendedModule,
} from "./caseFile";

/** Entrada do motor de recomendação. */
export interface BuildRecommendedModulesInput {
  caseFile: CaseFile | null | undefined;
  docProfile: DocumentProfile;
  /** IDs dos módulos já contratados pelo usuário nesta análise. */
  selectedModules: string[];
  /** Timestamp ISO usado em `evidence.collected_at` (opcional, default = now). */
  now?: string;
}

const CADEIA_KEYWORDS_REGEX = /(cadeia|cart[oó]rio|certid[ãa]o\s+de\s+inteiro\s+teor|registro\s+anterior|transmiss[õo]es|hist[oó]rico\s+registral)/i;

function normalizeSeverity(value: unknown): "baixo" | "medio" | "alto" | "critico" | null {
  if (typeof value !== "string") return null;
  const v = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (v.includes("critico")) return "critico";
  if (v.includes("alto")) return "alto";
  if (v.includes("medio") || v.includes("médio")) return "medio";
  if (v.includes("baixo")) return "baixo";
  return null;
}

function hasCriticalRisk(caseFile: CaseFile): boolean {
  const risks = Array.isArray(caseFile.risks) ? caseFile.risks : [];
  return risks.some((r: any) => normalizeSeverity(r?.severity) === "critico");
}

function countCriticalRisks(caseFile: CaseFile): number {
  const risks = Array.isArray(caseFile.risks) ? caseFile.risks : [];
  return risks.filter((r: any) => normalizeSeverity(r?.severity) === "critico").length;
}

function titleOriginIsEmpty(caseFile: CaseFile): boolean {
  const t = caseFile.title_origin;
  if (!t || typeof t !== "object") return true;
  const obj = t as Record<string, unknown>;
  return Object.keys(obj).length === 0;
}

function hasCadeiaGap(caseFile: CaseFile): boolean {
  const missing = Array.isArray(caseFile.missing_documents) ? caseFile.missing_documents : [];
  return missing.some((item: any) => {
    if (typeof item === "string") {
      return CADEIA_KEYWORDS_REGEX.test(item);
    }
    if (item && typeof item === "object") {
      return CADEIA_KEYWORDS_REGEX.test(String(item.description || item.name || ""));
    }
    return false;
  });
}

function getModuleTitle(moduleId: string): string {
  const normId = normalizeModuleId(moduleId);
  const mod = AUDIT_MODULES.find((m) => m.id === normId);
  return mod?.name || moduleId;
}

function getModulePriceSafe(moduleId: string): number {
  const normId = normalizeModuleId(moduleId);
  return MODULE_PRICES[normId] ?? 0;
}

/**
 * Serializa um objeto de evidência em JSON string curto.
 * O tipo `evidence` em CaseFileRecommendedModule é `string | null`,
 * então persistimos um resumo estruturado em JSON para rastreabilidade.
 */
function evidenceToString(evidence: Record<string, unknown>): string {
  try {
    return JSON.stringify(evidence);
  } catch {
    return String(evidence);
  }
}

/**
 * Gera a lista de módulos recomendados para a análise concluída.
 *
 * @param input - caseFile (com risks, missing_documents, title_origin), docProfile e selectedModules.
 * @returns Lista ordenada por prioridade (critica > alta > media > baixa).
 */
export function buildRecommendedModules(
  input: BuildRecommendedModulesInput
): CaseFileRecommendedModule[] {
  const { caseFile, docProfile, selectedModules } = input;
  const now = input.now || new Date().toISOString();

  const cf: CaseFile = caseFile || ({} as CaseFile);

  // Só gerar recomendações se o case_file foi efetivamente processado (status 'completed')
  if (!cf || cf.status !== "completed") {
    return [];
  }

  const alreadySelectedSet = new Set(selectedModules.map((id) => normalizeModuleId(id)));
  const cruzamentoTotalSelected = alreadySelectedSet.has("cruzamento_total");

  // Se contratou cruzamento_total, não sugerir módulos individuais.
  if (cruzamentoTotalSelected) {
    return [];
  }

  const recommendations: CaseFileRecommendedModule[] = [];
  const seen = new Set<string>();

  function push(reco: CaseFileRecommendedModule) {
    if (seen.has(reco.module_id)) return;
    seen.add(reco.module_id);
    recommendations.push(reco);
  }

  // ── Regra 1: Risco crítico → nulidades_fraudes ──
  if (!alreadySelectedSet.has("nulidades_fraudes") && hasCriticalRisk(cf)) {
    const criticalCount = countCriticalRisks(cf);
    push({
      module_id: "nulidades_fraudes",
      title: getModuleTitle("nulidades_fraudes"),
      reason:
        criticalCount > 1
          ? `Análise detectou ${criticalCount} achado(s) crítico(s) que exigem aprofundamento em nulidades e indícios de fraude.`
          : "Análise detectou 1+ achado(s) crítico(s) que exige(m) aprofundamento.",
      evidence: evidenceToString({
        source: "case_file.risks",
        rule: "critical_risk_detected",
        critical_risk_count: criticalCount,
        collected_at: now
      }),
      priority: "critica",
      status: "available",
      required_documents: ["matricula_atualizada", "cadeia_titulos"],
      expected_value:
        "Mapeamento de vícios registrais, simulação, grilagem, fraude documental e pontos de impugnação.",
      price: getModulePriceSafe("nulidades_fraudes")
    });
  }

  // ── Regra 2: Múltiplas matrículas sem cruzamento → cruzamento_matriculas ──
  if (
    !alreadySelectedSet.has("cruzamento_matriculas") &&
    docProfile.hasMultipleMatriculas
  ) {
    push({
      module_id: "cruzamento_matriculas",
      title: getModuleTitle("cruzamento_matriculas"),
      reason: `Você anexou ${docProfile.totalMatriculas} matrículas. Cruzá-las identifica divergências de área, origem comum, matrícula mãe/filha e conflitos.`,
      evidence: evidenceToString({
        source: "document_profile",
        rule: "multiple_matriculas_without_cruzamento",
        total_matriculas: docProfile.totalMatriculas,
        collected_at: now
      }),
      priority: "alta",
      status: "available",
      required_documents: ["matriculas_envolvidas"],
      expected_value:
        "Divergências de área, origem comum, continuidade registral e conflitos entre registros.",
      price: getModulePriceSafe("cruzamento_matriculas")
    });
  }

  // ── Regra 3: CAR/SIGEF/Memorial sem geoespacial → geoespacial ──
  if (
    !alreadySelectedSet.has("geoespacial") &&
    docProfile.hasGeospatialDocument
  ) {
    const tipos: string[] = [];
    if (docProfile.hasCar) tipos.push("CAR");
    if (docProfile.hasSigef) tipos.push("SIGEF");
    if (docProfile.hasMemorial) tipos.push("memorial");
    const tiposTexto = tipos.length > 0 ? tipos.join(", ") : "documento geoespacial";

    push({
      module_id: "geoespacial",
      title: getModuleTitle("geoespacial"),
      reason: `Você anexou ${tiposTexto}. Valide área e perímetro cruzando com a matrícula.`,
      evidence: evidenceToString({
        source: "document_profile",
        rule: "geospatial_document_without_geoespacial_module",
        has_car: docProfile.hasCar,
        has_sigef: docProfile.hasSigef,
        has_memorial: docProfile.hasMemorial,
        collected_at: now
      }),
      priority: "media",
      status: "available",
      required_documents: ["car_sigef", "memorial_descritivo"],
      expected_value:
        "Conferência de área, perímetro, sobreposição e consistência geodésica.",
      price: getModulePriceSafe("geoespacial")
    });
  }

  // ── Regra 4: Origem pública não confirmada → origem_publica ──
  if (
    !alreadySelectedSet.has("origem_publica") &&
    titleOriginIsEmpty(cf)
  ) {
    push({
      module_id: "origem_publica",
      title: getModuleTitle("origem_publica"),
      reason:
        "Análise inicial não confirmou origem pública (INCRA/ITERTINS/Estado/União).",
      evidence: evidenceToString({
        source: "case_file.title_origin",
        rule: "title_origin_unconfirmed",
        title_origin_keys: Object.keys(cf.title_origin || {}).length,
        collected_at: now
      }),
      priority: "alta",
      status: "available",
      required_documents: ["titulo_originario", "ccir", "itr"],
      expected_value:
        "Validação de título originário, cláusulas resolutivas, pagamento e exploração.",
      price: getModulePriceSafe("origem_publica")
    });
  }

  // ── Regra 5: Faltam certidões de cadeia/cartório → cadeia_dominial ──
  if (
    !alreadySelectedSet.has("cadeia_dominial") &&
    hasCadeiaGap(cf)
  ) {
    push({
      module_id: "cadeia_dominial",
      title: getModuleTitle("cadeia_dominial"),
      reason:
        "Faltam certidões da cadeia dominial para validar continuidade registral.",
      evidence: evidenceToString({
        source: "case_file.missing_documents",
        rule: "missing_cadeia_certidoes",
        collected_at: now
      }),
      priority: "alta",
      status: "available",
      required_documents: ["certidao_inteiro_teor", "cadeia_titulos"],
      expected_value:
        "Reconstrução da origem, transmissões e continuidade da cadeia dominial.",
      price: getModulePriceSafe("cadeia_dominial")
    });
  }

  // Ordenar por prioridade (critica > alta > media > baixa) e limitar a 5.
  const priorityOrder: Record<string, number> = {
    critica: 0,
    alta: 1,
    media: 2,
    baixa: 3
  };

  recommendations.sort(
    (a, b) =>
      (priorityOrder[a.priority || "baixa"] ?? 3) -
      (priorityOrder[b.priority || "baixa"] ?? 3)
  );

  return recommendations.slice(0, 5);
}

/** Helper: conta quantas recomendações foram geradas. */
export function countRecommendations(
  recommendations: CaseFileRecommendedModule[] | null | undefined
): number {
  if (!Array.isArray(recommendations)) return 0;
  return recommendations.length;
}

/** Helper: extrai apenas os IDs dos módulos recomendados. */
export function getRecommendedModuleIds(
  recommendations: CaseFileRecommendedModule[] | null | undefined
): string[] {
  if (!Array.isArray(recommendations)) return [];
  return recommendations.map((r) => r.module_id);
}
