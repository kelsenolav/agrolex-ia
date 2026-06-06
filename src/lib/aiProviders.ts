/**
 * FASE 5.1 — Multi-IA Fallback
 *
 * Fallback automático entre Gemini e OpenAI.
 * Registra provider_used, fallback_triggered e fallback_reason.
 *
 * Fluxo:
 * 1. Tenta Gemini (primário)
 * 2. Se erro for de quota/rate-limit/timeout/indisponibilidade → tenta OpenAI
 * 3. Se erro NÃO for dessas categorias → lança imediatamente (sem fallback)
 * 4. Registra métricas no resultado
 *
 * Compatível com FASE 5 (ProcessingStages): provider_used por etapa.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export type AiProvider = 'gemini' | 'openai';

export interface AiProviderResult {
  /** Texto gerado pela IA (markdown) */
  text: string;
  /** Provedor efetivamente utilizado ('gemini' ou 'openai') */
  provider_used: AiProvider;
  /** Se true, o fallback foi acionado (Gemini falhou, OpenAI respondeu) */
  fallback_triggered: boolean;
  /** Motivo do fallback (ex: 'ai_quota_exceeded', 'ai_timeout'), null se não houve fallback */
  fallback_reason: string | null;
  /** Duração da chamada bem-sucedida em ms */
  duration_ms: number;
}

