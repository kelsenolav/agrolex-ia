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

export type AiProvider = 'gemini' | 'claude' | 'openai' | 'groq';

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
  // Erros de billing/crédito — Anthropic retorna "credit balance is too low"
  'credit balance',
  'insufficient credit',
  'billing',
  'upgrade or purchase credits',
  'purchase credits',
  'balance is too low',
  'low balance',
  // Erros de resposta parcial/bloqueada do Gemini (PASSO 25.7T)
  'ai_blocked_by_safety',
  'ai_blocked_by_recitation',
  'ai_incomplete_response',
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
  if (lower.includes('credit balance') || lower.includes('insufficient credit') || lower.includes('billing') || lower.includes('purchase credits') || lower.includes('balance is too low') || lower.includes('low balance')) {
    return 'ai_billing_error';
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
 * PDFs inlineData são ignorados (OpenAI não suporta PDF direto nesse formato).
 * Adiciona uma nota informando que o conteúdo PDF não pôde ser transmitido.
 */
function geminiPartsToOpenAIMessages(parts: GeminiPart[]): {
  systemPrompt: string;
  userPrompt: string;
  pdfNote: boolean;
} {
  let instructions = '';
  const textParts: string[] = [];
  let hasPdf = false;

  for (const part of parts) {
    if (part.text) {
      if (part.text.length > 1000 || part.text.includes('\n') || part.text.includes('ATENÇÃO')) {
        // Provavelmente é o prompt de instruções
        instructions = part.text;
      } else {
        textParts.push(part.text);
      }
    }
    if (part.inlineData) {
      hasPdf = true;
    }
  }

  let userPrompt = instructions;
  if (textParts.length > 0) {
    userPrompt = instructions + '\n\n---\n\n' + textParts.join('\n');
  }

  if (hasPdf) {
    userPrompt =
      '[Nota: Documentos PDF anexados não puderam ser transmitidos ao modelo de fallback. A análise será baseada apenas nas instruções textuais.]\n\n' +
      userPrompt;
  }

  return {
    systemPrompt:
      'Você é um auditor jurídico especializado em direito registral imobiliário brasileiro. Produza pareceres técnicos em português (Brasil), em formato Markdown, com as seções: Identificação, Documentos Analisados, Cadeia Dominial, Achados, Classificação de Risco, Recomendações.',
    userPrompt,
    pdfNote: hasPdf,
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
    temperature: 0,
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

// ── Claude (Anthropic) ────────────────────────────────────────────────────────

/**
 * Converte parts no formato Gemini para um prompt compatível com Claude.
 * Claude suporta PDFs em base64.
 */
async function generateWithClaude(
  parts: GeminiPart[],
  options: AiGenerateOptions = {}
): Promise<AiProviderResult> {
  const claudeKey = getEnvVar('ANTHROPIC_API_KEY', '');
  if (!claudeKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada.');
  }

  const { Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: claudeKey });
  
  const modelName = getEnvVar('CLAUDE_MODEL', 'claude-3-5-sonnet-20241022');
  const timeoutMs = options.timeoutMs || 90000;
  const maxTokens = options.maxOutputTokens || 8192;
  
  let systemPrompt = 'Você é um auditor jurídico especializado em direito registral imobiliário brasileiro. Produza pareceres técnicos em português (Brasil), em formato Markdown, com as seções: Identificação, Documentos Analisados, Cadeia Dominial, Achados, Classificação de Risco, Recomendações.';
  const contentBlocks: any[] = [];
  
  for (const part of parts) {
    if (part.text) {
      if (part.text.length > 1000 || part.text.includes('\n') || part.text.includes('ATENÇÃO')) {
        systemPrompt += "\n\n" + part.text;
      } else {
        contentBlocks.push({ type: 'text', text: part.text });
      }
    }
    if (part.inlineData && part.inlineData.mimeType === 'application/pdf') {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: part.inlineData.data
        }
      });
    }
  }
  
  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: 'text', text: "Inicie a análise baseada nas instruções do sistema." });
  }

  const startTime = Date.now();
  
  const messagePromise = anthropic.messages.create({
    model: modelName,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      { role: 'user', content: contentBlocks }
    ]
  });
  
  const completion = await withTimeout(messagePromise, timeoutMs, 'claude_generation');
  const durationMs = Date.now() - startTime;
  
  let text = '';
  if (completion.content && completion.content.length > 0) {
    text = (completion.content.find((c: any) => c.type === 'text') as any)?.text || '';
  }
  
  if (!text || text.trim().length < 50) {
    throw new Error('Claude retornou resposta vazia ou muito curta.');
  }
  
  return {
    text,
    provider_used: 'claude',
    fallback_triggered: true,
    fallback_reason: null,
    duration_ms: durationMs,
  };
}

