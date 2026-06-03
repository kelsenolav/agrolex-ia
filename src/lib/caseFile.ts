export type CaseFileStatus = "created" | "processing" | "completed" | "error";

export interface CaseFileDocument {
  name: string;
  type?: string | null;
  storage_path?: string | null;
  size?: number | null;
  uploaded_at?: string | null;
}

export interface CaseFilePropertyInput {
  name?: string | null;
  state?: string | null;
  city?: string | null;
  registry_number?: string | null;
  registry_office?: string | null;
  property_description?: string | null;
  car_number?: string | null;
  declared_area_ha?: number | null;
  owner_name?: string | null;
  owner_document?: string | null;
}

export interface CaseFileModuleResult {
  status?: string;
  summary?: string | null;
  findings?: unknown[];
  updated_at?: string | null;
}

export interface CaseFileRecommendedModule {
  module_id: string;
  title: string;
  reason: string;
  evidence?: string | null;
  priority?: "baixa" | "media" | "alta" | "critica";
  status?: "available" | "already_purchased" | "needs_documents" | "future";
  required_documents?: string[];
  expected_value?: string | null;
  price?: number | null;
}

export interface CaseFile {
  version: "1.0";
  status: CaseFileStatus;
  created_at: string;
  updated_at: string;
  property_identification: {
    name: string | null;
    state: string | null;
    city: string | null;
    registry_number: string | null;
    registry_office: string | null;
    property_description: string | null;
    car_number: string | null;
  };
  user_declared_data: {
    declared_area_ha: number | null;
    owner_name: string | null;
    owner_document: string | null;
  };
  documents: CaseFileDocument[];
  extracted_text: {
    summary: string | null;
    chunks: unknown[];
  };
  registry_acts: unknown[];
  parties: unknown[];
  areas: unknown[];
  title_origin: Record<string, unknown>;
  encumbrances: unknown[];
  lawsuits: unknown[];
  environmental_flags: unknown[];
  chain_summary: Record<string, unknown>;
  missing_documents: unknown[];
  risks: unknown[];
  module_results: Record<string, CaseFileModuleResult>;
  recommended_modules: CaseFileRecommendedModule[];
  report_composition: Record<string, unknown>;
  processing_metrics: Record<string, unknown>;
  retry_state: Record<string, unknown>;
}

export interface CreateInitialCaseFileInput {
  now?: string;
  property?: CaseFilePropertyInput | null;
  documents?: CaseFileDocument[];
}

export interface BasicFactsProblem {
  titulo?: string | null;
  descricao?: string | null;
  criticidade?: string | null;
  baseDocumental?: string | null;
}

export interface UpdateCaseFileWithBasicFactsInput {
  now?: string;
  property?: CaseFilePropertyInput | null;
  resumo?: string | null;
  problemas?: Array<BasicFactsProblem | string> | null;
  documentosFaltantes?: string[] | null;
  recomendacoes?: string[] | null;
  riskLevel?: string | null;
}

