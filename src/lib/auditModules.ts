export interface AuditModule {
  id: string;
  name: string;
  price: number;
  description: string;
}

export const AUDIT_MODULES: AuditModule[] = [
  {
    id: "matricula_individual",
    name: "Análise de Matrícula Individual",
    price: 99.90,
    description: "Análise de uma única matrícula, com identificação do imóvel, cadeia registral básica, atos, averbações, ônus, restrições, origem, inconsistências internas e documentos faltantes."
  },
  {
    id: "cruzamento_matriculas",
    name: "Cruzamento de Matrículas",
    price: 149.90,
    description: "Comparação entre duas ou mais matrículas para identificar divergências de área, origem comum, matrícula mãe/filha, sobreposição narrativa, continuidade registral e conflitos entre registros."
  },
  {
    id: "cadeia_dominial",
    name: "Cadeia Dominial Registral",
    price: 199.90,
    description: "Auditoria do histórico de transmissões, continuidade registral, desmembramentos e possíveis quebras na cadeia dominial."
  },
  {
    id: "origem_publica",
    name: "Auditoria de Origem Pública / Título Fundiário",
    price: 199.90,
    description: "Análise de origem em INCRA, ITERTINS, Estado, União, títulos definitivos, regularização fundiária, cláusulas resolutivas, pagamento, posse e exploração."
  },
  {
    id: "geoespacial",
    name: "Auditoria Geoespacial",
    price: 199.90,
    description: "Análise de memorial, CAR, CCIR, SIGEF, perímetro, área declarada versus área registrada e indícios de sobreposição."
  },
  {
    id: "nulidades_fraudes",
    name: "Mapeamento de Nulidades e Indícios de Fraude",
    price: 249.90,
    description: "Identificação de vícios registrais, nulidades, simulação, grilagem, fraude documental, inconsistências e pontos de impugnação."
  },
  {
    id: "cruzamento_total",
    name: "Cruzamento Total",
    price: 499.90,
    description: "Análise ampla dos documentos disponíveis. Deve ser usada preferencialmente quando houver documentação suficiente."
  }
];

export const MODULE_PRICES: Record<string, number> = AUDIT_MODULES.reduce((acc, mod) => {
  acc[mod.id] = mod.price;
  return acc;
}, {} as Record<string, number>);

// Compatibilidade com chaves legadas e cálculo de preços robusto
export const LEGACY_ALIASES: Record<string, string> = {
  titulos_incra: "origem_publica",
  registros: "cadeia_dominial",
  nulidades: "nulidades_fraudes",
  forense: "nulidades_fraudes",
  cruzamento: "cruzamento_total",
};

// Aliases inversos para garantir que o backend atual (/api/analyze)
// continue funcionando mesmo recebendo chaves novas, caso necessário
export const NEW_TO_LEGACY_ALIASES: Record<string, string> = {
  origem_publica: "titulos_incra",
  cadeia_dominial: "registros",
  matricula_individual: "registros", // Mapeamento seguro para IA legada
  cruzamento_matriculas: "cruzamento",
  nulidades_fraudes: "nulidades",
  geoespacial: "geoespacial",
  cruzamento_total: "cruzamento"
};

export function normalizeModuleId(id: string): string {
  if (MODULE_PRICES[id] !== undefined) {
    return id;
  }
  return LEGACY_ALIASES[id] || id;
}

export function getModulePrice(id: string): number {
  const normId = normalizeModuleId(id);
  // Se for uma das chaves antigas que mapeia direto
  if (normId === "cadeia_dominial" && id === "registros") return 149.90; // manter preço antigo se carregado do BD antigo
  if (normId === "origem_publica" && id === "titulos_incra") return 99.90;
  if (normId === "nulidades_fraudes" && id === "nulidades") return 249.90;
  if (normId === "nulidades_fraudes" && id === "forense") return 299.90;
  if (normId === "cruzamento_total" && id === "cruzamento") return 499.90;

  return MODULE_PRICES[normId] || 0;
}

export interface DocumentProfile {
  totalDocuments: number;
  totalMatriculas: number;
  hasMatricula: boolean;
  hasMultipleMatriculas: boolean;
  hasTituloPublico: boolean;
  hasGeospatialDocument: boolean;
  hasCar: boolean;
  hasSigef: boolean;
  hasMemorial: boolean;
  hasCcir: boolean;
}

export interface ModuleCompatibility {
  enabled: boolean;
  recommended: boolean;
  warning?: string;
  reason?: string;
}

