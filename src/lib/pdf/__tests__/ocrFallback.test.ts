/**
 * Testes do orquestrador de OCR multi-provedor (ocrWithFallback).
 *
 * Usa injeção de dependência para simular Gemini/Claude/OpenAI sem bater nas APIs
 * reais. Cobre o gap de robustez: se Gemini E Claude caírem, o OpenAI assume o OCR
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

describe('ocrWithFallback — resiliência multi-provedor (Gemini → Claude → OpenAI)', () => {
  const ORIG_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
  const ORIG_OPENAI = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    // Por padrão, as duas chaves de fallback existem; cada teste ajusta conforme precisa.
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.OPENAI_API_KEY = 'sk-openai-test';
  });
  afterEach(() => {
    if (ORIG_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = ORIG_ANTHROPIC;
    if (ORIG_OPENAI === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ORIG_OPENAI;
  });

  it('retorna o Gemini quando ele sucede, sem chamar Claude nem OpenAI', async () => {
    const gemini = jest.fn().mockResolvedValue(ok(LONG, 'gemini_ocr'));
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));
    const openai = jest.fn().mockResolvedValue(ok(LONG, 'openai_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(r.success).toBe(true);
    expect(r.method).toBe('gemini_ocr');
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(claude).not.toHaveBeenCalled();
    expect(openai).not.toHaveBeenCalled();
  });

  it('cai para o Claude quando o Gemini falha, sem chamar OpenAI', async () => {
    const gemini = jest.fn().mockResolvedValue(fail('503 service unavailable'));
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));
    const openai = jest.fn().mockResolvedValue(ok(LONG, 'openai_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(r.success).toBe(true);
    expect(r.method).toBe('claude_ocr');
    expect(claude).toHaveBeenCalledTimes(1);
    expect(openai).not.toHaveBeenCalled();
  });

  it('cai para o Claude quando o Gemini retorna texto insuficiente (<100 chars)', async () => {
    const gemini = jest.fn().mockResolvedValue(ok('curto', 'gemini_ocr'));
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));
    const openai = jest.fn().mockResolvedValue(ok(LONG, 'openai_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(r.method).toBe('claude_ocr');
    expect(openai).not.toHaveBeenCalled();
  });

  it('cai para o OpenAI quando Gemini E Claude falham (apagão duplo)', async () => {
    const gemini = jest.fn().mockResolvedValue(fail('503 gemini'));
    const claude = jest.fn().mockResolvedValue(fail('400 credit balance too low'));
    const openai = jest.fn().mockResolvedValue(ok(LONG, 'openai_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(r.success).toBe(true);
    expect(r.method).toBe('openai_ocr');
    expect(openai).toHaveBeenCalledTimes(1);
  });

  it('cai para o OpenAI quando o Claude retorna texto insuficiente', async () => {
    const gemini = jest.fn().mockResolvedValue(fail('503 gemini'));
    const claude = jest.fn().mockResolvedValue(ok('curto', 'claude_ocr'));
    const openai = jest.fn().mockResolvedValue(ok(LONG, 'openai_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(r.method).toBe('openai_ocr');
    expect(openai).toHaveBeenCalledTimes(1);
  });

  it('NÃO chama o Claude se ANTHROPIC_API_KEY não estiver configurada (vai direto ao OpenAI)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const gemini = jest.fn().mockResolvedValue(fail('503 service unavailable'));
    const claude = jest.fn().mockResolvedValue(ok(LONG, 'claude_ocr'));
    const openai = jest.fn().mockResolvedValue(ok(LONG, 'openai_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(claude).not.toHaveBeenCalled();
    expect(r.method).toBe('openai_ocr');
  });

  it('NÃO chama o OpenAI se OPENAI_API_KEY não estiver configurada', async () => {
    delete process.env.OPENAI_API_KEY;
    const gemini = jest.fn().mockResolvedValue(fail('503 gemini'));
    const claude = jest.fn().mockResolvedValue(fail('overloaded claude'));
    const openai = jest.fn().mockResolvedValue(ok(LONG, 'openai_ocr'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(openai).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
  });

  it('retorna falha combinada quando os três provedores falham (sem fabricar)', async () => {
    const gemini = jest.fn().mockResolvedValue(fail('503 gemini'));
    const claude = jest.fn().mockResolvedValue(fail('overloaded claude'));
    const openai = jest.fn().mockResolvedValue(fail('rate limited openai'));

    const r = await ocrWithFallback(DUMMY_PDF, {}, { gemini, claude, openai });

    expect(r.success).toBe(false);
    expect(r.text).toBe('');
    expect(r.error).toContain('Gemini');
    expect(r.error).toContain('Claude');
    expect(r.error).toContain('OpenAI');
  });
});
