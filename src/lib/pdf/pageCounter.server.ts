import { PDFDocument } from 'pdf-lib';

export async function countPdfPagesFromBuffer(buffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPageCount();
    return pages > 0 ? pages : 1;
  } catch (error) {
    console.error("Erro no countPdfPagesFromBuffer:", error);
    // Fallback baseado no tamanho do arquivo se a leitura estrutural falhar
    if (buffer && buffer.length && buffer.length > 3.5 * 1024 * 1024) {
      return Math.max(1, Math.floor(buffer.length / (1.5 * 1024 * 1024)));
    }
    return 1;
  }
}

