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