export interface AiGenerateOptions {
  /** Nome do modelo Gemini (default: env GEMINI_MODEL ou 'gemini-3.5-flash') */
  geminiModel?: string;
  /** Nome do modelo OpenAI (default: env OPENAI_MODEL ou 'gpt-4o') */
  openaiModel?: string;
  /** Max tokens para geração (Gemini: generationConfig.maxOutputTokens) */
  maxOutputTokens?: number;
  /** Timeout da chamada individual em ms (default: 90000) */
  timeoutMs?: number;
  /** Se true, o fallback para OpenAI é permitido (default: true) */
  allowFallback?: boolean;
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

// ── Classificação de erros ───────────────────────────────────────────────────

const FALLBACK_ELIGIBLE_PATTERNS = [
  '429',
  'too many requests',
  'quota',
  'resource exhausted',
  'resource has been exhausted',
  'rate limit',
  'rate exceeded',
  'quota exceeded',
  'timeout',
  'time out',
  '503',
  'service unavailable',
  'high demand',
  'model is currently experiencing high demand',
  'ai_quota_exceeded',
  'ai_timeout',
  'ai_unavailable',
];

const NON_FALLBACK_PATTERNS = [
  'invalid prompt',
  'invalid document',
  'invalid request',
  'parse',
  'parsing',
  'internal',
  'schema',
  'validation',
];

/**
 * Verifica se uma mensagem de erro é elegível para fallback.
 * Apenas erros de quota, rate-limit, timeout e indisponibilidade.
 * NÃO faz fallback para: prompt inválido, documento inválido, erro de parsing, erro interno.
 */
export function isFallbackEligible(errorMessage: string): boolean {
  if (!errorMessage) return false;

  const lower = errorMessage.toLowerCase();

  // Verifica primeiro se é um erro NÃO elegível (prioridade sobre elegíveis)
  const nonEligible = NON_FALLBACK_PATTERNS.some((p) => lower.includes(p));
  if (nonEligible) return false;

  // Verifica se é um erro elegível
  return FALLBACK_ELIGIBLE_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Extrai o motivo do fallback a partir da mensagem de erro.
 */
export function classifyFallbackReason(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit') || lower.includes('rate exceeded') || lower.includes('resource exhausted') || lower.includes('resource has been exhausted')) {
    return 'ai_quota_exceeded';
  }
  if (lower.includes('timeout') || lower.includes('time out')) {
    return 'ai_timeout';
  }
  if (lower.includes('503') || lower.includes('service unavailable') || lower.includes('high demand')) {
    return 'ai_unavailable';
  }
  return 'ai_fallback_unknown';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEnvVar(key: string, fallback: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${label}`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

/**
 * Converte parts no formato Gemini para um prompt textual compatível com OpenAI.
 *
 * SPRINT P0-B.1 — Com extração híbrida, PDFs textuais agora são convertidos para texto puro
 * e enviados como { text: "--- CONTEÚDO DO DOCUMENTO: ..." }.
 * Apenas PDFs escaneados (fallback base64) ainda usam inlineData, que são ignorados aqui.
 *
 * Fluxo:
 * 1. Identifica o prompt de instruções (texto longo com quebras de linha)
 * 2. Coleta todos os text parts (incluindo conteúdo extraído dos PDFs)
 * 3. Se houver inlineData (PDF escaneado), adiciona nota informativa
 * 4. Monta userPrompt com instruções + conteúdo dos documentos
 */
function geminiPartsToOpenAIMessages(parts: GeminiPart[]): {
  systemPrompt: string;
  userPrompt: string;
  pdfNote: boolean;
} {
  let instructions = '';
  const documentTexts: string[] = [];
  let hasPdfFallback = false;

  for (const part of parts) {
    if (part.text) {
      // Identificar se é o prompt de instruções (texto longo com quebras)
      // ou conteúdo de documento extraído (começa com "--- CONTEÚDO DO DOCUMENTO:")
      if (
        part.text.startsWith('--- CONTEÚDO DO DOCUMENTO:') ||
        part.text.startsWith('[Nota: O arquivo PDF')
      ) {
        documentTexts.push(part.text);
      } else if (part.text.length > 1000 || part.text.includes('\n') || part.text.includes('ATENÇÃO')) {
        // Provavelmente é o prompt de instruções
        instructions = part.text;
      } else {
        documentTexts.push(part.text);
      }
    }
    if (part.inlineData) {
      hasPdfFallback = true;
    }
  }

  let userPrompt = instructions;

  // Adicionar conteúdo dos documentos extraídos
  if (documentTexts.length > 0) {
    userPrompt = instructions + '\n\n---\n\n' + documentTexts.join('\n');
  }

  // Se ainda há PDFs em fallback base64 (escaneados), adicionar nota
  if (hasPdfFallback) {
    userPrompt =
      '[Nota: Alguns documentos estão em formato PDF escaneado e não puderam ser transmitidos ao modelo de fallback. Apenas os documentos textuais extraídos estão disponíveis.]\n\n' +
      userPrompt;
  }

  return {
    systemPrompt:
      'Você é um auditor jurídico especializado em direito registral imobiliário brasileiro. Produza pareceres técnicos em português (Brasil), em formato Markdown, com as seções: Identificação, Documentos Analisados, Cadeia Dominial, Achados, Classificação de Risco, Recomendações.',
    userPrompt,
    pdfNote: hasPdfFallback,
  };
}

/**
 * Gera conteúdo usando OpenAI via SDK oficial.
 */
async function generateWithOpenAI(
  parts: GeminiPart[],
  options: AiGenerateOptions = {},
): Promise<AiProviderResult> {
  const openaiKey = getEnvVar('OPENAI_API_KEY', '');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY não configurada. Impossível usar fallback OpenAI.');
  }

  // Import dinâmico para evitar problemas de build quando OpenAI não é usado
  // Hotfix 5.1: compatibilidade CommonJS/ESM — o módulo 'openai' pode exportar
  // o construtor como default (ESM), como named export 'OpenAI' (CJS híbrido),
  // ou diretamente como module.exports (CJS puro).
  // Adicionamos openaiModule.default?.default para cobrir cenário de duplo aninhamento
  // que ocorre em alguns ambientes Jest com esModuleInterop.
  const openaiModule = await import('openai');
  const OpenAIConstructor =
    (openaiModule as any).default?.default ??
    (openaiModule as any).default ??
    (openaiModule as any).OpenAI ??
    openaiModule;
  if (typeof OpenAIConstructor !== 'function') {
    throw new Error(
      `Import do módulo 'openai' não retornou um construtor. Tipo: ${typeof OpenAIConstructor}. Chaves: ${Object.keys(openaiModule).join(', ')}`,
    );
  }
  const openai: any = new OpenAIConstructor({ apiKey: openaiKey });

  const modelName = options.openaiModel || getEnvVar('OPENAI_MODEL', 'gpt-4o');
  const timeoutMs = options.timeoutMs || 90000;
  const maxTokens = options.maxOutputTokens || 4096;

  const { systemPrompt, userPrompt } = geminiPartsToOpenAIMessages(parts);

  const startTime = Date.now();

  const completionPromise = openai.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  });

  const completion = await withTimeout(completionPromise, timeoutMs, 'openai_generation');
  const durationMs = Date.now() - startTime;

  const text = (completion as any)?.choices?.[0]?.message?.content || '';

  if (!text || text.trim().length < 50) {
    throw new Error('OpenAI retornou resposta vazia ou muito curta.');
  }

  return {
    text,
    provider_used: 'openai',
    fallback_triggered: true,
    fallback_reason: null, // será preenchido pelo chamador (generateWithFallback)
    duration_ms: durationMs,
  };
}

// ── Gemini ────────────────────────────────────────────────────────────────────

/**
 * Gera conteúdo usando Gemini via SDK oficial (@google/generative-ai).
 */
async function generateWithGemini(
  parts: GeminiPart[],
  options: AiGenerateOptions = {},
): Promise<AiProviderResult> {
  const geminiKey = getEnvVar('GEMINI_API_KEY', '');
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY não configurada.');
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(geminiKey);
  const modelName = options.geminiModel || getEnvVar('GEMINI_MODEL', 'gemini-3.5-flash');
  const timeoutMs = options.timeoutMs || 90000;

  const genConfig: Record<string, unknown> = {};
  if (options.maxOutputTokens) {
    genConfig.maxOutputTokens = options.maxOutputTokens;
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    ...(Object.keys(genConfig).length > 0 ? { generationConfig: genConfig } : {}),
  });

  const startTime = Date.now();

  const aiPromise = model.generateContent(parts as any).then(async (result) => {
    const response = await result.response;
    return response.text();
  });

  let text = await withTimeout(aiPromise, timeoutMs, 'gemini_generation');
  const durationMs = Date.now() - startTime;

  // Limpeza de delimitadores markdown
  if (text.startsWith('```markdown')) {
    text = text.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  if (!text || text.trim().length < 50) {
    throw new Error('Gemini retornou resposta vazia ou muito curta.');
  }

  return {
    text,
    provider_used: 'gemini',
    fallback_triggered: false,
    fallback_reason: null,
    duration_ms: durationMs,
  };
}

// ── Função Principal: generateWithFallback ────────────────────────────────────

export interface FallbackResult extends AiProviderResult {
  /** Histórico de tentativas (para debug/log) */
  attempts: Array<{
    provider: AiProvider;
    success: boolean;
    error?: string;
    duration_ms?: number;
  }>;
}

/**
 * Gera conteúdo com fallback automático Gemini → OpenAI.
 *
 * Fluxo:
 * 1. Tenta Gemini (primário)
 * 2. Se Gemini falhar com erro elegível (quota/rate/timeout/indisponível) → tenta OpenAI
 * 3. Se Gemini falhar com erro NÃO elegível → lança imediatamente
 * 4. Se OpenAI também falhar → lança o erro do OpenAI
 *
 * Registra provider_used, fallback_triggered e fallback_reason no resultado.
 */
export async function generateWithFallback(
  parts: GeminiPart[],
  options: AiGenerateOptions = {},
): Promise<FallbackResult> {
  const allowFallback = options.allowFallback !== false;
  const attempts: FallbackResult['attempts'] = [];

  // ── Tentativa 1: Gemini ──
  try {
    const geminiResult = await generateWithGemini(parts, options);
    attempts.push({ provider: 'gemini', success: true, duration_ms: geminiResult.duration_ms });

    return {
      ...geminiResult,
      attempts,
    };
  } catch (geminiError: unknown) {
    const errorMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
    attempts.push({ provider: 'gemini', success: false, error: errorMessage });

    // Se fallback não for permitido, lança o erro imediatamente
    if (!allowFallback) {
      throw geminiError;
    }

    // Se o erro NÃO for elegível para fallback, lança imediatamente
    if (!isFallbackEligible(errorMessage)) {
      throw geminiError;
    }

    // ── Tentativa 2: OpenAI (fallback) ──
    const fallbackReason = classifyFallbackReason(errorMessage);

    try {
      const openaiResult = await generateWithOpenAI(parts, options);
      attempts.push({ provider: 'openai', success: true, duration_ms: openaiResult.duration_ms });

      return {
        ...openaiResult,
        fallback_triggered: true,
        fallback_reason: fallbackReason,
        attempts,
      };
    } catch (openaiError: unknown) {
      const openaiErrorMessage = openaiError instanceof Error ? openaiError.message : String(openaiError);
      attempts.push({ provider: 'openai', success: false, error: openaiErrorMessage });

      // Ambos falharam — lança erro combinado
      throw new Error(
        `Todos os provedores de IA falharam. Gemini: ${errorMessage.slice(0, 200)} | OpenAI: ${openaiErrorMessage.slice(0, 200)}`,
      );
    }
  }
}

// ── Exportações ───────────────────────────────────────────────────────────────

export { generateWithGemini, generateWithOpenAI, geminiPartsToOpenAIMessages };