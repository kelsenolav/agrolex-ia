/**
 * textExtractor.server.ts
 *
 * Extrai texto nativo de PDFs usando pdf2json.
 * Detecta PDFs escaneados (sem camada de texto digital).
 * Server-only: não importar em componentes client-side.
 */

import type { PdfPageInfo, PdfExtractionResult, TextExtractorOptions } from './types';

export type { PdfPageInfo, PdfExtractionResult, TextExtractorOptions };

const MIN_EXTRACTABLE_CHARS = 100;
const DEFAULT_MAX_PAGES = 50;

export async function extractTextFromPdfBuffer(
  buffer: Buffer,
  options: TextExtractorOptions = {},
): Promise<PdfExtractionResult> {
  const startTime = Date.now();

  if (!buffer || buffer.length === 0) {
    return createEmptyResult(startTime);
  }

  try {
    const PDFParser = (await import('pdf2json')).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParser as any)(null, 1);

    const rawText: string = await new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parser.on('pdfParser_dataReady', () => resolve((parser as any).getRawTextContent() as string));
      parser.on('pdfParser_dataError', (err: unknown) => reject(err));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (parser as any).parseBuffer(buffer);
    });

    // Split by pdf2json page markers
    const pageBreak = '----------------Page (';
    const rawPages = rawText.split(pageBreak);
    // First element is content before first page break (page 0 content)
    const pages: PdfPageInfo[] = [];
    const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

    for (let i = 0; i < Math.min(rawPages.length, maxPages + 1); i++) {
      let pageText: string;
      if (i === 0) {
        pageText = rawPages[0].trim();
      } else {
        // Strip the marker suffix ") Break----------------"
        const afterMarker = rawPages[i].replace(/^\d+\) Break-+\n?/, '');
        pageText = afterMarker.trim();
      }
      if (pageText.length === 0) continue;
      pages.push({
        pageNumber: i + 1,
        text: pageText,
        charCount: pageText.length,
      });
    }

    const totalCharCount = pages.reduce((sum, p) => sum + p.charCount, 0);
    const hasExtractableText = totalCharCount >= MIN_EXTRACTABLE_CHARS;
    const isScanned = totalCharCount < MIN_EXTRACTABLE_CHARS;

    const truncatedText = pages
      .map((p) => `[p. ${p.pageNumber}]\n${p.text}`)
      .join('\n\n');

    return {
      text: truncatedText,
      pageCount: pages.length,
      hasExtractableText,
      isScanned,
      pages,
      extractionMethod: hasExtractableText ? 'native' : 'empty',
      extractionDurationMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[textExtractor] Erro na extração de texto do PDF:', error);
    return createEmptyResult(startTime);
  }
}

function createEmptyResult(startTime: number): PdfExtractionResult {
  return {
    text: '',
    pageCount: 0,
    hasExtractableText: false,
    isScanned: false,
    pages: [],
    extractionMethod: 'empty',
    extractionDurationMs: Date.now() - startTime,
  };
}
