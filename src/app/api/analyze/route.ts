import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';
import { buildLegalAuditPrompt } from '@/lib/auditPromptBuilder';
import { MODULE_PRICES, buildDocumentProfile } from '@/lib/auditModules';
import { extractProblemsFromReport, extractMissingDocumentsFromReport, extractRecommendationsFromReport } from '@/lib/reportExtractors';
import { updateCaseFileWithBasicFacts, withEnsuredCaseFile, type CaseFileDocument, type CaseFileRecommendedModule } from '@/lib/caseFile';
import { buildRecommendedModules } from '@/lib/recommendations';
import { generateWithFallback, type FallbackResult, type AiProvider } from '@/lib/aiProviders';
import { calcularComparacao } from '@/lib/isf/isfV2';
import { calcularISFv2, classificarEixo, type ISFContext } from '@/lib/isf/isfEngine';
import { calcularISFV2_2, inferirPontuacoesDeAchados, prepararPayloadV2_2, normalizeFindingSeverity } from '@/lib/isf/isfEngineV2_2';
import { gerarPayloadISFCompleto } from '@/lib/isf/persistenciaISF';
import {
  initializeProcessingStages,
  getCurrentStage,
  markStageProcessing,
  markStageCompleted,
  markStageError,
  markStageProviderInfo,
  isProcessingFinished,
  type ProcessingStages,
} from '@/lib/processingStages';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const maxDuration = 300;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${label}`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

type RiskLevel = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
type RiskLevelSource = 'ai_section' | 'ai_text' | 'fallback' | 'ai_json';
type RecoverableErrorType = 'ai_timeout' | 'ai_unavailable' | 'ai_incomplete_response' | 'ai_quota_exceeded';

interface DerivedRiskLevel {
  level: RiskLevel;
  source: RiskLevelSource;
}

const RECOVERABLE_ERROR_TYPES: RecoverableErrorType[] = ['ai_timeout', 'ai_unavailable', 'ai_incomplete_response', 'ai_quota_exceeded'];

function isRecoverableErrorType(value: unknown): value is RecoverableErrorType {
  return typeof value === 'string' && RECOVERABLE_ERROR_TYPES.includes(value as RecoverableErrorType);
}

function getRecoverableRetryReason(findings: Record<string, any>): RecoverableErrorType | null {
  const candidates = [
    findings.technical_error_type,
    findings.retry_reason,
    findings.retry_state?.reason,
    findings.case_file?.retry_state?.reason
  ];

  for (const candidate of candidates) {
    if (isRecoverableErrorType(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getRetryCount(findings: Record<string, any>): number {
  const values = [
    findings.retry_state?.retry_count,
    findings.case_file?.retry_state?.retry_count
  ];

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return 0;
}

function buildRetryState(findings: Record<string, any>, reason: RecoverableErrorType, now: string) {
  return {
    available: true,
    reason,
    retry_count: getRetryCount(findings) + 1,
    last_error_at: now,
    last_error_type: reason
  };
}

/**
 * Extrai a seção de "CLASSIFICAÇÃO DE RISCO" do parecer
 * Retorna um trecho de até 1000 caracteres a partir do início da seção
 */
function extractRiskClassificationSection(resumo: string): string | null {
  // Normalizar para busca: minúsculas + remover acentos
  const normalized = resumo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Possíveis títulos de seção (ordem: mais específicos primeiro)
  const sectionTitles = [
    /\d+\.\s*classificacao\s+de\s+risco/,
    /classificacao\s+de\s+risco\s*[:)\-\n]/,  // com separador após
    /classificacao\s+de\s+risco\b/,           // como palavra completa
    /grau\s+de\s+risco\s*[:)\-\n]/,
    /grau\s+de\s+risco\b/,
    /risco\s+final\s*[:)\-\n]/,
    /risco\s+final\b/
  ];
  
  for (const titleRegex of sectionTitles) {
    const match = normalized.match(titleRegex);
    if (match) {
      // Começar do match e pegar até 1000 caracteres
      const startIdx = match.index || 0;
      const section = resumo.substring(startIdx, startIdx + 1000);
      return section;
    }
  }
  
  return null;
}

/**
 * Procura um nível de risco em um trecho de texto normalizado
 * Prioridade: Crítico > Alto > Médio > Baixo
 * Usa busca simples (indexOf) para máxima compatibilidade
 */
function findRiskLevelInText(normalizedText: string): RiskLevel | null {
  // Ordem de prioridade: Crítico > Alto > Médio > Baixo
  const patterns = [
    { level: 'Crítico' as RiskLevel, keywords: ['critico', 'crítico'] },
    { level: 'Alto' as RiskLevel, keywords: ['alto'] },
    { level: 'Médio' as RiskLevel, keywords: ['medio', 'médio'] },
    { level: 'Baixo' as RiskLevel, keywords: ['baixo'] }
  ];
  
  for (const { level, keywords } of patterns) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        return level;
      }
    }
  }
  
  return null;
}

/**
 * Deriva o risk level com prioridade: seção explícita > busca genérica > fallback
 * Retorna tanto o nível quanto a fonte (ai_section | ai_text | fallback)
 */
function deriveRiskLevelFromResumo(resumo: string): DerivedRiskLevel {
  const normalizedFull = resumo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // ESTRATÉGIA 1: Procurar seção explícita de classificação de risco
  const classificationSection = extractRiskClassificationSection(resumo);
  if (classificationSection) {
    const normalizedSection = classificationSection
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    const sectionRiskLevel = findRiskLevelInText(normalizedSection);
    if (sectionRiskLevel) {
      return {
        level: sectionRiskLevel,
        source: 'ai_section'
      };
    }
  }

  // ESTRATÉGIA 2: Busca genérica em todo o texto (fallback)
  const genericRiskLevel = findRiskLevelInText(normalizedFull);
  if (genericRiskLevel) {
    return {
      level: genericRiskLevel,
      source: 'ai_text'
    };
  }

  // ESTRATÉGIA 3: Fallback padrão
  return {
    level: 'Alto',
    source: 'fallback'
  };
}

function normalizeForQualityCheck(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function countWords(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/**
 * Regra de validação de seção obrigatória com fallback em 3 camadas.
 *
 * Camada 1 — Busca exata da key canônica.
 * Camada 2 — Variações aceitáveis (aliases).
 * Camada 3 — Fallback semântico: 2+ hints presentes no texto.
 *
 * Rejeita APENAS se nenhuma das 3 camadas encontrar evidência.
 */
type RequiredSectionRule = {
  /** Identificador canônico (busca exata, camada 1) */
  key: string;
  /** Nome legível para mensagens de erro */
  label: string;
  /** Variações aceitáveis (camada 2) */
  aliases: string[];
  /** Hints semânticos para fallback (camada 3) — exige 2+ matches */
  semanticHints?: string[];
};

/**
 * Regras unificadas para as 6 seções obrigatórias do parecer rápido
 * de Cadeia Dominial (isChainOfTitleOnly).
 *
 * Ordem: IDENTIFICAÇÃO → CADEIA DOMINIAL → ACHADOS →
 *        CLASSIFICAÇÃO DE RISCO → RECOMENDAÇÕES → DOCUMENTOS ANALISADOS
 */
const FAST_CHAIN_REQUIRED_SECTIONS: RequiredSectionRule[] = [
  {
    key: 'identificacao',
    label: 'identificação',
    aliases: [
      'identificacao da matricula',
      'identificacao do imovel',
      'dados da matricula',
      'dados do imovel',
      'qualificacao registral',
      'qualificacao do imovel',
      'matricula analisada',
    ],
    semanticHints: ['matricula', 'cartorio', 'cri', 'proprietario', 'imovel'],
  },
  {
    key: 'cadeia dominial',
    label: 'cadeia dominial',
    aliases: [
      'cadeia dominial registral',
      'cadeia de dominio',
      'historico registral',
      'historico de transmissoes',
      'sequencia de proprietarios',
      'resumo da cadeia dominial',
      'cadeia de transmissao',
    ],
    semanticHints: ['transmissao', 'proprietario', 'adquirente', 'registro anterior', 'matricula'],
  },
  {
    key: 'achados',
    label: 'achados',
    aliases: [
      'achados dominiais',
      'achados tecnicos',
      'achados da analise',
      'irregularidades',
      'inconsistencias',
      'inconsistencias registrais',
      'problemas identificados',
      'pontos de atencao',
      'constatacoes',
      'apontamentos',
      'irregularidades encontradas',
      'observacoes tecnicas',
    ],
    semanticHints: ['risco juridico', 'base documental', 'grau de criticidade', 'achado', 'recomendacao'],
  },
  {
    key: 'classificacao de risco',
    label: 'classificação de risco',
    aliases: [
      'grau de risco',
      'nivel de risco',
      'risco final',
      'classificacao do risco',
      'risco classificado como',
      'avaliacao de risco',
      'grau de risco fundiario',
    ],
    semanticHints: ['risco', 'baixo', 'medio', 'alto', 'critico'],
  },
  {
    key: 'recomendacoes',
    label: 'recomendações',
    aliases: [
      'recomendacoes objetivas',
      'recomendacoes tecnicas',
      'providencias recomendadas',
      'acoes recomendadas',
      'encaminhamentos',
      'proximos passos',
      'providencias',
      'recomendacoes finais',
    ],
    semanticHints: ['recomenda', 'providencia', 'documento', 'acao'],
  },
  {
    key: 'documentos analisados',
    label: 'documentos analisados',
    aliases: [
      'documento analisado',
      'matricula analisada',
      'documentacao analisada',
      'documento anexado',
      'documentos anexados',
      'documentos apresentados',
      'arquivo analisado',
      'certidao analisada',
      'matricula apresentada',
    ],
    semanticHints: ['matricula', 'certidao de inteiro teor', 'certidao', 'escritura', 'contrato', 'registro', 'documento'],
  },
];

/**
 * Valida a presença de uma seção obrigatória com 3 camadas de fallback.
 *
 * Camada 1 — Busca exata da key canônica.
 * Camada 2 — Qualquer alias presente no texto.
 * Camada 3 — Fallback semântico: 2+ hints presentes.
 *
 * @returns true se a seção foi detectada em qualquer camada.
 */
function validateSectionPresence(normalized: string, rule: RequiredSectionRule): boolean {
  // Camada 1: key canônica
  if (normalized.includes(rule.key)) {
    return true;
  }

  // Camada 2: aliases (variações aceitáveis)
  if (rule.aliases.some((alias) => normalized.includes(alias))) {
    return true;
  }

  // Camada 3: fallback semântico (exige 2+ hints)
  if (rule.semanticHints && rule.semanticHints.length >= 2) {
    const hintMatches = rule.semanticHints.filter((hint) => normalized.includes(hint));
    if (hintMatches.length >= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Valida a qualidade da resposta da IA para o modo rápido de Cadeia Dominial.
 *
 * Verifica, para cada uma das 6 seções obrigatórias, a presença via 3 camadas
 * de fallback (key canônica → aliases → hints semânticos).
 *
 * Também valida: contagem mínima de palavras, sinal de documentos insuficientes
 * e indícios de idioma estrangeiro.
 *
 * @returns null se a resposta é válida, ou uma string com a descrição do problema.
 */
function validateFastChainOfTitleResponse(resumo: string): string | null {
  const normalized = normalizeForQualityCheck(resumo);

  // Validar cada seção obrigatória com fallback em 3 camadas
  let allSectionsPresent = true;
  for (const rule of FAST_CHAIN_REQUIRED_SECTIONS) {
    if (!validateSectionPresence(normalized, rule)) {
      allSectionsPresent = false;
      return `Resposta incompleta: seção obrigatória ausente (${rule.label}).`;
    }
  }

  const insufficientDocumentSignals = [
    'documentos insuficientes',
    'documentacao insuficiente',
    'documentacao apresentada e insuficiente',
    'nao ha dados suficientes',
    'nao foi possivel identificar',
    'nao e possivel concluir apenas com os documentos apresentados',
    'documentos apresentados nao permitem'
  ];

  const wordCount = countWords(resumo);
  const hasInsufficientDocumentSignal = insufficientDocumentSignals.some((signal) => normalized.includes(signal));

  // PASSO 25.7O — Piso de palavras adaptativo:
  // - Se todas as 6 seções estão presentes, aceita respostas mais concisas (mínimo 200 palavras).
  // - Se alguma seção está ausente, mantém o piso de 600 palavras como guardrail.
  const effectiveMinWords = allSectionsPresent ? 200 : 600;
  if (wordCount < effectiveMinWords && !hasInsufficientDocumentSignal) {
    return `Resposta incompleta: parecer com ${wordCount} palavras, abaixo do mínimo esperado (${effectiveMinWords}).`;
  }

  const englishIndicators = [
    'public deed',
    'ownership',
    'chain of title',
    'risk classification',
    'missing documents',
    'recommendations',
    'registry events',
    'title deed'
  ];
  const englishHits = englishIndicators.filter((indicator) => normalized.includes(indicator));
  if (englishHits.length >= 2 || normalized.includes('public deed')) {
    return `Resposta inadequada: indícios de idioma estrangeiro (${englishHits.join(', ') || 'public deed'}).`;
  }

  // PASSO 25.7R — Detectar placeholders no formato [texto] (template genérico não preenchido)
  const placeholderPattern = /\[[^\]]{3,}\]/;
  if (placeholderPattern.test(resumo)) {
    const matches = resumo.match(/\[[^\]]{3,}\]/g) || [];
    const examples = matches.slice(0, 5).join(', ');
    return `Resposta rejeitada: template genérico detectado com placeholders não preenchidos (ex: ${examples}).`;
  }

  return null;
}

/**
 * PASSO 25.7I — Validação mínima do JSON estruturado de cadeia_dominial.
 *
 * Verifica: objeto raiz, documentos_analisados (array, length>=1),
 * resumo_cadeia_dominial (string não vazia), achados (array),
 * classificacao_risco.nivel (string), recomendacoes (array),
 * parecer_markdown (string não vazia), e ausência de idioma inglês.
 *
 * @returns null se válido, ou string com descrição do erro.
 */
function validateChainOfTitleJson(parsed: Record<string, any>): string | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'JSON inválido: objeto raiz não encontrado.';
  }

  if (!Array.isArray(parsed.documentos_analisados) || parsed.documentos_analisados.length < 1) {
    return 'JSON inválido: documentos_analisados ausente ou vazio.';
  }

  if (!parsed.resumo_cadeia_dominial || typeof parsed.resumo_cadeia_dominial !== 'string' || parsed.resumo_cadeia_dominial.trim().length === 0) {
    return 'JSON inválido: resumo_cadeia_dominial ausente ou vazio.';
  }

  if (!Array.isArray(parsed.achados)) {
    return 'JSON inválido: achados não é array.';
  }

  if (!parsed.classificacao_risco || typeof parsed.classificacao_risco !== 'object') {
    return 'JSON inválido: classificacao_risco ausente.';
  }

  if (!parsed.classificacao_risco.nivel || typeof parsed.classificacao_risco.nivel !== 'string') {
    return 'JSON inválido: classificacao_risco.nivel ausente.';
  }

  if (!Array.isArray(parsed.recomendacoes)) {
    return 'JSON inválido: recomendacoes não é array.';
  }

  if (!parsed.parecer_markdown || typeof parsed.parecer_markdown !== 'string' || parsed.parecer_markdown.trim().length === 0) {
    return 'JSON inválido: parecer_markdown ausente ou vazio.';
  }

  // Verificar idioma inglês
  const englishIndicators = [
    'public deed', 'ownership', 'chain of title', 'risk classification',
    'missing documents', 'recommendations', 'registry events', 'title deed',
    'findings', 'property', 'mortgage', 'lien', 'encumbrance'
  ];
  const textToCheck = (
    (parsed.resumo_cadeia_dominial || '') + ' ' +
    (parsed.parecer_markdown || '') + ' ' +
    JSON.stringify(parsed.achados || []) + ' ' +
    JSON.stringify(parsed.classificacao_risco || {})
  ).toLowerCase();
  const hits = englishIndicators.filter((ind) => textToCheck.includes(ind));
  if (hits.length >= 2) {
    return `JSON inválido: indícios de idioma estrangeiro (${hits.join(', ')}).`;
  }

  return null;
}

/**
 * PASSO 25.7I — Tenta parsear a resposta da IA como JSON estruturado.
 *
 * Estratégia:
 * 1. Tentar JSON.parse() direto da resposta bruta.
 * 2. Se falhar, tentar extrair o primeiro objeto JSON {...} do texto
 *    (a IA pode ter adicionado markdown ou texto ao redor).
 * 3. Se extrair, validar com validateChainOfTitleJson.
 *
 * @returns { success: true, data } ou { success: false, error }.
 */
function tryParseChainOfTitleJson(rawText: string): { success: true; data: Record<string, any> } | { success: false; error: string } {
  // PASSO 25.7O — Função helper para tentar parse + validar
  const attemptParse = (text: string): { success: true; data: Record<string, any> } | { success: false; error: string } => {
    try {
      const parsed = JSON.parse(text.trim());
      const validationError = validateChainOfTitleJson(parsed);
      if (!validationError) {
        return { success: true, data: parsed };
      }
      return { success: false, error: validationError };
    } catch (_) {
      return { success: false, error: 'Falha ao parsear JSON.' };
    }
  };

  // Tentativa 1: parse direto do texto bruto
  const directResult = attemptParse(rawText);
  if (directResult.success) return directResult;

  // Tentativa 2: remover crases markdown (```json ... ```) antes do parse
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const cleanedResult = attemptParse(cleaned);
  if (cleanedResult.success) return cleanedResult;

  // Tentativa 3: extrair primeiro objeto JSON {...} do texto
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extractedResult = attemptParse(jsonMatch[0]);
    if (extractedResult.success) return extractedResult;
    return { success: false, error: extractedResult.error };
  }

  return { success: false, error: directResult.error || 'Nenhum objeto JSON encontrado na resposta.' };
}

/**
 * PASSO 25.7I — Mapeia nível de risco do JSON estruturado para formato interno.
 */
function mapJsonRiskToLevel(nivel: string): RiskLevel {
  const n = (nivel || '').toLowerCase().trim();
  if (n === 'critico' || n === 'crítico') return 'Crítico';
  if (n === 'alto') return 'Alto';
  if (n === 'medio' || n === 'médio') return 'Médio';
  return 'Baixo';
}

/**
 * PASSO 25.7I — Converte achados do JSON estruturado para formato interno.
 */
function mapJsonAchadosToProblemas(achados: any[]): any[] {
  return (achados || []).map((a: any) => ({
    titulo: a.titulo || 'Achado',
    descricao: a.descricao || '',
    criticidade: mapJsonRiskToLevel(a.risco || 'medio'),
    recomendacao: a.providencia || '',
    base_documental: a.base_documental || '',
  }));
}

/**
 * PASSO 25.7I — Converte documentos_faltantes do JSON estruturado para formato interno.
 */
function mapJsonDocumentosFaltantes(docs: any[]): any[] {
  return (docs || []).map((d: any) => ({
    documento: d.documento || '',
    descricao: d.motivo || '',
  }));
}

/**
 * PASSO 25.7I — Converte recomendacoes do JSON estruturado para formato interno.
 */
function mapJsonRecomendacoes(recs: any[]): any[] {
  return (recs || []).map((r: any) => ({
    descricao: `${r.prioridade ? `[${r.prioridade.toUpperCase()}] ` : ''}${r.descricao || ''}`,
    prioridade: r.prioridade || 'media',
  }));
}

/**
 * Valida o JSON estruturado de matricula_individual.
 */
function validateMatriculaIndividualJson(parsed: Record<string, any>): string | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'JSON inválido: objeto raiz não encontrado.';
  }
  if (!parsed.identificacao || typeof parsed.identificacao !== 'object') {
    return 'JSON inválido: identificacao ausente.';
  }
  if (!Array.isArray(parsed.documentos_analisados) || parsed.documentos_analisados.length < 1) {
    return 'JSON inválido: documentos_analisados ausente ou vazio.';
  }
  if (!Array.isArray(parsed.atos_registrais)) {
    return 'JSON inválido: atos_registrais não é array.';
  }
  if (!Array.isArray(parsed.achados)) {
    return 'JSON inválido: achados não é array.';
  }
  if (!parsed.classificacao_risco || typeof parsed.classificacao_risco !== 'object') {
    return 'JSON inválido: classificacao_risco ausente.';
  }
  if (!parsed.classificacao_risco.nivel || typeof parsed.classificacao_risco.nivel !== 'string') {
    return 'JSON inválido: classificacao_risco.nivel ausente.';
  }
  if (!Array.isArray(parsed.recomendacoes)) {
    return 'JSON inválido: recomendacoes não é array.';
  }
  if (!parsed.parecer_markdown || typeof parsed.parecer_markdown !== 'string' || parsed.parecer_markdown.trim().length === 0) {
    return 'JSON inválido: parecer_markdown ausente ou vazio.';
  }
  const englishIndicators = [
    'public deed', 'ownership', 'chain of title', 'risk classification',
    'missing documents', 'recommendations', 'registry events', 'title deed',
    'findings', 'mortgage', 'lien', 'encumbrance'
  ];
  const textToCheck = (
    (parsed.parecer_markdown || '') + ' ' +
    JSON.stringify(parsed.achados || []) + ' ' +
    JSON.stringify(parsed.classificacao_risco || {})
  ).toLowerCase();
  const hits = englishIndicators.filter((ind) => textToCheck.includes(ind));
  if (hits.length >= 2) {
    return `JSON inválido: indícios de idioma estrangeiro (${hits.join(', ')}).`;
  }
  return null;
}

/**
 * Tenta parsear a resposta da IA como JSON estruturado de matricula_individual.
 */
function tryParseMatriculaIndividualJson(rawText: string): { success: true; data: Record<string, any> } | { success: false; error: string } {
  const attemptParse = (text: string): { success: true; data: Record<string, any> } | { success: false; error: string } => {
    try {
      const parsed = JSON.parse(text.trim());
      const validationError = validateMatriculaIndividualJson(parsed);
      if (!validationError) return { success: true, data: parsed };
      return { success: false, error: validationError };
    } catch (_) {
      return { success: false, error: 'Falha ao parsear JSON.' };
    }
  };

  const directResult = attemptParse(rawText);
  if (directResult.success) return directResult;

  const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const cleanedResult = attemptParse(cleaned);
  if (cleanedResult.success) return cleanedResult;

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extractedResult = attemptParse(jsonMatch[0]);
    if (extractedResult.success) return extractedResult;
    return { success: false, error: extractedResult.error };
  }

  return { success: false, error: directResult.error || 'Nenhum objeto JSON encontrado na resposta.' };
}

/**
 * Converte achados do JSON de matricula_individual para formato interno.
 */
function mapJsonMatriculaAchadosToProblemas(achados: any[]): any[] {
  return (achados || []).map((a: any) => ({
    titulo: a.titulo || 'Achado',
    descricao: a.descricao || '',
    criticidade: mapJsonRiskToLevel(a.risco || 'medio'),
    recomendacao: a.providencia || '',
    base_documental: a.base_documental || '',
    dimensao: a.dimensao || '',
  }));
}

/**
 * Executa passo de crítica sobre achados gerados pela IA (módulos texto-livre).
 * Segunda passagem: valida base documental, criticidade e duplicações.
 * Falha silenciosamente — retorna achados originais em caso de erro.
 */
async function runAchadosCritique(
  achados: any[],
  generateFn: typeof generateWithFallback
): Promise<{ achadosValidados: any[]; achadosRemovidos: any[]; alertas: string[] }> {
  if (!achados || achados.length === 0) {
    return { achadosValidados: [], achadosRemovidos: [], alertas: [] };
  }

  const critiquePrompt = `Você é um auditor jurídico sênior revisando achados de uma análise fundiária.

