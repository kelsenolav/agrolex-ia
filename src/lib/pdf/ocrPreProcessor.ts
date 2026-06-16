/**
 * ocrPreProcessor.ts
 *
 * Pré-processa PDFs ilegíveis ou escaneados usando o Gemini como OCR dedicado.
 * Separa a função de "ler o documento" da função de "analisar juridicamente".
 *
 * Fluxo:
 * 1. Envia o PDF binário para o Gemini com prompt de transcrição pura
 * 2. Gemini retorna o texto extraído verbatim
 * 3. O texto limpo é usado na análise jurídica (em vez do PDF binário)
 */

export interface OcrResult {
  text: string;
  success: boolean;
  method: 'gemini_ocr' | 'text_extraction' | 'failed';
  durationMs: number;
  pageCount: number | null;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

const OCR_PROMPT = `Você é um sistema de OCR (Reconhecimento Óptico de Caracteres) especializado em documentos imobiliários brasileiros.

TAREFA: Transcreva INTEGRALMENTE o conteúdo deste documento PDF, preservando:
- Todos os números de matrícula, registro e averbação (R-1, AV-2, etc.)
- Todos os nomes de pessoas (proprietários, cônjuges, transmitentes, adquirentes)
- Todos os CPFs, CNPJs e números de documentos
- Todas as datas
- Todas as áreas (hectares, metros quadrados)
- Todos os números de CCIR, CAR, ITR, SIGEF
- Todos os valores monetários
- Todas as descrições de confrontações e limites
- Toda a estrutura do documento (cabeçalhos, seções, atos registrais)

REGRAS:
1. Transcreva EXATAMENTE o que está escrito no documento — não interprete, não resuma, não analise.
2. Se uma palavra ou trecho estiver ilegível, marque como [ILEGÍVEL].
3. Se um número estiver parcialmente legível, transcreva o que conseguir e marque o restante como [?].
4. Mantenha a ordem do documento (de cima para baixo, da esquerda para a direita).
5. Separe páginas com "--- PÁGINA X ---".
6. NÃO adicione comentários, análises ou interpretações.
7. NÃO invente dados que não estejam no documento.

RESPONDA APENAS COM A TRANSCRIÇÃO DO DOCUMENTO.`;

export async function ocrWithGemini(
  pdfBuffer: Buffer,
  options: { geminiModel?: string; timeoutMs?: number } = {},
): Promise<OcrResult> {
  const startTime = Date.now();

  try {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    if (!geminiKey) {
      return {
        text: '',
        success: false,
        method: 'failed',
        durationMs: Date.now() - startTime,
        pageCount: null,
        confidence: 'low',
        error: 'GEMINI_API_KEY não configurada',
      };
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const modelName = options.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const timeoutMs = options.timeoutMs || 60000;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 16384,
      },
    });

    const base64Data = pdfBuffer.toString('base64');

    const parts = [
      { text: OCR_PROMPT },
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf',
        },
      },
    ];

    // Cascata de modelos: se o modelo principal estiver sobrecarregado (503),
    // tenta o próximo. Resolve o problema de "alta demanda" do Gemini que
    // antes fazia o OCR desistir e cair no fallback binário (que alucina).
    const modelCandidates = Array.from(
      new Set([modelName, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']),
    );
    const maxRetriesPerModel = 3;

    async function generateWithResilience(): Promise<any> {
      let lastErr: any = null;
      for (const candidate of modelCandidates) {
        const candidateModel =
          candidate === modelName
            ? model
            : genAI.getGenerativeModel({
                model: candidate,
                generationConfig: { temperature: 0, maxOutputTokens: 16384 },
              });

        for (let attempt = 0; attempt < maxRetriesPerModel; attempt++) {
          try {
            const result = await candidateModel.generateContent(parts as any);
            return await result.response;
          } catch (err: any) {
            lastErr = err;
            const status = err?.status;
            const isOverloaded = status === 503 || status === 429 || status === 500;
            if (isOverloaded && attempt < maxRetriesPerModel - 1) {
              const waitMs = (attempt + 1) * 5000;
              await new Promise((r) => setTimeout(r, waitMs));
              continue;
            }
            // Erro não-recuperável ou esgotou tentativas deste modelo → próximo modelo
            break;
          }
        }
      }
      throw lastErr || new Error('OCR falhou em todos os modelos candidatos');
    }

    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('OCR timeout')), timeoutMs);
    });

    const response = await Promise.race([generateWithResilience(), timeoutPromise]).finally(() =>
      clearTimeout(timeoutId!),
    );

    const text = (response as any).text();
    const durationMs = Date.now() - startTime;

    if (!text || text.trim().length < 50) {
      return {
        text: '',
        success: false,
        method: 'failed',
        durationMs,
        pageCount: null,
        confidence: 'low',
        error: 'OCR retornou texto vazio ou muito curto',
      };
    }

    // Contar páginas detectadas
    const pageMatches = text.match(/---\s*PÁGINA\s*\d+\s*---/gi);
    const pageCount = pageMatches ? pageMatches.length : 1;

    // Avaliar confiança baseado na presença de marcadores de ilegibilidade
    const illegibleCount = (text.match(/\[ILEGÍVEL\]/gi) || []).length;
    const unknownCount = (text.match(/\[\?\]/g) || []).length;
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (illegibleCount > 10 || unknownCount > 20) confidence = 'low';
    else if (illegibleCount > 3 || unknownCount > 5) confidence = 'medium';

    return {
      text: text.trim(),
      success: true,
      method: 'gemini_ocr',
      durationMs,
      pageCount,
      confidence,
    };
  } catch (error: any) {
    return {
      text: '',
      success: false,
      method: 'failed',
      durationMs: Date.now() - startTime,
      pageCount: null,
      confidence: 'low',
      error: error?.message || 'Erro desconhecido no OCR',
    };
  }
}
