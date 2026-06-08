// @ts-expect-error: pdf-parse does not have a default export in its types but works at runtime
import pdfParse from 'pdf-parse';

export async function countPdfPagesFromBuffer(buffer: Buffer): Promise<number> {
  try {
    // Apenas renderiza a estrutura de páginas sem extrair texto (economiza RAM/CPU)
    const options = {
      pagerender: () => ''
    };
    
    const data = await pdfParse(buffer, options);
    
    if (data && typeof data.numpages === 'number' && data.numpages > 0) {
      return data.numpages;
    }
    
    throw new Error('Falha ao obter número de páginas válidas do PDF.');
  } catch (error) {
    console.error("Erro no countPdfPagesFromBuffer:", error);
    throw new Error("Não foi possível contar as páginas deste PDF de forma segura.");
  }
}