Revise os achados abaixo e retorne EXCLUSIVAMENTE um objeto JSON validando-os.

CRITÉRIOS DE REMOÇÃO (remova achados que violem qualquer critério):
1. base_documental é vaga, genérica ou ausente (ex: "matrícula", "documentos apresentados", "não consta") — exige referência específica como "R-3 da matrícula" ou "CCIR exercício 2022"
2. O achado descreve apenas ausência de documento sem consequência jurídica concreta
3. É recomendação disfarçada de achado (ex: "recomenda-se verificar", "sugere-se obter")
4. É duplicado ou muito similar a outro achado da lista
5. Criticidade "critico" ou "alto" sem descrição que justifique a severidade

CRITÉRIOS DE MANUTENÇÃO:
- Tem base documental específica com referência ao ato ou documento
- Descreve risco jurídico real com consequência identificável
- Criticidade coerente com a descrição

ACHADOS PARA REVISÃO:
${JSON.stringify(achados, null, 2)}

RESPONDA EXCLUSIVAMENTE COM ESTE JSON (sem markdown, sem texto fora do JSON):
{
  "achados_validados": [],
  "achados_removidos": [{"titulo": "...", "motivo_remocao": "base_documental vaga | recomendação disfarçada | duplicado | criticidade não justificada | ausência de consequência"}],
  "alertas_qualidade": ["...observações gerais sobre qualidade dos achados..."]
}`;

  try {
    const result = await generateFn([{ text: critiquePrompt }], {
      geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      maxOutputTokens: 2048,
      timeoutMs: 25000,
    });

    const rawText = result.text || '';
    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed || !Array.isArray(parsed.achados_validados)) {
      return { achadosValidados: achados, achadosRemovidos: [], alertas: [] };
    }

    // Sanity check: se critique removeu TODOS os achados, manter originais
    if (parsed.achados_validados.length === 0 && achados.length > 0) {
      return { achadosValidados: achados, achadosRemovidos: [], alertas: parsed.alertas_qualidade || [] };
    }

    return {
      achadosValidados: parsed.achados_validados,
      achadosRemovidos: Array.isArray(parsed.achados_removidos) ? parsed.achados_removidos : [],
      alertas: Array.isArray(parsed.alertas_qualidade) ? parsed.alertas_qualidade : [],
    };
  } catch (err: any) {
    console.warn('[Critique] Falha na revisão de achados (ignorada):', err?.message || err);
    return { achadosValidados: achados, achadosRemovidos: [], alertas: [] };
  }
}

// Parsers locais de arquivos geoespaciais
const parseKmlCoordinates = (kmlText: string): [number, number][] => {
  const coordsList: [number, number][] = [];
  const match = kmlText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (match && match[1]) {
    const rawCoords = match[1].trim();
    const points = rawCoords.split(/\s+/);
    for (const p of points) {
      if (!p) continue;
      const parts = p.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          coordsList.push([lat, lng]);
        }
      }
    }
  }
  return coordsList;
};

const parseGpxCoordinates = (gpxText: string): [number, number][] => {
  const coordsList: [number, number][] = [];
  const regex = /<(?:trkpt|wpt|rtept)\s+[^>]*lat=["'](-?\d+\.\d+)["']\s+[^>]*lon=["'](-?\d+\.\d+)["']/g;
  let match;
  while ((match = regex.exec(gpxText)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      coordsList.push([lat, lon]);
    }
  }
  if (coordsList.length === 0) {
    const regexAlt = /<(?:trkpt|wpt|rtept)\s+[^>]*lon=["'](-?\d+\.\d+)["']\s+[^>]*lat=["'](-?\d+\.\d+)["']/g;
    while ((match = regexAlt.exec(gpxText)) !== null) {
      const lon = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        coordsList.push([lat, lon]);
      }
    }
  }
  return coordsList;
};

/**
 * PASSO 25.8 — Detecta cadeia dominial incompleta com base no parecer e achados.
 *
 * Sinais de cadeia dominial frágil:
 * - Palavras-chave indicando histórico insuficiente (ex: "vintenária", "20 anos", "cadeia incompleta")
 * - Presença de achados no eixo DOM com criticidade alta ou média
 * - Referências a "sucessão", "herança", "inventário" como lacunas
 */
function detectarCadeiaDominialIncompleta(
  resumo: string,
  problemas: any[]
): boolean {
  const text = (resumo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const fragilidadeKeywords = [
    'cadeia dominial incompleta',
    'cadeia incompleta',
    'historico insuficiente',
    'menos de 20 anos',
    'vintenaria',
    'vintenaria nao comprovada',
    'nao foi possivel rastrear',
    'cadeia dominial fragil',
    'cadeia dominial insuficiente',
    'dominio nao comprovado',
    'dominio fragil',
    'transmissoes insuficientes',
    'falta de continuidade',
    'descontinuidade registral',
    'ausencia de registro anterior',
    'cadeia nao verificada',
  ];

  if (fragilidadeKeywords.some(kw => text.includes(kw))) {
    return true;
  }

  // Verificar achados no eixo DOM com criticidade alta/crítica
  const problemasDOM = (problemas || []).filter((p: any) => {
    const criticidade = (p.criticidade || '').toLowerCase();
    const descricao = (p.descricao || '').toLowerCase();
    const titulo = (p.titulo || '').toLowerCase();
    const combined = `${criticidade} ${descricao} ${titulo}`;
    return (
      (criticidade.includes('alto') || criticidade.includes('critico') || criticidade.includes('crítico')) &&
      (combined.includes('dominial') || combined.includes('cadeia') || combined.includes('sucessao') || combined.includes('heranca'))
    );
  });

  return problemasDOM.length > 0;
}

/**
 * PASSO 25.8 — Detecta fragilidade registral com base no parecer e achados.
 *
 * Sinais de fragilidade registral:
 * - Palavras-chave indicando matrícula precária (ex: "registro insuficiente", "matrícula sem atos",
 *   "ausência de registro", "fragilidade registral", "documentação precária")
 * - Achados no eixo REG com criticidade alta/crítica
 * - Referências a necessidade de complementação registral
 */
function detectarFragilidadeRegistral(
  resumo: string,
  problemas: any[]
): boolean {
  const text = (resumo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const fragilidadeKeywords = [
    'fragilidade registral',
    'registro insuficiente',
    'matricula sem atos',
    'ausencia de registro',
    'documentacao precaria',
    'registro precario',
    'matricula precaria',
    'documentacao insuficiente',
    'certidao vencida',
    'certidao incompleta',
    'falta averbacao',
    'averbacao pendente',
    'registro desatualizado',
    'matricula desatualizada',
    'divergencia registral',
    'registro fragil',
    'necessario complementar com',
    'recomenda-se complementar',
    'complementacao registral',
    'registro complementar',
  ];

  if (fragilidadeKeywords.some(kw => text.includes(kw))) {
    return true;
  }

  // Verificar achados no eixo REG com criticidade alta/crítica
  const problemasREG = (problemas || []).filter((p: any) => {
    const criticidade = (p.criticidade || '').toLowerCase();
    const descricao = (p.descricao || '').toLowerCase();
    const titulo = (p.titulo || '').toLowerCase();
    const combined = `${criticidade} ${descricao} ${titulo}`;
    return (
      (criticidade.includes('alto') || criticidade.includes('critico') || criticidade.includes('crítico')) &&
      (combined.includes('registro') || combined.includes('registral') || combined.includes('matricula') ||
       combined.includes('averbacao') || combined.includes('cartorio') || combined.includes('onus') ||
       combined.includes('penhora') || combined.includes('bloqueio'))
    );
  });

  return problemasREG.length > 0;
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Cabeçalho de autorização ausente' }, { status: 401 });
    }

    const { createSupabaseServerClient } = await import('@/lib/supabaseServer');
    const supabaseUser = await createSupabaseServerClient();

    let { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    
    // Fallback resiliente: se a sessão via cookie falhar, validar o token JWT enviado no Header
    if (authError || !user) {
      const token = authHeader.replace('Bearer ', '').trim();
      const supabaseAdminTemp = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: { user: headerUser }, error: headerError } = await supabaseAdminTemp.auth.getUser(token);
      if (headerError || !headerUser) {
        return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 });
      }
      user = headerUser;
    }

    const body = await req.json();
    const { analysisId, forceRetry } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId não informado' }, { status: 400 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Consultar a análise
    console.log('[Analyze API] Consultando análise no banco. ID:', analysisId);
    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from('analyses')
      .select('id, user_id, status, property_id, findings')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      console.warn('[Analyze API] Análise não encontrada. Erro:', fetchError?.message || 'Sem dados');
      return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 });
    }

    // Validação de ownership
    if (analysis.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado: a análise não pertence ao usuário' }, { status: 403 });
    }

    // Consultar Assinatura Centralizada (inclui lógica de internal_test)
    const { getUserSubscription } = await import('@/lib/subscriptions');
    const userSubData = await getUserSubscription(user.id, supabaseAdmin);
    const planType = userSubData.plan_type;

    // Validação de status atual
    const currentStatus = (analysis.status || '').toLowerCase().trim();

    const findings = analysis.findings || {};
    if (currentStatus === 'processing') {
      return NextResponse.json({ error: 'Esta análise já está em processamento.' }, { status: 409 });
    }

    // Validação de reprocessamento: se retry_exhausted, só permite com forceRetry explícito
    const isRetryExhausted = findings.retry_exhausted === true;
    if (currentStatus === 'error' && isRetryExhausted && !forceRetry) {
      return NextResponse.json({ error: 'Esta análise exauriu as tentativas de reprocessamento. Use forceRetry para tentar novamente.' }, { status: 400 });
    }

    const validStatuses = ['ready_for_processing', 'payment_pending', 'pending', 'error'];
    if (!validStatuses.includes(currentStatus)) {
      return NextResponse.json({ error: 'Status atual inválido para iniciar processamento' }, { status: 400 });
    }

    // Validação de propriedade e findings
    if (!analysis.property_id) {
      return NextResponse.json({ error: 'Propriedade não associada a esta análise' }, { status: 400 });
    }

    const selectedModules = findings.selected_modules;
    if (!selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
      return NextResponse.json({ error: 'Nenhum módulo selecionado para auditoria' }, { status: 400 });
    }

    // FASE 3 — Se esta é uma análise filha (tem parent_analysis_id), filtrar módulos já processados no pai
    const parentCaseFile = findings.case_file;
    const parentModuleResults = parentCaseFile?.module_results || {};
    const parentCompletedModules = Object.keys(parentModuleResults).filter(
      (modId) => parentModuleResults[modId]?.status === 'completed'
    );
    
    // Filtrar selected_modules para remover módulos já concluídos na análise pai
    const modulesToProcess = selectedModules.filter(
      (modId: string) => !parentCompletedModules.includes(modId)
    );
    
    if (modulesToProcess.length === 0) {
      return NextResponse.json({ 
        error: 'Todos os módulos selecionados já foram processados na análise pai. Nenhum módulo novo para processar.' 
      }, { status: 400 });
    }

    const { data: propertyData } = await supabaseAdmin
      .from('properties')
      .select('name, state, city, area, cpf_cnpj, car_number')
      .eq('id', analysis.property_id)
      .maybeSingle();

    // Buscar os documentos vinculados
    const { data: documents, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('property_id', analysis.property_id);

    if (docError) {
      return NextResponse.json({ error: 'Erro ao obter documentos da propriedade: ' + docError.message }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'Nenhum documento anexado para a análise da propriedade' }, { status: 400 });
    }

    // --- FASE P2: DOWNLOAD PRÉVIO E CONTAGEM DE PÁGINAS ---
    const downloadResults = await Promise.all(
      documents.map(async (doc) => {
        const downloadPromise = supabaseAdmin.storage.from('documents').download(doc.file_path);
        const { data: fileData, error: downloadError } = await withTimeout(
          downloadPromise,
          10000,
          `download_${doc.file_path}`
        );
        return { doc, fileData, downloadError };
      })
    );

    let totalPages = 0;
    const { countPdfPagesFromBuffer } = await import('@/lib/pdf/pageCounter.server');

    for (const { doc, fileData, downloadError } of downloadResults) {
      if (downloadError || !fileData) {
        return NextResponse.json({ error: `Falha no download do documento: ${doc.file_path}` }, { status: 500 });
      }
      
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      (doc as any)._prefetchedBuffer = buffer;

      if (doc.file_path.toLowerCase().endsWith('.pdf') || doc.document_type?.toLowerCase().includes('matrícula') || doc.document_type === 'Certidão Inteiro Teor' || doc.document_type === 'Matrícula') {
        let pages = await countPdfPagesFromBuffer(buffer);
        // Fallback tolerante para PDFs escaneados (imagens) sem marcação de páginas no binário de texto
        if (pages <= 1 && buffer.length > 3.5 * 1024 * 1024) {
          pages = Math.max(1, Math.floor(buffer.length / (1.5 * 1024 * 1024))); // Estimativa conservadora de 1.5MB por página
        }
        totalPages += pages;
      } else {
        totalPages += 1;
      }
    }

    // Consultar Saldo a partir do userSubData já obtido
    const availablePages = userSubData.credits_available || 0;

    if (totalPages > availablePages) {
      const updatedFindings = {
        ...findings,
        required_pages: totalPages,
        shortage_pages: totalPages - availablePages
      };
      await supabaseAdmin.from('analyses').update({
        status: 'payment_pending',
        findings: updatedFindings
      }).eq('id', analysisId);

      return NextResponse.json({ 
        error: `O número de páginas do documento excede o seu saldo disponível (${availablePages} páginas restantes).`,
        blockInfo: { available: availablePages, required: totalPages, shortage: totalPages - availablePages }
      }, { status: 403 });
    }

    // REMOVIDO P0: Consumir páginas prematuramente.
    // A dedução ocorrerá exclusivamente após o sucesso (status: 'completed').
    // ----------------------------------------------------

    const caseFileDocuments: CaseFileDocument[] = documents.map((doc: any) => ({
      name: doc.file_path?.split('/').pop() || doc.file_path || 'Documento',
      type: doc.document_type || null,
      storage_path: doc.file_path || null,
      size: null,
      uploaded_at: doc.created_at || null
    }));

    const findingsWithCaseFile = withEnsuredCaseFile(findings, {
      property: {
        name: propertyData?.name || null,
        state: propertyData?.state || null,
        city: propertyData?.city || null,
        car_number: propertyData?.car_number || null,
        declared_area_ha: propertyData?.area ?? null,
        owner_document: propertyData?.cpf_cnpj || null
      },
      documents: caseFileDocuments
    });

    // FASE 5 — Inicializar processing_stages se não existir
    const hasProcessingStages = findingsWithCaseFile.case_file.processing_stages?.enabled === true
      && Array.isArray(findingsWithCaseFile.case_file.processing_stages.stages)
      && findingsWithCaseFile.case_file.processing_stages.stages.length > 0;

    let effectiveModulesToProcess = modulesToProcess;
    let currentStageId: string | null = null;
    let processingStages: ProcessingStages;

    if (!hasProcessingStages) {
      // Inicializar a estrutura de processing_stages a partir dos módulos a processar
      processingStages = initializeProcessingStages(modulesToProcess);
    } else {
      processingStages = findingsWithCaseFile.case_file.processing_stages! as ProcessingStages;
    }

    // Obter etapa atual (se houver processing_stages ativo)
    const currentStage = getCurrentStage(processingStages);
    if (currentStage) {
      currentStageId = currentStage.stage_id;
      // Filtrar módulos para processar APENAS o módulo da etapa atual
      effectiveModulesToProcess = modulesToProcess.filter((m) => m === currentStageId);
      if (effectiveModulesToProcess.length === 0) {
        // O módulo da etapa atual não está em modulesToProcess; pular para próxima etapa
        // Mas isso não deveria ocorrer em fluxo normal; logar e continuar com o que tem
        console.warn(`[ProcessingStages] Etapa atual ${currentStageId} não encontrada em modulesToProcess. Prosseguindo sem stage.`);
        currentStageId = null;
        effectiveModulesToProcess = modulesToProcess;
      }
    }

    const processingStartedAt = new Date().toISOString();
    const retryStartState = forceRetry && findings.retry_exhausted
      ? { available: false, exhausted: false, retry_count: 0, last_reset_at: new Date().toISOString(), forced: true }
      : null;

    // FASE 5 — Marcar etapa atual como "processing" se houver stage
    if (currentStageId) {
      processingStages = {
        ...processingStages,
        stages: markStageProcessing(processingStages, currentStageId, processingStartedAt),
      };
    }

    // 1. Atualizar para "processing" e iniciar log
    const updatedFindings = {
      ...findingsWithCaseFile,
      retry_available: false,
      retry_reason: null,
      ...(retryStartState ? { retry_state: retryStartState } : {}),
      case_file: {
        ...findingsWithCaseFile.case_file,
        ...(retryStartState ? { retry_state: retryStartState } : {}),
        // FASE 5 — Salvar processing_stages no case_file
        processing_stages: processingStages,
      },
      current_step: currentStageId
        ? `Processamento da etapa: ${processingStages.stages.find(s => s.stage_id === currentStageId)?.stage_name || currentStageId}`
        : "Processamento de IA iniciado.",
      processing_started_at: processingStartedAt
    };

    const { error: startUpdateError } = await supabaseAdmin
      .from('analyses')
      .update({
        status: 'processing',
        findings: updatedFindings
      })
      .eq('id', analysisId);

    if (startUpdateError) {
      return NextResponse.json({ error: 'Erro ao transicionar para processando: ' + startUpdateError.message }, { status: 500 });
    }

    // Registrar telemetria: trial_started
    if (planType === 'trial') {
      try {
        const { trackTrialEvent } = await import('@/lib/trial/trialControl');
        await trackTrialEvent(user.id, 'trial_started', { analysisId }, user.email || '');
      } catch (e) {
        console.warn('Erro de fail-safe (ignorado): falha ao trackear trial_started:', e);
      }
    }

        // Auto-detect per PDF: always try text extraction first, fall back to binary for scanned/empty PDFs
        const pdfMode: string = 'auto';
        const useMarkdownPipeline = true;
        let pdfExtractionDiags: {
          total_pdfs: number;
          markdown_success: number;
          binary_fallback: number;
          scanned_count: number;
          empty_count: number;
          extraction_total_ms: number;
          warnings: string[];
        } = {
          total_pdfs: 0,
          markdown_success: 0,
          binary_fallback: 0,
          scanned_count: 0,
          empty_count: 0,
          extraction_total_ms: 0,
          warnings: [],
        };

        const runBackground = async () => {
      // PASSO 25.7O — Variáveis de diagnóstico (hoisted para scope do catch)
      let validationPath: 'json_first' | 'textual_fallback' | 'none' = 'none';
      let markdownResponse = "";
      // PASSO 25.7Q — Flag de debug para observabilidade do payload/resposta
      const debugPayloadEnabled = process.env.PDF_MARKDOWN_DEBUG === '1';

      try {
        const startedAt = Date.now();
        let geminiMs = 0;
        let geminiParts: any[] = [];
        let polygonCoords: [number, number][] = [];

        // Os downloads já foram feitos na Fase P2, reaproveitando buffers:
        for (const { doc } of downloadResults) {
          const buffer = (doc as any)._prefetchedBuffer;
          if (!buffer) continue;

          const isKml = doc.file_path.toLowerCase().endsWith('.kml') || doc.document_type === 'KML' || doc.document_type?.includes('KML');
          const isGpx = doc.file_path.toLowerCase().endsWith('.gpx') || doc.document_type === 'GPX' || doc.document_type?.includes('GPX');

          if (isKml || isGpx) {
            try {
              const textContent = buffer.toString('utf-8');
              const coords = isKml ? parseKmlCoordinates(textContent) : parseGpxCoordinates(textContent);
              if (coords.length > 0) {
                polygonCoords = coords;
              }
            } catch (e) {
              console.error("[Geo Parser] Erro ao ler arquivo KML/GPX:", e);
            }
          }
          
          if (doc.file_path.toLowerCase().endsWith('.pdf') || doc.document_type?.toLowerCase().includes('matrícula') || doc.document_type === 'Certidão Inteiro Teor' || doc.document_type === 'Matrícula') {
            pdfExtractionDiags.total_pdfs++;

            // ── Pipeline Markdown (ativado via PDF_EXTRACTION_MODE) ──
            if (useMarkdownPipeline) {
              let usedMarkdown = false;
              try {
                const { extractTextFromPdfBuffer } = await import('@/lib/pdf/textExtractor.server');
                const { normalizePdfTextToMarkdown } = await import('@/lib/pdf/markdownNormalizer');

                const extraction = await extractTextFromPdfBuffer(buffer, { maxPages: 50 });
                pdfExtractionDiags.extraction_total_ms += extraction.extractionDurationMs;

                const docName = doc.file_path?.split('/').pop() || null;
                const docType = doc.document_type || null;

                if (extraction.isScanned) {
                  pdfExtractionDiags.scanned_count++;
                  pdfExtractionDiags.warnings.push(
                    `PDF escaneado (sem texto digital): ${docName || docType || 'documento'} — usando fallback binário.`
                  );
                } else if (!extraction.hasExtractableText) {
                  pdfExtractionDiags.empty_count++;
                  pdfExtractionDiags.warnings.push(
                    `PDF sem texto extraível: ${docName || docType || 'documento'} — usando fallback binário.`
                  );
                } else {
                  // Extração bem-sucedida: normalizar para Markdown
                  const markdownContent = normalizePdfTextToMarkdown(extraction, {
                    docIndex: pdfExtractionDiags.markdown_success + 1,
                    docType,
                    docName,
                  });

                  if (markdownContent && markdownContent.trim().length > 0) {
                    geminiParts.push({
                      text: markdownContent,
                    });
                    geminiParts.push({
                      text: `\n[Nota: O texto acima foi extraído do PDF: ${docType || docName || 'Documento'} — ${extraction.pageCount} página(s)]\n`,
                    });
                    pdfExtractionDiags.markdown_success++;
                    usedMarkdown = true;
                  } else {
                    // Markdown vazio após normalização (ex: PDF com pouquíssimo texto)
                    pdfExtractionDiags.empty_count++;
                    pdfExtractionDiags.warnings.push(
                      `Markdown vazio após normalização: ${docName || docType || 'documento'} — usando fallback binário.`
                    );
                  }
                }
              } catch (extractErr: any) {
                console.warn('[PDF Extraction] Erro ao extrair texto do PDF:', extractErr?.message || extractErr);
                pdfExtractionDiags.warnings.push(
                  `Erro na extração de: ${doc.file_path?.split('/').pop() || doc.document_type || 'documento'} — usando fallback binário.`
                );
              }

              // Fallback para binary se markdown não funcionou
              if (!usedMarkdown) {
                pdfExtractionDiags.binary_fallback++;
                const base64Data = buffer.toString('base64');
                geminiParts.push({
                  inlineData: {
                    data: base64Data,
                    mimeType: "application/pdf",
                  },
                });
                geminiParts.push({
                  text: `\n[Nota: O arquivo PDF visualizado acima representa: ${doc.document_type}]\n`,
                });
              }
            } else {
              // ── Pipeline Binary (default) ──
              const base64Data = buffer.toString('base64');
              geminiParts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: "application/pdf"
                }
              });
              geminiParts.push({
                text: `\n[Nota: O arquivo PDF visualizado acima representa: ${doc.document_type}]\n`
              });
            }
          }
        }

        if (geminiParts.length === 0 && polygonCoords.length === 0) {
          throw new Error('Documentos ilegíveis ou insuficientes para análise fundiária');
        }

        // FASE 3 — Calcular amountPaid apenas para módulos novos (não processados no pai)
        const amountPaid = modulesToProcess.reduce((acc: number, mod: string) => acc + (MODULE_PRICES[mod] || 0), 0);

        // Normalização em memória para montagem do prompt
        const normalizedModules = Array.from(new Set(selectedModules.map((m: string) => {
          if (m === "titulos_incra") return "origem_publica";
          if (m === "registros") return "cadeia_dominial";
          if (m === "nulidades" || m === "forense") return "nulidades_fraudes";
          if (m === "cruzamento") return "cruzamento_total";
          return m;
        })));
        const isFastChainOfTitleOnly = normalizedModules.length === 1 && normalizedModules[0] === "cadeia_dominial";
        const isMatriculaIndividualOnly = normalizedModules.length === 1 && normalizedModules[0] === "matricula_individual";
        
        const instructions = buildLegalAuditPrompt(normalizedModules, documents);

        // Para matrículas densas, adicionar instrução de concisão ao prompt
        const pdfPartsCountForPrompt = geminiParts.filter(p => p.inlineData?.mimeType === 'application/pdf').length;
        if (pdfPartsCountForPrompt >= 2) {
          const denseSuffix = `\n\nATENÇÃO: Os documentos anexados são densos e extensos. Produza o parecer de forma objetiva e concisa, focando nos pontos juridicamente relevantes. Evite transcrições longas de atos repetitivos. Agrupe eventos por período. Limite a resposta a no máximo 2.000 palavras. Priorize qualidade sobre volume.`;
          geminiParts.unshift({ text: instructions + denseSuffix });
        } else {
          geminiParts.unshift({ text: instructions });
        }

        // PASSO 25.7Q — Debug: log da estrutura do payload enviado para a IA
        if (debugPayloadEnabled) {
          const payloadSummary = geminiParts.map((p, i) => {
            if (p.text) {
              const textPreview = typeof p.text === 'string' ? `${p.text.length} chars` : 'non-string';
              return { index: i, type: 'text', size: textPreview, preview: (typeof p.text === 'string' ? p.text.slice(0, 200) : 'non-string-text') };
            }
            if (p.inlineData) {
              return { index: i, type: 'inlineData', mimeType: p.inlineData.mimeType, base64Length: p.inlineData.data?.length || 0 };
            }
            return { index: i, type: 'unknown' };
          });
          console.log('[PDF_MARKDOWN_DEBUG] Payload structure:', JSON.stringify({
            totalParts: geminiParts.length,
            parts: payloadSummary,
            isFastChainOfTitleOnly,
            useMarkdownPipeline,
            pdfMode,
          }, null, 2));
        }

        let providerUsed: AiProvider = 'gemini';
        let fallbackTriggered = false;
        let fallbackReason: string | null = null;

        if (geminiParts.length > 1) {
          await supabaseAdmin
            .from('analyses')
            .update({ findings: { ...updatedFindings, current_step: "Sintetizando Parecer Técnico Forense com Inteligência Artificial..." } })
            .eq('id', analysisId);

          // Detectar documentos densos: múltiplos PDFs ou muitos parts (>6 indica matrícula densa)
          const pdfPartsCount = geminiParts.filter(p => p.inlineData?.mimeType === 'application/pdf').length;
          const isDenseDocument = pdfPartsCount >= 3 || geminiParts.length > 12;

          // Timeout adaptativo: 110s para documentos densos, 90s para documentos simples
          const aiTimeoutMs = isDenseDocument ? 110000 : 90000;

          const result: FallbackResult = await generateWithFallback(geminiParts, {
            geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
            ...(isFastChainOfTitleOnly ? { maxOutputTokens: 4096 } : {}),
            timeoutMs: aiTimeoutMs,
          });

          markdownResponse = result.text;
          geminiMs = result.duration_ms;
          providerUsed = result.provider_used;
          fallbackTriggered = result.fallback_triggered;
          fallbackReason = result.fallback_reason;
        } else {
          markdownResponse = `### PARECER TÉCNICO GEOESPACIAL (APENAS GEOMETRIA KML/GPX)\n\nFoi efetuado o upload de arquivo de geometria de limites físicos e georreferenciamento em formato digital nativo. Não foram inseridas matrículas textuais em PDF para análise textual.\n\n* **Limite Físico Importado:** ${polygonCoords.length} pontos de curva detectados.\n* **Status de Integração:** Geometria disponível no visualizador de mapas 3D.`;
        }

        // PASSO 25.7Q — Debug: log da resposta bruta da IA
        if (debugPayloadEnabled) {
          console.log('[PDF_MARKDOWN_DEBUG] AI raw response:', JSON.stringify({
            responseLength: markdownResponse.length,
            responseWords: countWords(markdownResponse),
            providerUsed,
            fallbackTriggered,
            fallbackReason,
            durationMs: geminiMs,
            preview: markdownResponse.slice(0, 2000),
          }, null, 2));
        }

        // PASSO 25.7R — Capturar raw_ai_response_preview universal (caminho de sucesso ou erro)
        const rawAiPreview = (markdownResponse && markdownResponse.length > 0 ? markdownResponse.slice(0, 2000) : null);

        // Validar retorno da IA
        if (!markdownResponse || markdownResponse.trim().length < 120 || markdownResponse.includes("PLACEHOLDER")) {
          const shortResponseError = new Error("A IA gerou um laudo incompleto ou muito curto.");
          (shortResponseError as any).rawAiResponsePreview = rawAiPreview;
          (shortResponseError as any).technicalErrorType = 'ai_incomplete_response';
          throw shortResponseError;
        }

        // PASSO 25.7R — Detectar placeholders no formato [texto] (template genérico) logo na validação inicial
        const bracketPlaceholderPattern = /\[[^\]]{3,}\]/;
        if (bracketPlaceholderPattern.test(markdownResponse) && !isFastChainOfTitleOnly) {
          // Para módulos não-cadeia_dominial, placeholder com colchetes é tratado como erro imediato
          const matches = markdownResponse.match(/\[[^\]]{3,}\]/g) || [];
          const placeholderError = new Error(`Template genérico detectado com placeholders não preenchidos (ex: ${matches.slice(0, 3).join(', ')}).`);
          (placeholderError as any).rawAiResponsePreview = rawAiPreview;
          (placeholderError as any).technicalErrorType = 'ai_incomplete_response';
          throw placeholderError;
        }

        // PASSO 25.7O — chainOfTitleJsonParsed para uso no pós-processamento
        let chainOfTitleJsonParsed: Record<string, any> | null = null;
        let matriculaIndividualJsonParsed: Record<string, any> | null = null;

        if (isFastChainOfTitleOnly) {
          // PASSO 25.7I — Tentar parsing JSON estruturado primeiro
          const jsonParseResult = tryParseChainOfTitleJson(markdownResponse);
          
          if (jsonParseResult.success) {
            chainOfTitleJsonParsed = jsonParseResult.data;
            // Substituir markdownResponse pelo parecer_markdown do JSON
            markdownResponse = chainOfTitleJsonParsed.parecer_markdown;
            validationPath = 'json_first';
            console.log('[Analyze API] PASSO 25.7O — JSON estruturado parseado com sucesso para cadeia_dominial');
          } else {
            // PASSO 25.7I — Fallback textual: JSON inválido/incompleto
            validationPath = 'textual_fallback';
            console.warn('[Analyze API] PASSO 25.7O — JSON inválido/incompleto:', jsonParseResult.error);
            console.warn('[Analyze API] PASSO 25.7O — Usando fallback textual (validateFastChainOfTitleResponse)');
            
            const fastQualityIssue = validateFastChainOfTitleResponse(markdownResponse);
            if (fastQualityIssue) {
              const qualityError = new Error(fastQualityIssue);
              (qualityError as any).technicalErrorType = 'ai_incomplete_response';
              (qualityError as any).userMessage = 'A IA retornou um parecer incompleto. Tente reprocessar.';
              (qualityError as any).findingsCurrentStep = 'A IA retornou um parecer incompleto. Tente reprocessar.';
              (qualityError as any).rawAiResponsePreview = markdownResponse.slice(0, 2000);
              (qualityError as any).validationPath = validationPath;
              (qualityError as any).jsonParseError = jsonParseResult.error;
              throw qualityError;
            }
          }
        }

        if (isMatriculaIndividualOnly) {
          const jsonParseResult = tryParseMatriculaIndividualJson(markdownResponse);
          if (jsonParseResult.success) {
            matriculaIndividualJsonParsed = jsonParseResult.data;
            markdownResponse = matriculaIndividualJsonParsed.parecer_markdown;
            validationPath = 'json_first';
            console.log('[Analyze API] matricula_individual — JSON estruturado parseado com sucesso');
          } else {
            validationPath = 'textual_fallback';
            console.warn('[Analyze API] matricula_individual — JSON inválido, fallback textual:', jsonParseResult.error);
          }
        }

        let riskLevel: RiskLevel;
        let riskLevelSource: RiskLevelSource;

        if (chainOfTitleJsonParsed) {
          // PASSO 25.7I — Risk level do JSON estruturado (cadeia_dominial)
          riskLevel = mapJsonRiskToLevel(chainOfTitleJsonParsed.classificacao_risco.nivel);
          riskLevelSource = 'ai_json' as RiskLevelSource;
        } else if (matriculaIndividualJsonParsed) {
          riskLevel = mapJsonRiskToLevel(matriculaIndividualJsonParsed.classificacao_risco.nivel);
          riskLevelSource = 'ai_json' as RiskLevelSource;
        } else {
          const derivedRisk = deriveRiskLevelFromResumo(markdownResponse);
          riskLevel = derivedRisk.level;
          riskLevelSource = derivedRisk.source;
        }

        let latitude: number | null = null;
        let longitude: number | null = null;

        if (polygonCoords.length > 0) {
          let latSum = 0;
          let lngSum = 0;
          for (const c of polygonCoords) {
            latSum += c[0];
            lngSum += c[1];
          }
          latitude = latSum / polygonCoords.length;
          longitude = lngSum / polygonCoords.length;
        }

        const coordsMatch = markdownResponse.match(/COORDS:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
        if (coordsMatch) {
          if (polygonCoords.length === 0) {
            latitude = parseFloat(coordsMatch[1]);
            longitude = parseFloat(coordsMatch[2]);
          }
          markdownResponse = markdownResponse.replace(/COORDS:\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+/i, '').trim();
        }

        // FASE 5 — Marcar etapa atual como concluída (se houver stage)
        const stageCompletedAt = new Date().toISOString();
        let allStagesCompleted = false;
        let hasMoreStages = false;

        if (currentStageId) {
          // FASE 5.1 — Registrar provider info no stage
          processingStages = {
            ...processingStages,
            stages: markStageProviderInfo(processingStages, currentStageId, {
              provider_used: providerUsed,
              fallback_triggered: fallbackTriggered,
              fallback_reason: fallbackReason,
            }),
          };

          // Extrair resumo curto (primeiras 200 chars do primeiro parágrafo relevante)
          const stageSummary = markdownResponse
            .replace(/^#+\s+/gm, '')
            .split(/\n\n/)[0]
            ?.slice(0, 200)
            ?.trim() || `Etapa ${currentStageId} concluída`;

          processingStages = {
            ...processingStages,
            stages: markStageCompleted(processingStages, currentStageId, stageSummary, stageCompletedAt),
          };

          allStagesCompleted = isProcessingFinished(processingStages);
          hasMoreStages = !allStagesCompleted && getCurrentStage(processingStages) !== null;
        }

        // Se há mais etapas pendentes, salvar progresso e voltar para ready_for_processing
        if (hasMoreStages) {
          const partialFindings = {
            ...updatedFindings,
            current_step: `Etapa ${currentStageId} concluída. Aguardando processamento da próxima etapa.`,
            processing_stage_completed_at: stageCompletedAt,
            case_file: {
              ...updatedFindings.case_file,
              provider_used: providerUsed,
              fallback_triggered: fallbackTriggered,
              fallback_reason: fallbackReason,
              processing_stages: processingStages,
            },
          };

          await supabaseAdmin
            .from('analyses')
            .update({
              status: 'ready_for_processing',
              findings: partialFindings
            })
            .eq('id', analysisId);

          return;
        }

        // Fluxo normal: todas as etapas concluídas (ou sem stage)
        const completedAt = new Date().toISOString();
        const postprocessStartAt = Date.now();
        const resultJson = {
          ...updatedFindings,
          // PASSO 25.3 — Diagnóstico de extração PDF
          pdf_extraction_mode: pdfMode,
          pdf_extraction_diagnostics: pdfExtractionDiags,
          // PASSO 25.7R — Diagnóstico de validação no caminho de sucesso
          ...(validationPath && validationPath !== 'none' ? { validation_path: validationPath } : {}),
          ...(rawAiPreview ? { raw_ai_response_preview: rawAiPreview } : {}),
          isHtmlResumo: false,
          resumo: markdownResponse,
          problemas: [],
          recomendacoes: [],
          documentosFaltantes: [],
          linhaDoTempo: [],
          checklist: [],
          amountPaid: amountPaid,
          modulesSelected: selectedModules,
          latitude,
          longitude,
          polygon: polygonCoords.length > 0 ? polygonCoords : null,
          current_step: "Parecer técnico concluído.",
          completed_at: completedAt,
          risk_level_source: riskLevelSource,
          ...(riskLevelSource === 'ai_section' ? { risk_level_detected_at: completedAt } : {}),
          processing_metrics: {
            gemini_ms: geminiMs,
            total_ms: Date.now() - startedAt
          },
          case_file: {
            ...updatedFindings.case_file,
            provider_used: providerUsed,
            fallback_triggered: fallbackTriggered,
            fallback_reason: fallbackReason,
            processing_stages: processingStages,
          },
        };

        // Dedução de páginas (nova regra: consumido APENAS após sucesso)
        if (planType !== 'internal_test' && !resultJson.pages_consumed) {
           const { consumePages } = await import('@/lib/subscriptions');
           try {
              const consumed = await consumePages(user.id, totalPages, supabaseAdmin);
              if (consumed) {
                 resultJson.pages_consumed = true;
              } else {
                 const err = new Error('Não foi possível concluir a análise porque o saldo de páginas ficou insuficiente no fechamento. Compre mais páginas e tente novamente.');
                 (err as any).technicalErrorType = 'insufficient_balance';
                 (err as any).findingsCurrentStep = 'Saldo insuficiente no fechamento.';
                 throw err;
              }
           } catch (pageErr: any) {
              // Se o erro já tem technicalErrorType (ex: insufficient_balance), propagar diretamente
              if (pageErr.technicalErrorType) {
                 throw pageErr;
              }
              // Erro de infraestrutura/RPC (Supabase indisponível, function not found, rede, etc.)
              // NÃO é falha de IA — é falha do sistema de assinaturas.
              console.error('[Background] Erro de infraestrutura no consumePages:', pageErr?.message || pageErr);
              const infraErr = new Error('Erro no sistema de assinaturas ao debitar páginas. Tente novamente em instantes.');
              (infraErr as any).technicalErrorType = 'subscription_infrastructure_error';
              (infraErr as any).findingsCurrentStep = 'Falha no sistema de assinaturas ao debitar páginas.';
              (infraErr as any).cause = pageErr;
              throw infraErr;
           }
        }

        await supabaseAdmin
          .from('analyses')
          .update({
            status: 'completed',
            risk_level: riskLevel,
            findings: resultJson
          })
          .eq('id', analysisId);

        try {
          // PASSO 25.7I — Usar dados do JSON estruturado se disponível, senão extratores textuais
          let parsedProblemas: any[];
          let parsedDocumentosFaltantes: any[];
          let parsedRecomendacoes: any[];
          let parsedAchados: any[] | null = null;

          let critiqueResult: { achadosRemovidos: any[]; alertas: string[] } = { achadosRemovidos: [], alertas: [] };

          if (chainOfTitleJsonParsed) {
            parsedProblemas = mapJsonAchadosToProblemas(chainOfTitleJsonParsed.achados || []);
            parsedDocumentosFaltantes = mapJsonDocumentosFaltantes(chainOfTitleJsonParsed.documentos_faltantes || []);
            parsedRecomendacoes = mapJsonRecomendacoes(chainOfTitleJsonParsed.recomendacoes || []);
            parsedAchados = chainOfTitleJsonParsed.achados || [];
          } else if (matriculaIndividualJsonParsed) {
            parsedProblemas = mapJsonMatriculaAchadosToProblemas(matriculaIndividualJsonParsed.achados || []);
            parsedDocumentosFaltantes = mapJsonDocumentosFaltantes(matriculaIndividualJsonParsed.documentos_faltantes || []);
            parsedRecomendacoes = mapJsonRecomendacoes(matriculaIndividualJsonParsed.recomendacoes || []);
            parsedAchados = matriculaIndividualJsonParsed.achados || [];
          } else {
            parsedProblemas = extractProblemsFromReport(markdownResponse);
            parsedDocumentosFaltantes = extractMissingDocumentsFromReport(markdownResponse);
            parsedRecomendacoes = extractRecommendationsFromReport(markdownResponse);

            // Crítica de achados — apenas para módulos texto-livre (sem JSON schema)
            if (parsedProblemas.length > 0) {
              const critiqueOutput = await runAchadosCritique(parsedProblemas, generateWithFallback);
              parsedProblemas = critiqueOutput.achadosValidados;
              critiqueResult = { achadosRemovidos: critiqueOutput.achadosRemovidos, alertas: critiqueOutput.alertas };
            }
          }
          const postprocessMs = Date.now() - postprocessStartAt;
          const totalMs = Date.now() - startedAt;
          let caseFileExtractError: string | null = null;
          let enrichedCaseFile = resultJson.case_file;

          try {
            enrichedCaseFile = updateCaseFileWithBasicFacts(resultJson.case_file, {
              now: new Date().toISOString(),
              property: {
                name: propertyData?.name || null,
                state: propertyData?.state || null,
                city: propertyData?.city || null,
                car_number: propertyData?.car_number || null,
                declared_area_ha: propertyData?.area ?? null,
                owner_document: propertyData?.cpf_cnpj || null
              },
              resumo: markdownResponse,
              problemas: parsedProblemas,
              documentosFaltantes: parsedDocumentosFaltantes,
              recomendacoes: parsedRecomendacoes,
              riskLevel
            });
          } catch (caseFileError: any) {
            caseFileExtractError = ((caseFileError && (caseFileError.message || caseFileError.toString())) || 'Erro desconhecido no case_file')
              .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
            console.error('[CaseFile] Falha ao enriquecer fatos básicos:', caseFileExtractError);
          }

          const parentModuleResults = parentCaseFile?.module_results || {};
          const newModuleResults: Record<string, { status: string; summary: string; completed_at: string }> = {};
          for (const modId of modulesToProcess) {
            newModuleResults[modId] = {
              status: 'completed',
              summary: `Módulo ${modId} processado na análise complementar`,
              completed_at: completedAt
            };
          }
          enrichedCaseFile = {
            ...enrichedCaseFile,
            module_results: {
              ...parentModuleResults,
              ...newModuleResults
            }
          };

          let recommendedModules: CaseFileRecommendedModule[] = [];
          let recommendationsError: string | null = null;
          try {
            const docProfile = buildDocumentProfile(documents);
            recommendedModules = buildRecommendedModules({
              caseFile: enrichedCaseFile,
              docProfile,
              selectedModules,
              now: new Date().toISOString()
            });
            if (recommendedModules.length > 0) {
              enrichedCaseFile = {
                ...enrichedCaseFile,
                recommended_modules: recommendedModules
              };
            }
          } catch (recError: any) {
            recommendationsError = ((recError && (recError.message || recError.toString())) || 'Erro desconhecido nas recomendações')
              .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
          }

          // ── Normalização de severidade pós-ISF (regra de usucapião → Crítico) ──
          parsedProblemas = parsedProblemas.map(normalizeFindingSeverity);

          // ── Módulo de regras automáticas (matricula_individual) ──
          let matriculaRulesResult: import('@/lib/isf/matriculaRules').MatriculaRulesResult | null = null;
          if (selectedModules.includes('matricula_individual')) {
            try {
              const { runMatriculaRules } = await import('@/lib/isf/matriculaRules');
              matriculaRulesResult = runMatriculaRules(markdownResponse, parsedProblemas, parsedDocumentosFaltantes);
              // Merge alertas de regra com parsedProblemas (sem duplicar)
              for (const alerta of matriculaRulesResult.alertas_regra) {
                const jaExiste = parsedProblemas.some((p: {titulo?: string}) =>
                  (p.titulo || '').toLowerCase().includes((alerta.titulo || '').toLowerCase().slice(0, 20))
                );
                if (!jaExiste) {
                  parsedProblemas.push({
                    titulo: alerta.titulo,
                    criticidade: alerta.criticidade,
                    descricao: alerta.descricao,
                    eixo: alerta.eixo,
                    origem: 'regra_automatica',
                  });
                }
              }
            } catch (rulesErr) {
              console.warn('[MatriculaRules] Erro (ignorado):', rulesErr);
            }
          }

          // ── ISF v2.2 (primário) + v2.1 (compatibilidade) ──
          let isfPayload: Record<string, unknown> = {};
          let isfError: string | null = null;
          let isfResultV2_2: any = null;    // resultado do motor v2.2 (primário)
          let isfResultV2_1: any = null;    // resultado do motor v2.1 (compatibilidade)
          let comparison: any = null;
          const ISF_VERSION_STRING = '2.2';  // versão canônica como string

          // ── FASE 1 — Cache de ISF por herança ──
          // Se a análise pai já possui isf_v2_2 no findings (ex: reprocessamento da mesma matrícula),
          // reusar o resultado em vez de recalcular (elimina divergência IA-dependente).
          const inheritedIsfV2_2 = findings.isf_v2_2 as any;
          const hasInheritedIsf = inheritedIsfV2_2 && typeof inheritedIsfV2_2.isf_score === 'number' && inheritedIsfV2_2.isf_score > 0;

          if (!hasInheritedIsf) {
            try {
              // ── v2.2 (6 dimensões, sem Muito Seguro, com Inválido/Regular) ──
              // Preferir pontuações explícitas fornecidas pela IA (matricula_individual.isf_dimensoes)
              // para eliminar não-determinismo causado por inferência via keywords.
              let pontuacoesV2_2: import('@/lib/isf/isfEngineV2_2').PontuacaoEntradaV2_2[];
              const isfDimensoesFromAI = matriculaIndividualJsonParsed?.isf_dimensoes as Record<string, { pontuacao: number; justificativa?: string }> | undefined;
              if (isfDimensoesFromAI && typeof isfDimensoesFromAI === 'object') {
                // Usar scores explícitos da IA — determinísticos, rastreáveis por documento
                pontuacoesV2_2 = ['D1','D2','D3','D4','D5','D6']
                  .filter(d => isfDimensoesFromAI[d] && typeof isfDimensoesFromAI[d].pontuacao === 'number')
                  .map(d => ({
                    dimensaoId: d,
                    pontuacao: Math.max(0, Math.min(100, Number(isfDimensoesFromAI[d].pontuacao))),
                    itemSelecionado: isfDimensoesFromAI[d].justificativa,
                  }));
                // Quando cadeia_dominial não foi analisada, remover D2 para activar TRAVA_D2_AUSENTE
                if (!normalizedModules.includes('cadeia_dominial')) {
                  pontuacoesV2_2 = pontuacoesV2_2.filter(p => p.dimensaoId !== 'D2');
                }
              } else {
                // Fallback: inferência via keywords (não-determinístico — manter para módulos sem JSON)
                const inferred = inferirPontuacoesDeAchados(parsedProblemas);
                pontuacoesV2_2 = inferred.pontuacoes;
                // Sincronizar criticidade com a inferida
                for (const p of parsedProblemas) {
                  const chave = (p.titulo || '').trim();
                  if (!chave) continue;
                  const inferida = inferred.criticidadeInferida.get(chave);
                  if (inferida) {
                    const atual = (p.criticidade || '').toLowerCase().trim();
                    const isDefault = !atual || atual === 'medio' || atual === 'médio';
                    const isLessSevere = (
                      (atual.replace(/[.!?,;]+$/, '') === 'baixo' && (inferida === 'Crítico' || inferida === 'Alto')) ||
                      (atual.replace(/[.!?,;]+$/, '') === 'alto' && inferida === 'Crítico')
                    );
                    if (isDefault || isLessSevere) {
                      p.criticidade = inferida;
                    }
                  }
                }
                // Quando cadeia_dominial não foi analisada, remover D2 para activar TRAVA_D2_AUSENTE
                if (!normalizedModules.includes('cadeia_dominial')) {
                  pontuacoesV2_2 = pontuacoesV2_2.filter(p => p.dimensaoId !== 'D2');
                }
              }

              isfResultV2_2 = calcularISFV2_2(pontuacoesV2_2);
              // Guardrail: risk_level Crítico nunca deve produzir ISF > 54 (alto_risco)
              if (riskLevel === 'Crítico' && isfResultV2_2.isf_score > 54) {
                isfResultV2_2 = { ...isfResultV2_2, isf_score: 39, faixa: 'critico', faixa_label: 'Crítico', travas_aplicadas: [...(isfResultV2_2.travas_aplicadas || []), 'TRAVA_RISK_LEVEL_CRITICO'] };
              }
              const payloadV2_2 = prepararPayloadV2_2(isfResultV2_2);

              // ── v2.1 (compatibilidade — mantido para análises antigas e comparação) ──
              const complementaryCount =
                (Array.isArray(recommendedModules) ? recommendedModules.length : 0) +
                (Array.isArray(findings.complementary_modules) ? findings.complementary_modules.length : 0);

              const isfContext: ISFContext = {
                complementaryModulesCount: complementaryCount,
                documentosFaltantesCount: Array.isArray(parsedDocumentosFaltantes) ? parsedDocumentosFaltantes.length : 0,
                cadeiaDominialIncompleta: detectarCadeiaDominialIncompleta(markdownResponse, parsedProblemas),
                fragilidadeRegistral: detectarFragilidadeRegistral(markdownResponse, parsedProblemas),
                analysisDepth: typeof findings.analysis_depth === 'number' ? findings.analysis_depth : 1,
                statusIndicaComplementacao: analysis.status === 'pending' || analysis.status === 'error' || complementaryCount > 0,
              };

              isfResultV2_1 = calcularISFv2(parsedProblemas as any, isfContext);
              comparison = calcularComparacao(isfResultV2_1.isf_score, isfResultV2_2.isf_score);

              // Persistir ambos: v2.2 como primário, v2.1 como compatibilidade
              isfPayload = {
                ...payloadV2_2,
                ...gerarPayloadISFCompleto(isfResultV2_1, comparison),
              };
            } catch (isfCalcError: any) {
              isfError = ((isfCalcError && (isfCalcError.message || isfCalcError.toString())) || 'Erro desconhecido no ISF v2.2')
                .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
              // Fallback: tentar v2.1 isoladamente se v2.2 falhar
              try {
                const complementaryCount =
                  (Array.isArray(recommendedModules) ? recommendedModules.length : 0) +
                  (Array.isArray(findings.complementary_modules) ? findings.complementary_modules.length : 0);
                const isfContext: ISFContext = {
                  complementaryModulesCount: complementaryCount,
                  documentosFaltantesCount: Array.isArray(parsedDocumentosFaltantes) ? parsedDocumentosFaltantes.length : 0,
                  cadeiaDominialIncompleta: detectarCadeiaDominialIncompleta(markdownResponse, parsedProblemas),
                  fragilidadeRegistral: detectarFragilidadeRegistral(markdownResponse, parsedProblemas),
                  analysisDepth: typeof findings.analysis_depth === 'number' ? findings.analysis_depth : 1,
                  statusIndicaComplementacao: analysis.status === 'pending' || analysis.status === 'error' || complementaryCount > 0,
                };
                isfResultV2_1 = calcularISFv2(parsedProblemas as any, isfContext);
                comparison = calcularComparacao(0, isfResultV2_1.isf_score);
                isfPayload = gerarPayloadISFCompleto(isfResultV2_1, comparison);
                isfError = null; // v2.1 funcionou como fallback
              } catch (_) {
                // v2.1 também falhou — manter isfError do v2.2
              }
            }
          } else {
            // Cache hit: reusar ISF v2.2 existente no findings
            isfResultV2_2 = inheritedIsfV2_2;
            isfPayload = prepararPayloadV2_2(inheritedIsfV2_2);

            // v2.1 também pode ser herdado se existir
            const inheritedIsfV2_1 = findings.isf_v2 as any;
            if (inheritedIsfV2_1 && typeof inheritedIsfV2_1.isf_score === 'number') {
              isfResultV2_1 = inheritedIsfV2_1;
              comparison = calcularComparacao(inheritedIsfV2_1.isf_score, inheritedIsfV2_2.isf_score);
              isfPayload = {
                ...isfPayload,
                ...gerarPayloadISFCompleto(inheritedIsfV2_1, comparison),
              };
            }
            console.log(`[ISF Cache] ISF herdado de análise anterior: score=${inheritedIsfV2_2.isf_score}`);
          }

          const patchedFindings = {
            ...resultJson,
            ...(chainOfTitleJsonParsed ? { chain_of_title_json: chainOfTitleJsonParsed } : {}),
            ...(matriculaIndividualJsonParsed ? { matricula_individual_json: matriculaIndividualJsonParsed } : {}),
            ...(critiqueResult.achadosRemovidos.length > 0 ? { achados_critica: critiqueResult } : {}),
            problemas: parsedProblemas,
            ...(parsedAchados ? { achados: parsedAchados } : {}),
            recomendacoes: parsedRecomendacoes,
            documentosFaltantes: parsedDocumentosFaltantes,
            case_file: enrichedCaseFile,
            ...(caseFileExtractError ? { case_file_extract_error: caseFileExtractError } : {}),
            ...isfPayload,
            ...(isfResultV2_2 ? { isf_v2_2: isfResultV2_2 } : {}),
            ...(isfResultV2_1 ? { isf_v2: isfResultV2_1 } : {}),
            ...(isfError ? { isf_v2_error: isfError } : {}),
            ...(matriculaRulesResult ? { matricula_rules: matriculaRulesResult } : {}),
            structured_extract_source: 'local_parser',
            structured_extract_at: new Date().toISOString(),
            processing_metrics: {
              gemini_ms: geminiMs,
              postprocess_ms: postprocessMs,
              total_ms: totalMs
            }
          };

          // Persistir colunas top-level compatíveis com schema existente
          // isf_version: INTEGER (22 = v2.2, 1/2 = v2.1)
          // isf_faixa: CHECK constraint só aceita ('muito_seguro', 'seguro', 'atencao', 'alto_risco', 'critico')
          //   → mapear v2.2 faixa para valores compatíveis
          // isf_eixos: manter formato v2.1 (Record) para RadarChartV2
          const ISF_VERSION_INT = 22;  // v2.2 como inteiro compatível com a coluna INTEGER

          // Mapear faixa v2.2 para valor aceito pela CHECK constraint
          const mapFaixaV2_2ToColumn = (faixa: string): string => {
          const mapping: Record<string, string> = {
            invalido: 'critico',
            critico: 'critico',
            alto_risco: 'alto_risco',
            atencao: 'atencao',
            regular: 'atencao',
            seguro: 'seguro',
            muito_seguro: 'seguro',
          };
            return mapping[faixa] || 'atencao';
          };

          const effectiveISFResult = isfResultV2_2 || isfResultV2_1;
          await supabaseAdmin
            .from('analyses')
            .update({
              findings: patchedFindings,
              ...(effectiveISFResult ? {
                isf_score: effectiveISFResult.isf_score,
                // Para v2.2: mapear faixa para valor compatível com CHECK constraint; o label real está em findings.isf_v2_2.faixa_label
                isf_faixa: mapFaixaV2_2ToColumn(isfResultV2_2 ? isfResultV2_2.faixa : effectiveISFResult.risk_level),
                // Manter eixos no formato v2.1 (Record) para compatibilidade com RadarChartV2
                isf_eixos: isfResultV2_1 ? isfResultV2_1.eixos : effectiveISFResult.eixos,
                isf_explainer: comparison || null,
                // isf_achados: SEMPRE usar parsedProblemas (achados reais da análise),
                // NUNCA isfResultV2_2.alertas (que são alertas de dimensão, formato incompatível com ISFExplainer).
                // O ISFExplainer renderiza os achados com classificação por eixo (REG/DOM/LIT/POS/FRA)
                // e também as dimensões v2.2 quando disponíveis via isf_v2_2.
                isf_achados: parsedProblemas.map((p: any) => ({
                  titulo: p.titulo || 'Achado sem título',
                  criticidade: p.criticidade || 'médio',
                  recomendacao: p.recomendacao || '',
                  eixo: classificarEixo(p),
                  descricao: p.descricao || '',
                })),
                isf_version: ISF_VERSION_INT
              } : {})
            })
            .eq('id', analysisId);

          if (planType === 'trial') {
            try {
              const { markTrialUsed, trackTrialEvent } = await import('@/lib/trial/trialControl');
              await markTrialUsed(user.id, analysisId, user.email || '');
              await trackTrialEvent(user.id, 'trial_completed', { analysisId }, user.email || '');
            } catch (e) {
              console.warn('Erro de fail-safe (ignorado): falha ao finalizar telemetria do trial:', e);
            }
          }
        } catch (postprocessError: any) {
          const postprocessMs = Date.now() - postprocessStartAt;
          const totalMs = Date.now() - startedAt;
          const structuredError = (postprocessError && (postprocessError.message || postprocessError.toString())) || 'Erro desconhecido na extração estruturada';
          const failedFindings = {
            ...resultJson,
            structured_extract_source: 'local_parser',
            structured_extract_at: new Date().toISOString(),
            structured_extract_error: structuredError.replace(/https?:\/\/\S+/gi, '[REDACTED_URL]'),
            processing_metrics: {
              gemini_ms: geminiMs,
              postprocess_ms: postprocessMs,
              total_ms: totalMs
            }
          };
          await supabaseAdmin
            .from('analyses')
            .update({ findings: failedFindings })
            .eq('id', analysisId);
        }
      } catch (innerError: any) {
        console.error("[Background Process] Erro no processamento:", innerError);

        const rawMessage = (innerError && (innerError.message || innerError.toString())) || '';
        const messageLower = rawMessage.toLowerCase();
        const isTimeout = messageLower.includes("timeout:");
        const forcedTechnicalErrorType = innerError?.technicalErrorType;

        const isAiUnavailable = ['503', 'service unavailable', 'high demand'].some(p => messageLower.includes(p));
        const isAiQuotaExceeded = ['429', 'too many requests', 'quota', 'rate limit'].some(p => messageLower.includes(p));

        let technicalErrorType = 'processing_failed';
        let userMessage = 'Não foi possível concluir o parecer técnico neste momento.';
        let findingsCurrentStep = 'Falha no processamento do parecer técnico.';

        if (forcedTechnicalErrorType === 'ai_incomplete_response') {
          technicalErrorType = 'ai_incomplete_response';
          findingsCurrentStep = innerError?.findingsCurrentStep || 'A IA retornou um parecer incompleto.';
        } else if (forcedTechnicalErrorType === 'insufficient_balance') {
          technicalErrorType = 'insufficient_balance';
          findingsCurrentStep = innerError?.findingsCurrentStep || 'Saldo insuficiente no fechamento.';
        } else if (forcedTechnicalErrorType === 'subscription_infrastructure_error') {
          technicalErrorType = 'subscription_infrastructure_error';
          userMessage = 'Erro no sistema de assinaturas. O débito de páginas não pôde ser confirmado. Tente novamente em instantes.';
          findingsCurrentStep = innerError?.findingsCurrentStep || 'Falha no sistema de assinaturas ao debitar páginas.';
        } else if (isAiQuotaExceeded) {
          technicalErrorType = 'ai_quota_exceeded';
          findingsCurrentStep = 'Limite temporário da IA atingido.';
        } else if (isTimeout) {
          technicalErrorType = 'ai_timeout';
          findingsCurrentStep = 'A IA demorou mais que o esperado.';
        } else if (isAiUnavailable) {
          technicalErrorType = 'ai_unavailable';
          findingsCurrentStep = 'IA temporariamente indisponível.';
        }

        const sanitizedMessage = rawMessage.replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
        const failedAt = new Date().toISOString();
        const recoverableFailureType = isRecoverableErrorType(technicalErrorType) ? technicalErrorType : null;
        
        const currentRetryCount = getRetryCount(updatedFindings);
        const isTimeoutExhausted = recoverableFailureType === 'ai_timeout' && currentRetryCount >= 5;
        const isRecoverableFailure = Boolean(recoverableFailureType) && !isTimeoutExhausted;
        
        let retryState: any = null;
        if (isTimeoutExhausted) {
          retryState = {
            available: false,
            exhausted: true,
            reason: "max_ai_timeout_attempts",
            retry_count: currentRetryCount,
            last_error_type: "ai_timeout",
            last_error_at: failedAt
          };
          findingsCurrentStep = "A IA excedeu o tempo limite. Esta análise exige processamento em etapas.";
        } else if (recoverableFailureType) {
          retryState = buildRetryState(updatedFindings, recoverableFailureType, failedAt);
        }

        let stageAwareProcessingStages = updatedFindings.case_file.processing_stages;
        if (currentStageId) {
          stageAwareProcessingStages = {
            ...(stageAwareProcessingStages || processingStages),
            stages: markStageError(stageAwareProcessingStages || processingStages, currentStageId, sanitizedMessage || 'Erro desconhecido', failedAt),
          };
        }

        // PASSO 25.7Q — Capturar rawAiResponsePreview universal (qualquer caminho de erro)
        const universalRawPreview = innerError?.rawAiResponsePreview
          || (markdownResponse && markdownResponse.length > 0 ? markdownResponse.slice(0, 2000) : null);

        const failedFindings = {
          ...updatedFindings,
          // PASSO 25.7N — Persistir diagnóstico de extração PDF mesmo em erro
          pdf_extraction_mode: pdfMode,
          pdf_extraction_diagnostics: pdfExtractionDiags,
          current_step: findingsCurrentStep,
          error_message: sanitizedMessage || 'Erro no processamento interno',
          technical_error_type: isTimeoutExhausted ? 'max_ai_timeout_attempts' : technicalErrorType,
          failed_at: failedAt,
          retry_available: isRecoverableFailure,
          retry_reason: isTimeoutExhausted ? "max_ai_timeout_attempts" : (isRecoverableFailure ? technicalErrorType : null),
          retry_exhausted: isTimeoutExhausted ? true : undefined,
          ...(retryState ? { retry_state: retryState } : {}),
          // PASSO 25.7O — Persistir diagnóstico de validação JSON-first vs textual
          ...(validationPath && validationPath !== 'none' ? { validation_path: validationPath } : {}),
          ...(innerError?.jsonParseError ? { json_parse_error: innerError.jsonParseError } : {}),
          ...(universalRawPreview ? { raw_ai_response_preview: universalRawPreview } : {}),
          case_file: {
            ...updatedFindings.case_file,
            ...(retryState ? { retry_state: retryState } : {}),
            processing_stages: stageAwareProcessingStages,
          }
        };

        await supabaseAdmin
          .from('analyses')
          .update({
            status: 'error',
            findings: failedFindings
          })
          .eq('id', analysisId);

        // Estorno removido (P0): Páginas não são mais debitadas antes do 'completed'.

        console.error("[Background] Erro na IA:", userMessage, technicalErrorType);
      }
    };

    waitUntil(runBackground());

    return NextResponse.json({
      success: true,
      simulador: false,
      analysisId: analysisId,
      status: 'processing',
      message: 'Processamento em background iniciado'
    });

  } catch (error: any) {
    console.error('Erro geral no POST /api/analyze:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