// ── Groq (Llama) ──────────────────────────────────────────────────────────────

/**
 * Gera conteúdo usando Groq via SDK da OpenAI com baseURL customizada.
 */
async function generateWithGroq(
  parts: GeminiPart[],
  options: AiGenerateOptions = {}
): Promise<AiProviderResult> {
  const groqKey = getEnvVar('GROQ_API_KEY', '');
  if (!groqKey) {
    throw new Error('GROQ_API_KEY não configurada.');
  }

  const openaiModule = await import('openai');
  const OpenAIConstructor =
    (openaiModule as any).default?.default ??
    (openaiModule as any).default ??
    (openaiModule as any).OpenAI ??
    openaiModule;
    
  if (typeof OpenAIConstructor !== 'function') {
    throw new Error('Falha ao importar construtor OpenAI para uso no Groq.');
  }
  
  const openai: any = new OpenAIConstructor({ 
    apiKey: groqKey,
    baseURL: 'https://api.groq.com/openai/v1'
  });

  const modelName = getEnvVar('GROQ_MODEL', 'llama-3.1-70b-versatile');
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
    temperature: 0,
  });

  const completion = await withTimeout(completionPromise, timeoutMs, 'groq_generation');
  const durationMs = Date.now() - startTime;

  const text = (completion as any)?.choices?.[0]?.message?.content || '';

  if (!text || text.trim().length < 50) {
    throw new Error('Groq retornou resposta vazia ou muito curta.');
  }

  return {
    text,
    provider_used: 'groq',
    fallback_triggered: true,
    fallback_reason: null,
    duration_ms: durationMs,
  };
}

// ── Gemini ────────────────────────────────────────────────────────────────────

/**
 * Extrai um resumo seguro dos safetyRatings para inclusão em mensagens de erro.
 * Não inclui o conteúdo da resposta, apenas as categorias e probabilidades.
 */
function summarizeSafetyRatings(safetyRatings: any[] | undefined): string {
  if (!safetyRatings || safetyRatings.length === 0) return 'nenhum';
  return safetyRatings
    .map((sr: any) => `${sr.category || 'desconhecida'}=${sr.probability || 'N/A'}`)
    .join(', ');
}