function normalizeArea(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function createInitialCaseFile(input: CreateInitialCaseFileInput = {}): CaseFile {
  const now = input.now || new Date().toISOString();
  const property = input.property || {};

  return {
    version: "1.0",
    status: "created",
    created_at: now,
    updated_at: now,
    property_identification: {
      name: property.name || null,
      state: property.state || null,
      city: property.city || null,
      registry_number: property.registry_number || null,
      registry_office: property.registry_office || null,
      property_description: property.property_description || null,
      car_number: property.car_number || null
    },
    user_declared_data: {
      declared_area_ha: normalizeArea(property.declared_area_ha),
      owner_name: property.owner_name || null,
      owner_document: property.owner_document || null
    },
    documents: input.documents || [],
    extracted_text: {
      summary: null,
      chunks: []
    },
    registry_acts: [],
    parties: [],
    areas: [],
    title_origin: {},
    encumbrances: [],
    lawsuits: [],
    environmental_flags: [],
    chain_summary: {},
    missing_documents: [],
    risks: [],
    module_results: {},
    recommended_modules: [],
    report_composition: {},
    processing_metrics: {},
    retry_state: {}
  };
}

export function ensureCaseFile(
  findings: Record<string, any> | null | undefined,
  fallbackInput: CreateInitialCaseFileInput = {}
): CaseFile {
  const existing = findings?.case_file;
  const initial = createInitialCaseFile(fallbackInput);

  if (!existing || typeof existing !== "object") {
    return initial;
  }

  return {
    ...initial,
    ...existing,
    property_identification: {
      ...initial.property_identification,
      ...(existing.property_identification || {})
    },
    user_declared_data: {
      ...initial.user_declared_data,
      ...(existing.user_declared_data || {})
    },
    extracted_text: {
      ...initial.extracted_text,
      ...(existing.extracted_text || {})
    },
    documents: Array.isArray(existing.documents) ? existing.documents : initial.documents,
    registry_acts: Array.isArray(existing.registry_acts) ? existing.registry_acts : initial.registry_acts,
    parties: Array.isArray(existing.parties) ? existing.parties : initial.parties,
    areas: Array.isArray(existing.areas) ? existing.areas : initial.areas,
    encumbrances: Array.isArray(existing.encumbrances) ? existing.encumbrances : initial.encumbrances,
    lawsuits: Array.isArray(existing.lawsuits) ? existing.lawsuits : initial.lawsuits,
    environmental_flags: Array.isArray(existing.environmental_flags) ? existing.environmental_flags : initial.environmental_flags,
    missing_documents: Array.isArray(existing.missing_documents) ? existing.missing_documents : initial.missing_documents,
    risks: Array.isArray(existing.risks) ? existing.risks : initial.risks,
    recommended_modules: Array.isArray(existing.recommended_modules) ? existing.recommended_modules : initial.recommended_modules,
    title_origin: existing.title_origin && typeof existing.title_origin === "object" ? existing.title_origin : initial.title_origin,
    chain_summary: existing.chain_summary && typeof existing.chain_summary === "object" ? existing.chain_summary : initial.chain_summary,
    module_results: existing.module_results && typeof existing.module_results === "object" ? existing.module_results : initial.module_results,
    report_composition: existing.report_composition && typeof existing.report_composition === "object" ? existing.report_composition : initial.report_composition,
    processing_metrics: existing.processing_metrics && typeof existing.processing_metrics === "object" ? existing.processing_metrics : initial.processing_metrics,
    retry_state: existing.retry_state && typeof existing.retry_state === "object" ? existing.retry_state : initial.retry_state
  };
}

export function withEnsuredCaseFile<T extends Record<string, any>>(
  findings: T | null | undefined,
  fallbackInput: CreateInitialCaseFileInput = {}
): T & { case_file: CaseFile } {
  const source = (findings || {}) as T;
  return {
    ...source,
    case_file: ensureCaseFile(source, fallbackInput)
  };
}

function cleanText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength).trim()}...` : cleaned;
}

function normalizeKey(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSeverity(value: unknown): "baixo" | "medio" | "alto" | "critico" | null {
  const normalized = normalizeKey(value);
  if (normalized.includes("critico")) return "critico";
  if (normalized.includes("alto")) return "alto";
  if (normalized.includes("medio")) return "medio";
  if (normalized.includes("baixo")) return "baixo";
  return null;
}

function normalizeAreaNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string") return null;

  const normalizedValue = value.trim().replace(/\s+/g, "");
  if (!normalizedValue) return null;

  const lastComma = normalizedValue.lastIndexOf(",");
  const lastDot = normalizedValue.lastIndexOf(".");
  let numericText = normalizedValue;

  if (lastComma >= 0 && lastDot >= 0) {
    numericText = lastComma > lastDot
      ? normalizedValue.replace(/\./g, "").replace(",", ".")
      : normalizedValue.replace(/,/g, "");
  } else if (lastComma >= 0) {
    numericText = normalizedValue.replace(",", ".");
  }

  const parsed = Number.parseFloat(numericText);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = normalizeKey(keyFn(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

function extractRegistryNumber(resumo: string | null | undefined): string | null {
  if (!resumo) return null;
  const match = resumo.match(/matr[íi]cula\s*(?:n[ºo.]*)?\s*([A-Z0-9.\-\/]+)/i);
  return cleanText(match?.[1] || null, 80);
}

function extractRegistryOffice(resumo: string | null | undefined): string | null {
  if (!resumo) return null;
  const match = resumo.match(/((?:cart[oó]rio|serventia|of[ií]cio|registro de im[oó]veis)[^.\n;]{0,140})/i);
  return cleanText(match?.[1] || null, 180);
}

function extractPropertyDescription(resumo: string | null | undefined): string | null {
  if (!resumo) return null;
  const lines = resumo
    .split(/\r?\n/)
    .map((line) => cleanText(line, 500))
    .filter((line): line is string => Boolean(line));

  return lines.find((line) => /(?:im[oó]vel|propriedade|fazenda|loteamento|gleba|matr[íi]cula)/i.test(line)) || null;
}

function extractReportAreas(resumo: string | null | undefined): unknown[] {
  if (!resumo) return [];
  const areaRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[,.]\d+)?)\s*(?:ha|hectares?)/gi;
  const areas: unknown[] = [];
  let match: RegExpExecArray | null;

  while ((match = areaRegex.exec(resumo)) !== null) {
    const value = normalizeAreaNumber(match[1]);
    if (!value) continue;
    areas.push({
      source: "report",
      value_ha: value,
      raw_text: cleanText(match[0], 120) || match[0],
      confidence: "medium"
    });
    if (areas.length >= 5) break;
  }

  return areas;
}

function extractReportParties(resumo: string | null | undefined): unknown[] {
  if (!resumo) return [];
  const parties: Array<Record<string, string>> = [];
  const patterns = [
    { role: "proprietario_atual", regex: /propriet[aá]rio(?:\s+atual)?\s*[:\-]\s*([^.\n;]{3,140})/gi },
    { role: "proprietario_anterior", regex: /propriet[aá]rio\s+anterior\s*[:\-]\s*([^.\n;]{3,140})/gi },
    { role: "adquirente", regex: /adquirente\s*[:\-]\s*([^.\n;]{3,140})/gi },
    { role: "alienante", regex: /alienante\s*[:\-]\s*([^.\n;]{3,140})/gi },
    { role: "orgao_publico", regex: /(?:INCRA|Uni[aã]o|Estado do [A-Z][^.\n;]{2,80}|Munic[ií]pio de [^.\n;]{2,80})/g }
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(resumo)) !== null) {
      const name = cleanText(match[1] || match[0], 140);
      if (!name || name.length < 3) continue;
      parties.push({
        role: pattern.role,
        name,
        source: "report_parser"
      });
      if (parties.length >= 12) break;
    }
    if (parties.length >= 12) break;
  }

  return dedupeByKey(parties, (item) => `${item.role}:${item.name}`, 12);
}

function buildRisks(problemas: Array<BasicFactsProblem | string> | null | undefined, riskLevel: string | null | undefined): unknown[] {
  const risks: Array<Record<string, string | null>> = [];

  for (const problem of problemas || []) {
    if (typeof problem === "string") {
      const text = cleanText(problem, 500);
      if (!text) continue;
      risks.push({
        title: text,
        description: text,
        severity: normalizeSeverity(riskLevel),
        source: "structured_extract",
        evidence: null
      });
      continue;
    }

    const title = cleanText(problem?.titulo || problem?.descricao, 180);
    const description = cleanText(problem?.descricao || problem?.titulo, 500);
    if (!title && !description) continue;

    risks.push({
      title: title || "Achado técnico",
      description: description || title || "Achado técnico identificado.",
      severity: normalizeSeverity(problem?.criticidade) || normalizeSeverity(riskLevel),
      source: "structured_extract",
      evidence: cleanText(problem?.baseDocumental || null, 240)
    });
  }

  if (risks.length === 0 && riskLevel) {
    risks.push({
      title: "Classificação geral de risco",
      description: `Risco classificado como ${riskLevel}.`,
      severity: normalizeSeverity(riskLevel),
      source: "risk_level",
      evidence: null
    });
  }

  return dedupeByKey(risks, (item) => `${item.title}:${item.description}`, 10);
}

function buildMissingDocuments(documentosFaltantes: string[] | null | undefined): unknown[] {
  const forbidden = new Set(["nenhum documento listado", "nenhum documento faltante"]);
  const items = (documentosFaltantes || [])
    .map((item) => cleanText(item, 240))
    .filter((item): item is string => Boolean(item))
    .filter((item) => !forbidden.has(normalizeKey(item)))
    .map((description) => ({
      description,
      source: "structured_extract",
      status: "missing"
    }));

  return dedupeByKey(items, (item) => item.description, 12);
}

export function updateCaseFileWithBasicFacts(
  caseFile: CaseFile,
  input: UpdateCaseFileWithBasicFactsInput
): CaseFile {
  const now = input.now || new Date().toISOString();
  const reportRegistryNumber = extractRegistryNumber(input.resumo);
  const reportRegistryOffice = extractRegistryOffice(input.resumo);
  const reportDescription = extractPropertyDescription(input.resumo);
  const declaredArea = normalizeAreaNumber(input.property?.declared_area_ha ?? caseFile.user_declared_data.declared_area_ha);

  const areaFacts = [
    ...(Array.isArray(caseFile.areas) ? caseFile.areas : []),
    ...(declaredArea
      ? [{
          source: "user_declared",
          value_ha: declaredArea,
          raw_text: `${declaredArea} ha`,
          confidence: "high"
        }]
      : []),
    ...extractReportAreas(input.resumo)
  ];

  const risks = [
    ...(Array.isArray(caseFile.risks) ? caseFile.risks : []),
    ...buildRisks(input.problemas, input.riskLevel)
  ];

  const missingDocuments = [
    ...(Array.isArray(caseFile.missing_documents) ? caseFile.missing_documents : []),
    ...buildMissingDocuments(input.documentosFaltantes)
  ];

  const parties = [
    ...(Array.isArray(caseFile.parties) ? caseFile.parties : []),
    ...extractReportParties(input.resumo)
  ];

  return {
    ...caseFile,
    status: "completed",
    updated_at: now,
    property_identification: {
      ...caseFile.property_identification,
      name: caseFile.property_identification.name || input.property?.name || null,
      state: caseFile.property_identification.state || input.property?.state || null,
      city: caseFile.property_identification.city || input.property?.city || null,
      car_number: caseFile.property_identification.car_number || input.property?.car_number || null,
      registry_number: caseFile.property_identification.registry_number || input.property?.registry_number || reportRegistryNumber || null,
      registry_office: caseFile.property_identification.registry_office || input.property?.registry_office || reportRegistryOffice || null,
      property_description: caseFile.property_identification.property_description || input.property?.property_description || reportDescription || null
    },
    user_declared_data: {
      ...caseFile.user_declared_data,
      declared_area_ha: caseFile.user_declared_data.declared_area_ha ?? declaredArea,
      owner_name: caseFile.user_declared_data.owner_name || input.property?.owner_name || null,
      owner_document: caseFile.user_declared_data.owner_document || input.property?.owner_document || null
    },
    areas: dedupeByKey(areaFacts, (item: any) => `${item?.source}:${item?.value_ha}:${item?.raw_text}`, 6),
    parties: dedupeByKey(parties, (item: any) => `${item?.role}:${item?.name}`, 12),
    risks: dedupeByKey(risks, (item: any) => `${item?.title}:${item?.description}`, 10),
    missing_documents: dedupeByKey(missingDocuments, (item: any) => item?.description || String(item), 12),
    report_composition: {
      ...(caseFile.report_composition || {}),
      recommendations: dedupeByKey(
        [
          ...((Array.isArray((caseFile.report_composition as any)?.recommendations) ? (caseFile.report_composition as any).recommendations : []) as string[]),
          ...((input.recomendacoes || []).map((item) => cleanText(item, 280)).filter(Boolean) as string[])
        ],
        (item) => String(item),
        12
      )
    },
    processing_metrics: {
      ...(caseFile.processing_metrics || {}),
      case_file_updated_at: now,
      basic_facts_extracted_at: now,
      basic_facts_source: "local_parser",
      basic_facts_version: "1.0"
    }
  };
}
