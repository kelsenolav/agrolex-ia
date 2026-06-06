/**
 * SPRINT P0-B.1 — Extrator Híbrido de Texto PDF (Server-Safe)
 *
 * Extrai texto de PDFs server-side usando pdfjs-dist diretamente,
 * sem depender do worker path do pdf-parse que falha no Next.js/Turbopack.
 *
 * Fluxo:
 * 1. Tenta pdfjs-dist (buffer → texto) com worker carregado via file://
 * 2. Se texto ≥ 500 caracteres úteis → sucesso (method: "pdfjs-dist")
 * 3. Se falha ou texto insuficiente → fallback (method: "fallback-base64")
 *
 * Critérios de validação:
 * - Mínimo 500 caracteres úteis (excluindo espaços/símbolos)
 * - pageCount > 0 quando disponível
 * - Texto não pode ser composto apenas de espaços/símbolos
 */

import path from 'node:path';

export interface PdfExtractionResult {
  /** true se a extração textual foi bem-sucedida */
  success: boolean;
  /** Texto extraído (vazio se falhou) */
  text: string;
  /** Número de páginas detectadas (undefined se indisponível) */
  pageCount?: number;
  /** Motivo da falha (apenas quando success === false) */
  reason?: string;
  /** Método utilizado: "pdfjs-dist" | "fallback-base64" */
  method: 'pdfjs-dist' | 'fallback-base64';
}

/**
 * Conta caracteres úteis (excluindo espaços, quebras de linha, tabs e símbolos não textuais)
 */
function countUsefulChars(text: string): number {
  if (!text) return 0;
  // Remove espaços, quebras, tabs
  const cleaned = text.replace(/[\s\n\r\t]+/g, ' ').trim();
  // Conta apenas caracteres alfanuméricos (incluindo acentos latinos) e pontuação comum
  const useful = cleaned.replace(
    /[^a-zA-Z0-9áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇàèìòùÀÈÌÒÙäëïöüÄËÏÖÜ.,;:()\-/\[\]ºª°%$#@!?&+=]/g,
    ''
  );
  return useful.length;
}

/**
 * Verifica se o texto extraído é válido segundo os critérios mínimos.
 */
function isValidExtraction(text: string, pageCount?: number): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Verificar se o texto não é composto apenas de espaços/símbolos
  const usefulChars = countUsefulChars(text);
  if (usefulChars < 500) {
    return false;
  }

  // Verificar pageCount quando disponível
  if (pageCount !== undefined && pageCount <= 0) {
    return false;
  }

  return true;
}

/**
 * Converte um caminho de arquivo absoluto para file:// URL (cross-platform)
 */
function toFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/');
  // Windows: C:/path → file:///C:/path
  // Unix: /path → file:///path
  if (normalized.startsWith('/')) {
    return 'file://' + normalized;
  }
  return 'file:///' + normalized;
}

/**
 * Resolve o caminho do worker do pdfjs-dist.
 * Tenta múltiplas localizações possíveis em node_modules.
 */
function resolveWorkerPath(): string | null {
  const candidates = [
    // pdf-parse inclui o worker em sua distribuição
    path.resolve(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs'),
    // pdfjs-dist pode ter o worker diretamente
    path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
    path.resolve(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
  ];

  for (const candidate of candidates) {
    try {
      // Verificar se o arquivo existe
      const fs = require('node:fs') as typeof import('node:fs');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Extrai texto de um buffer PDF usando pdfjs-dist diretamente.
 *
 * A abordagem server-safe:
 * 1. Importa pdfjs-dist/legacy/build/pdf.mjs (compatível com Node.js)
 * 2. Configura GlobalWorkerOptions.workerSrc com file:// URL do worker
 * 3. Usa getDocument() para carregar e extrair texto página por página
 *
 * @param buffer - Buffer do arquivo PDF
 * @returns Resultado da extração com texto, método e metadados
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  // Validação rápida: verificar magic number do PDF
  if (!buffer || buffer.length < 5) {
    return {
      success: false,
      text: '',
      reason: 'Buffer inválido ou vazio',
      method: 'fallback-base64',
    };
  }

  const header = buffer.slice(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    return {
      success: false,
      text: '',
      reason: 'Arquivo não é um PDF válido (magic number ausente)',
      method: 'fallback-base64',
    };
  }

  try {
    // Import dinâmico do pdfjs-dist (legacy build para Node.js)
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Configurar worker para ambiente server-side
    // Em Node.js, pdfjs-dist tenta importar o worker dinamicamente.
    // Precisamos apontar para o arquivo real do worker via file:// URL.
    const workerPath = resolveWorkerPath();
    if (workerPath) {
      pdfjs.GlobalWorkerOptions.workerSrc = toFileUrl(workerPath);
    }
    // Se não encontrar o worker, o pdfjs-dist usará fake worker (main thread)
    // que pode funcionar para PDFs simples, mas é menos robusto.

    // Carregar documento
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      // Desabilitar fetch de fontes padrão para evitar warnings não-críticos
      standardFontDataUrl: undefined,
      useWorkerFetch: false,
      isEvalSupported: false,
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;

    // Extrair texto de todas as páginas
    const pageTexts: string[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      pageTexts.push(pageText);
      page.cleanup();
    }

    // Limpeza
    await doc.destroy();

    const extractedText = pageTexts.join('\n\n');

    // Validar extração
    if (isValidExtraction(extractedText, numPages)) {
      console.log(`[PDF Extractor] pdfjs-dist extração textual usada — ${numPages} páginas, ${countUsefulChars(extractedText)} caracteres úteis`);
      return {
        success: true,
        text: extractedText,
        pageCount: numPages,
        method: 'pdfjs-dist',
      };
    }

    // Texto insuficiente — provável PDF escaneado
    const usefulChars = countUsefulChars(extractedText);
    console.log(`[PDF Extractor] Texto insuficiente: ${usefulChars} caracteres úteis (mínimo: 500) — usando fallback base64`);
    return {
      success: false,
      text: '',
      pageCount: numPages,
      reason: `Texto extraído insuficiente: ${usefulChars} caracteres úteis (mínimo: 500)`,
      method: 'fallback-base64',
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'Erro desconhecido na extração';
    console.log(`[PDF Extractor] Falha na extração pdfjs-dist: ${errorMessage.slice(0, 200)} — usando fallback base64`);
    return {
      success: false,
      text: '',
      reason: `Falha na extração pdfjs-dist: ${errorMessage.slice(0, 200)}`,
      method: 'fallback-base64',
    };
  }
}