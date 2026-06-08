import { countPdfPagesFromBuffer } from '../pageCounter.server';

describe('pageCounter.server.ts', () => {
  it('retorna a quantidade correta de páginas de um PDF simulado com marcações /Type /Page', async () => {
    // Simulando um PDF com 3 páginas
    const mockPdfContent = 'some header\n/Type /Page\n/Type/Page\n/Type   /Page\n/Type /Pages';
    const mockBuffer = Buffer.from(mockPdfContent, 'binary');
    
    const pages = await countPdfPagesFromBuffer(mockBuffer);
    expect(pages).toBe(3);
  });

  it('retorna 1 (fallback) se não houver marcações /Type /Page', async () => {
    const mockBuffer = Buffer.from('PDF sem paginas explicitas', 'binary');
    const pages = await countPdfPagesFromBuffer(mockBuffer);
    expect(pages).toBe(1);
  });

  it('retorna 1 (fallback) em caso de erro', async () => {
    // @ts-expect-error: passamos null para forçar um erro na leitura do buffer
    const pages = await countPdfPagesFromBuffer(null);
    expect(pages).toBe(1);
  });
});