function normalizeSearchText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function buildDocumentProfile(files: { name?: string, type: string }[]): DocumentProfile {
  const totalDocuments = files.length;
  
  const matriculasList = files.filter(f =>
    f.type === "Matrícula" || normalizeSearchText(f.name).includes("matricula")
  );
  const totalMatriculas = matriculasList.length;
  
  const hasMatricula = totalMatriculas > 0;
  const hasMultipleMatriculas = totalMatriculas >= 2;
  
  const hasTituloPublico = files.some(f =>
    f.type === "Título INCRA" ||
    normalizeSearchText(f.name).includes("titulo")
  );
  
  const hasCar = files.some(f => f.type === "CAR" || /(^|[^a-z])car([^a-z]|$)/.test(normalizeSearchText(f.name)));
  const hasSigef = files.some(f => f.type === "SIGEF" || normalizeSearchText(f.name).includes("sigef"));
  const hasMemorial = files.some(f => f.type === "Memorial" || normalizeSearchText(f.name).includes("memorial"));
  const hasCcir = files.some(f => f.type === "CCIR" || normalizeSearchText(f.name).includes("ccir"));
  
  // Tipos declarados ou nomes de arquivo podem indicar dado geoespacial.
  const hasGeospatialDocument = hasCar || hasSigef || hasMemorial || files.some(f => {
    const nameLower = normalizeSearchText(f.name);
    return f.type === "Planta" ||
      f.type === "Coordenadas" ||
      f.type === "Documento Geoespacial" ||
      nameLower.endsWith(".kml") ||
      nameLower.endsWith(".gpx") ||
      nameLower.includes("geo") ||
      nameLower.includes("planta") ||
      nameLower.includes("coordenad");
  });

  return {
    totalDocuments,
    totalMatriculas,
    hasMatricula,
    hasMultipleMatriculas,
    hasTituloPublico,
    hasGeospatialDocument,
    hasCar,
    hasSigef,
    hasMemorial,
    hasCcir
  };
}

export function getModuleCompatibility(moduleId: string, profile: DocumentProfile): ModuleCompatibility {
  if (profile.totalDocuments === 0) {
    return { enabled: false, recommended: false, reason: "Anexe ao menos um documento." };
  }

  switch (moduleId) {
    case "matricula_individual":
      return { 
        enabled: profile.totalDocuments >= 1,
        recommended: profile.totalMatriculas === 1,
        reason: "Anexe ao menos um documento.",
        warning: !profile.hasMatricula ? "Recomendado anexar uma Matrícula." : undefined
      };
      
    case "cruzamento_matriculas":
      return {
        enabled: profile.hasMultipleMatriculas,
        recommended: profile.hasMultipleMatriculas,
        reason: "Exige duas ou mais matrículas."
      };
      
    case "cadeia_dominial":
      return {
        enabled: profile.hasMatricula,
        // Recomendar cadeia dominial apenas quando houver múltiplas matrículas
        recommended: profile.hasMultipleMatriculas,
        reason: "Recomendado anexar matrícula ou certidão de inteiro teor."
      };
      
    case "origem_publica":
      return {
        enabled: true,
        recommended: profile.hasTituloPublico,
        warning: !profile.hasTituloPublico 
          ? "Com os documentos atuais, a análise de origem pública será preliminar e limitada aos elementos constantes da matrícula."
          : undefined
      };
      
    case "geoespacial":
      return {
        enabled: profile.hasGeospatialDocument,
        recommended: profile.hasGeospatialDocument,
        reason: "Exige CAR, SIGEF, memorial, planta ou coordenadas."
      };
      
    case "nulidades_fraudes":
      return {
        enabled: profile.totalDocuments >= 1,
        // Não recomendar automaticamente para apenas 1 documento/matrícula;
        // recomendar apenas quando houver mais de um documento para análise mais rica.
        recommended: profile.totalDocuments >= 2,
        reason: "Anexe ao menos um documento.",
        warning: profile.totalDocuments === 1 && profile.totalMatriculas === 1
          ? "A análise será limitada a indícios internos da matrícula." 
          : undefined
      };
      
    case "cruzamento_total":
      return {
        enabled: profile.totalDocuments >= 2,
        recommended: profile.totalDocuments >= 3,
        reason: "Recomendado apenas quando houver múltiplos documentos."
      };
      
    default:
      return { enabled: true, recommended: false };
  }
}