/**
 * Gera conteúdo usando Gemini via SDK oficial (@google/generative-ai).
 *
 * PASSO 25.7T — Inspeciona finishReason, promptFeedback e safetyRatings
 * para detectar respostas parciais ou bloqueadas e permitir fallback.
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

  const genConfig: Record<string, unknown> = {
    // Temperature 0 garante saída determinística — mesma matrícula → mesmo parecer
    temperature: 0,
  };
  if (options.maxOutputTokens) {
    genConfig.maxOutputTokens = options.maxOutputTokens;
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    ...(Object.keys(genConfig).length > 0 ? { generationConfig: genConfig } : {}),
  });

  const startTime = Date.now();

  // PASSO 25.7T: capturar o response completo (não apenas .text())
  // para poder inspecionar finishReason, promptFeedback e safetyRatings.
  const aiPromise = model.generateContent(parts as any).then(async (result) => {
    const response = await result.response;
    return response; // retorna o objeto EnhancedGenerateContentResponse completo
  });

  const response = await withTimeout(aiPromise, timeoutMs, 'gemini_generation');
  const durationMs = Date.now() - startTime;

  // ── PASSO 25.7T: Inspeção de metadados de segurança ──────────────────────

  const finishReason: string | undefined = (response as any)?.candidates?.[0]?.finishReason;
  const blockReason: string | undefined = (response as any)?.promptFeedback?.blockReason;
  const safetyRatings: any[] | undefined = (response as any)?.candidates?.[0]?.safetyRatings;

  // 1. promptFeedback.blockReason → bloqueio total (não gera texto)
  if (blockReason) {
    const safetySummary = summarizeSafetyRatings(safetyRatings);
    const err = new Error(
      `[ai_blocked_by_safety] Gemini bloqueou a requisição. ` +
      `blockReason=${blockReason}, safetyRatings=[${safetySummary}]`,
    );
    (err as any).technicalErrorType = 'ai_blocked_by_safety';
    throw err;
  }

  // 2. finishReason SAFETY → conteúdo gerado foi cortado por segurança
  if (finishReason === 'SAFETY') {
    const safetySummary = summarizeSafetyRatings(safetyRatings);
    const err = new Error(
      `[ai_blocked_by_safety] Gemini interrompeu a geração por segurança. ` +
      `finishReason=SAFETY, safetyRatings=[${safetySummary}]`,
    );
    (err as any).technicalErrorType = 'ai_blocked_by_safety';
    throw err;
  }

  // 3. finishReason RECITATION → conteúdo gerado foi cortado por recitação de texto protegido
  if (finishReason === 'RECITATION') {
    const err = new Error(
      `[ai_blocked_by_recitation] Gemini interrompeu a geração por recitação de conteúdo protegido. ` +
      `finishReason=RECITATION`,
    );
    (err as any).technicalErrorType = 'ai_blocked_by_recitation';
    throw err;
  }

  // 4. finishReason MAX_TOKENS → resposta truncada, pode estar incompleta
  if (finishReason === 'MAX_TOKENS') {
    const err = new Error(
      `[ai_incomplete_response] Gemini atingiu o limite de tokens. ` +
      `finishReason=MAX_TOKENS`,
    );
    (err as any).technicalErrorType = 'ai_incomplete_response';
    throw err;
  }

  // ── Obter texto da resposta ──────────────────────────────────────────────

  let text: string;
  try {
    text = response.text();
  } catch (textError: unknown) {
    // Se .text() lançar exceção (ex: resposta bloqueada sem candidatos),
    // trata como bloqueio de safety para fallback
    const errMsg = textError instanceof Error ? textError.message : String(textError);
    const err = new Error(
      `[ai_blocked_by_safety] Gemini: falha ao extrair texto da resposta. ` +
      `Erro: ${errMsg.slice(0, 200)}`,
    );
    (err as any).technicalErrorType = 'ai_blocked_by_safety';
    throw err;
  }

  // Limpeza de delimitadores markdown
  if (text.startsWith('```markdown')) {
    text = text.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  // Marcação de diagnóstico não-invasiva para finishReason não-STOP
  // (ex: OTHER, FINISH_REASON_UNSPECIFIED) — registra mas não bloqueia
  if (finishReason && finishReason !== 'STOP' && finishReason !== 'FINISH_REASON_UNSPECIFIED') {
    // Apenas log seguro: finishReason inesperado mas sem bloqueio
    // O texto gerado pode estar OK, então prosseguimos
    // mas adicionamos um prefixo de diagnóstico no texto (para debug em staging)
    if (getEnvVar('NODE_ENV', 'development') !== 'production') {
      text = `[Gemini finishReason=${finishReason}]\n${text}`;
    }
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
  
  const providersToTry: AiProvider[] = [];
  if (getEnvVar('GEMINI_API_KEY', '')) providersToTry.push('gemini');
  if (getEnvVar('ANTHROPIC_API_KEY', '')) providersToTry.push('claude');
  if (getEnvVar('OPENAI_API_KEY', '')) providersToTry.push('openai');
  if (getEnvVar('GROQ_API_KEY', '')) providersToTry.push('groq');

  if (providersToTry.length === 0) {
    providersToTry.push('gemini');
  }
  
  let lastErrorMessage = '';
  let lastFallbackReason: string | null = null;
  
  for (let i = 0; i < providersToTry.length; i++) {
    const provider = providersToTry[i];
    
    try {
      let result: AiProviderResult;
      
      switch (provider) {
        case 'gemini':
          result = await generateWithGemini(parts, options);
          break;
        case 'claude':
          result = await generateWithClaude(parts, options);
          break;
        case 'openai':
          result = await generateWithOpenAI(parts, options);
          break;
        case 'groq':
          result = await generateWithGroq(parts, options);
          break;
        default:
          throw new Error('Provedor desconhecido');
      }
      
      attempts.push({ provider, success: true, duration_ms: result.duration_ms });
      
      return {
        ...result,
        fallback_triggered: i > 0,
        fallback_reason: i > 0 ? lastFallbackReason : null,
        attempts,
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      attempts.push({ provider, success: false, error: errorMessage });
      lastErrorMessage = errorMessage;
      
      if (!allowFallback) {
        throw error;
      }
      
      if (!isFallbackEligible(errorMessage)) {
        throw error;
      }
      
      lastFallbackReason = classifyFallbackReason(errorMessage);
    }
  }

  throw new Error(`Todos os provedores de IA falharam na cascata. Último erro: ${lastErrorMessage.slice(0, 200)}`);
}

// ── Exportações ───────────────────────────────────────────────────────────────

export { generateWithGemini, generateWithClaude, generateWithOpenAI, generateWithGroq, geminiPartsToOpenAIMessages };