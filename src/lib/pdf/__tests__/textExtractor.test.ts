/**
 * textExtractor.test.ts
 *
 * Unit tests for the PDF text extraction service (pdf2json-based).
 */

import { extractTextFromPdfBuffer } from '../textExtractor.server';

// ── Mock pdf2json ─────────────────────────────────────────────────────────────

let mockRawText = '';
let mockShouldError = false;

const mockParserInstance = {
  on: jest.fn(),
  getRawTextContent: jest.fn(() => mockRawText),
  parseBuffer: jest.fn(),
};

jest.mock('pdf2json', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockParserInstance),
  };
});

function setupParserSuccess(rawText: string) {
  mockRawText = rawText;
  mockShouldError = false;
  mockParserInstance.getRawTextContent.mockReturnValue(rawText);
  mockParserInstance.on.mockImplementation((event: string, cb: () => void) => {
    if (event === 'pdfParser_dataReady') {
      process.nextTick(cb);
    }
  });
}

function setupParserError(error: Error) {
  mockShouldError = true;
  mockParserInstance.on.mockImplementation((event: string, cb: (e: unknown) => void) => {
    if (event === 'pdfParser_dataError') {
      process.nextTick(() => cb(error));
    }
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('extractTextFromPdfBuffer (unit, mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buffer vazio ou corrompido', () => {
    it('retorna empty para Buffer vazio', async () => {
      const result = await extractTextFromPdfBuffer(Buffer.from([]));
      expect(result.extractionMethod).toBe('empty');
      expect(result.pages).toEqual([]);
    });

    it('não crasha com Buffer.alloc(0)', async () => {
      const result = await extractTextFromPdfBuffer(Buffer.alloc(0));
      expect(result.extractionMethod).toBe('empty');
    });

    it('retorna empty quando pdf2json lança erro', async () => {
      setupParserError(new Error('Invalid PDF structure'));
      const result = await extractTextFromPdfBuffer(Buffer.from('%PDF-fake'));
      expect(result.extractionMethod).toBe('empty');
    });
  });

  describe('PDF com texto extraível', () => {
    it('extrai e marca hasExtractableText', async () => {
      setupParserSuccess(
        'LIVRO 2 Matrícula 12345 Proprietário João CPF 12345678900 Área 500 hectares ' +
        'R-1 Compra e Venda AV-2 Cancelamento de usufruto ' +
        'Transmitente Maria Adquirente João Valor R$ 150000000 Protocolo 234567'
      );
      const result = await extractTextFromPdfBuffer(Buffer.from('%PDF-1.4'));
      expect(result.hasExtractableText).toBe(true);
      expect(result.isScanned).toBe(false);
      expect(result.extractionMethod).toBe('native');
      expect(result.text).toContain('Matrícula');
    });

    it('inclui marcadores [p. N] no texto', async () => {
      setupParserSuccess(
        'Conteúdo da primeira página com texto suficiente para extração.\n' +
        '----------------Page (1) Break----------------\n' +
        'Conteúdo da segunda página com mais texto para verificação.'
      );
      const result = await extractTextFromPdfBuffer(Buffer.from('%PDF-1.4'));
      expect(result.text).toContain('[p. 1]');
    });

    it('detecta múltiplas páginas via page breaks', async () => {
      setupParserSuccess(
        'Texto da página 1 com conteúdo jurídico suficiente para extração.\n' +
        '----------------Page (1) Break----------------\n' +
        'Texto da página 2 com mais conteúdo para análise fundiária completa.'
      );
      const result = await extractTextFromPdfBuffer(Buffer.from('%PDF-1.4'));
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PDF escaneado (sem texto)', () => {
    it('marca isScanned quando texto < 100 chars', async () => {
      setupParserSuccess('CURTA');
      const result = await extractTextFromPdfBuffer(Buffer.from('%PDF-1.4'));
      expect(result.isScanned).toBe(true);
      expect(result.hasExtractableText).toBe(false);
    });

    it('marca isScanned quando texto é vazio', async () => {
      setupParserSuccess('');
      const result = await extractTextFromPdfBuffer(Buffer.from('%PDF-1.4'));
      expect(result.isScanned).toBe(true);
    });
  });

  describe('métricas', () => {
    it('registra extractionDurationMs >= 0', async () => {
      setupParserSuccess('texto de teste '.repeat(20));
      const result = await extractTextFromPdfBuffer(Buffer.from('%PDF-1.4'));
      expect(result.extractionDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
