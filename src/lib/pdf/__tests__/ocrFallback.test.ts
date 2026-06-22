/**
 * Testes do orquestrador de OCR multi-provedor (ocrWithFallback).
 *
 * Usa injeção de dependência para simular Gemini/Claude sem bater nas APIs reais.
 * Cobre o gap de robustez: se o Gemini cair por completo, o Claude assume o OCR
 * preservando a garantia anti-alucinação (texto insuficiente → falha, não fabrica).
 */
import { ocrWithFallback, type OcrResult } from '../ocrPreProcessor';

const DUMMY_PDF = Buffer.from('%PDF-1.4 dummy');

function ok(text: string, method: OcrResult['method'] = 'gemini_ocr'): OcrResult {
  return { text, success: true, method, durationMs: 10, pageCount: 1, confidence: 'high' };
}
function fail(error: string): OcrResult {
  return { text: '', success: false, method: 'failed', durationMs: 10, pageCount: null, confidence: 'low', error };
}

const LONG = 'A'.repeat(500); // > 100 chars úteis

describe('ocrWithFallback — resiliência multi-provedor', () => {
  const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
  });

  it('retorna o Gemini quando ele sucede, sem chamar o Claude', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const gemini = jest.fn().mockResolvedValue(ok(LONG, 'gemini_ocr'));
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude });

    expect(r.success).toBe(true);
    expect(r.method).toBe('gemini_ocr');
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(claude).not.toHaveBeenCalled();
  });

  it('cai para o Claude quando o Gemini falha (apagão total)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const gemini = jest.fn().mockResolvedValue(fail('503 service unavailable'));
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude });

    expect(r.success).toBe(true);
    expect(r.method).toBe('claude_ocr');
    expect(claude).toHaveBeenCalledTimes(1);
  });

  it('cai para o Claude quando o Gemini retorna texto insuficiente (<100 chars)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const gemini = jest.fn().mockResolvedValue(ok('curto', 'gemini_ocr')); // success mas texto curto
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude });

    expect(r.method).toBe('claude_ocr');
    expect(claude).toHaveBeenCalledTimes(1);
  });

  it('NÃO chama o Claude se ANTHROPIC_API_KEY não estiver configurada', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const gemini = jest.fn().mockResolvedValue(fail('503 service unavailable'));
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude });

    expect(r.success).toBe(false);
    expect(claude).not.toHaveBeenCalled();
  });

  it('retorna falha combinada quando ambos os provedores falham (sem fabricar)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const gemini = jest.fn().mockResolvedValue(fail('503 gemini'));
    const claude = jest.fn().mockResolvedValue(fail('overloaded claude'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude });

    expect(r.success).toBe(false);
    expect(r.text).toBe('');
    expect(r.error).toContain('Gemini');
    expect(r.error).toContain('Claude');
  });
});
