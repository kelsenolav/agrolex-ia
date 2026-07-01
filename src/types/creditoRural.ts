// ─── Crédito Rural — Tipos ───────────────────────────────────────────────────

export type CreditProgramId = 'pronaf' | 'pronamp' | 'fno' | 'fco' | 'fne' | 'livre' | 'investagro' | 'funcafe';
export type CreditFinalidade = 'custeio' | 'investimento' | 'comercializacao' | 'industrializacao';
export type EligibilityFaixa = 'inelegivel' | 'restrito' | 'condicional' | 'elegivel' | 'premium';
export type ComplianceStatus = 'conforme' | 'nao_conforme' | 'verificacao_necessaria' | 'sem_dados';
export type DefectSeverity = 'critico' | 'grave' | 'moderado' | 'leve';
export type DefectType = 'formal' | 'material' | 'prescritivo' | 'abusivo';

// ─── Eligibility ─────────────────────────────────────────────────────────────

export interface EligibilityAxis {
  score: number;       // 0-100
  weight: number;      // 0-1
  label: string;
  details: string[];
}

export interface CreditEligibilityInput {
  // Da matrícula/análise existente
  matricula_limpa: boolean;
  onus_count: number;
  onus_types: string[];
  hipotecas_vigentes: number;
  penhoras_vigentes: number;
  area_total_ha: number;
  area_gravada_ha: number;

  // Cadastral
  car_ativo: boolean;
  ccir_vigente: boolean;
  itr_regular: boolean;
  dap_caf_valida?: boolean;

  // Perfil do produtor
  tipo_produtor: 'familiar' | 'medio' | 'grande';
  renda_bruta_anual?: number;
  uf: string;
  regiao?: 'norte' | 'nordeste' | 'centro_oeste' | 'sudeste' | 'sul';

  // Histórico
  credito_rural_vigente: boolean;
  inadimplencia_credito_rural: boolean;
  cadin_serasa: boolean;

  // Ambiental (pós-abril 2026)
  prodes_clean: boolean | null;
  embargo_ibama: boolean;

  // Proveniência: true se ônus/área foram extraídos da análise da matrícula
  origem_matricula?: boolean;
}

export interface CreditEligibilityScore {
  score: number;
  faixa: EligibilityFaixa;
  axes: {
    regularidade_fundiaria: EligibilityAxis;
    conformidade_cadastral: EligibilityAxis;
    capacidade_garantia: EligibilityAxis;
    historico_credito: EligibilityAxis;
  };
  programas_elegiveis: CreditProgramMatch[];
  valor_estimado_credito: number | null;
  documentos_faltantes: DocumentoFaltante[];
  barreira_ambiental: boolean;
  observacoes: string[];
  parametros_vigencia: string;
  origem_dados_matricula: boolean; // true se ônus/área vieram da análise da matrícula
  disclaimer: string;
}

export interface CreditProgramMatch {
  programa_id: CreditProgramId;
  nome: string;
  elegivel: boolean;
  motivo: string;
  taxa_juros_estimada: string;
  prazo_max_meses: number;
  valor_max_estimado: number | null;
  requisitos_pendentes: string[];
}

export interface DocumentoFaltante {
  documento: string;
  obrigatorio: boolean;
  como_obter: string;
  orgao_emissor: string;
  prazo_estimado: string;
}

// ─── Defesa em Execução ──────────────────────────────────────────────────────

export interface CedulaRawData {
  tipo_cedula: string;
  credor: string;
  devedor: string;
  valor_principal: number;
  taxa_juros_contratual: number;
  taxa_mora_contratual: number;
  data_emissao: string;
  data_vencimento: string;
  praca_pagamento?: string;
  bens_vinculados?: string;
  endossos?: string[];
  capitalizacao_juros: boolean;
  clausulas_especiais?: string[];
}

export interface CedulaDefect {
  type: DefectType;
  severity: DefectSeverity;
  titulo: string;
  descricao: string;
  base_legal: string;
  impacto: string;
  tese_defensiva: string;
}

export interface CedulaAnalysis {
  defects: CedulaDefect[];
  prescricao: {
    prescrita: boolean;
    data_prescricao: string | null;
    dias_restantes: number | null;
    base_legal: string;
  };
  juros: {
    taxa_contratual: number;
    taxa_legal_maxima: number;
    excesso_detectado: boolean;
    valor_excesso_estimado: number | null;
    anatocismo_detectado: boolean;
  };
  renegociacao: {
    elegivel: boolean;
    leis_aplicaveis: string[];
    motivo: string;
  };
  score_defesa: number; // 0-100 — chance de sucesso na defesa
  estrategia_recomendada: 'embargos' | 'excecao_pre_executividade' | 'renegociacao' | 'quitacao';
  resumo: string;
  disclaimer: string;
}

// ─── Conformidade Ambiental ──────────────────────────────────────────────────

// 'autodeclarado': nada foi verificado ao vivo. 'parcial_api': desmatamento e/ou
// CAR verificados via API pública real (TerraBrasilis/SICAR), mas o embargo IBAMA
// segue autodeclarado (sem API pública oficial de consulta por propriedade/CPF/CNPJ
// hoje). 'api_oficial': reservado para quando/se todas as fontes forem verificáveis.
export type FonteDadosAmbientais = 'autodeclarado' | 'parcial_api' | 'api_oficial';

export interface EnvironmentalComplianceResult {
  status: ComplianceStatus;
  fonte_dados: FonteDadosAmbientais;
  prodes_verificado_api: boolean; // true quando o TerraBrasilis/DETER foi consultado ao vivo
  car_verificado_api: boolean;    // true quando o SICAR (consulta pública) foi consultado ao vivo
  car_status?: 'ativo' | 'pendente' | 'cancelado' | 'suspenso';
  alertas_desmatamento: Array<{
    ano: number;
    area_ha: number;
    bioma: string;
    fonte: string;
  }>;
  embargo_ibama: boolean;
  resolucoes_aplicaveis: string[];
  impacto_credito: string;
  recomendacoes: string[];
  disclaimer: string;
}

// ─── Knowledge Base ──────────────────────────────────────────────────────────

export interface CreditProgram {
  id: CreditProgramId;
  nome: string;
  nome_completo: string;
  descricao: string;
  finalidades: CreditFinalidade[];
  publico_alvo: string;
  requisitos: string[];
  documentos: string[];
  taxa_juros: string;
  prazo_max: string;
  carencia: string;
  garantias: string[];
  operador: string;
  base_legal: string[];
  ufs_aplicaveis?: string[];
  observacoes: string[];
}

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  category: 'programa' | 'documentacao' | 'taxa' | 'regulacao' | 'defesa' | 'ambiental';
  program_code?: CreditProgramId;
  content: string;
  metadata?: Record<string, unknown>;
  locale: string;
}
