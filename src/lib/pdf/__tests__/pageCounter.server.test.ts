import { countPdfPagesFromBuffer } from '../pageCounter.server';
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

  it('lança erro controlado se o PDF for inválido ou não tiver numpages', async () => {
    (pdfParse as jest.Mock).mockResolvedValue({ numpages: null });
    
    const mockBuffer = Buffer.from('invalid-content');
    await expect(countPdfPagesFromBuffer(mockBuffer)).rejects.toThrow("Não foi possível contar as páginas deste PDF de forma segura.");
  });

  it('lança erro controlado se pdf-parse falhar internamente', async () => {
    (pdfParse as jest.Mock).mockRejectedValue(new Error('PDF Parse error'));
    
    const mockBuffer = Buffer.from('invalid-content');
    await expect(countPdfPagesFromBuffer(mockBuffer)).rejects.toThrow("Não foi possível contar as páginas deste PDF de forma segura.");
  });
});
