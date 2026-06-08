import { countPdfPagesFromBuffer } from '../pageCounter.server';
// @ts-expect-error: pdf-parse does not have a default export in its types but works at runtime
import pdfParse from 'pdf-parse';

jest.mock('pdf-parse', () => jest.fn());

describe('pageCounter.server.ts', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retorna a quantidade correta de páginas de um PDF válido', async () => {
    (pdfParse as jest.Mock).mockResolvedValue({ numpages: 12 });
    
    const mockBuffer = Buffer.from('fake-pdf-content');
    const pages = await countPdfPagesFromBuffer(mockBuffer);
    
    expect(pages).toBe(12);
    expect(pdfParse).toHaveBeenCalledWith(mockBuffer, expect.objectContaining({
      pagerender: expect.any(Function)
    }));
  });

  it('retorna 1 (fallback) se o PDF for inválido ou não tiver numpages', async () => {
    (pdfParse as jest.Mock).mockResolvedValue({ numpages: null });
    
    const mockBuffer = Buffer.from('invalid-content');
    const pages = await countPdfPagesFromBuffer(mockBuffer);
    expect(pages).toBe(1);
  });

  it('retorna 1 (fallback) se pdf-parse falhar internamente', async () => {
    (pdfParse as jest.Mock).mockRejectedValue(new Error('PDF Parse error'));
    
    const mockBuffer = Buffer.from('invalid-content');
    const pages = await countPdfPagesFromBuffer(mockBuffer);
    expect(pages).toBe(1);
  });
});
