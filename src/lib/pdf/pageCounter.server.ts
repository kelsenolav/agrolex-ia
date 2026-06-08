export async function countPdfPagesFromBuffer(buffer: Buffer): Promise<number> {
  try {
    // Abordagem super rápida nativa: procura por marcações de página no binário do PDF
    // Evita crashes com bibliotecas CJS incompatíveis com o Turbopack no Edge/Node
    const bufferString = buffer.toString('binary');
    const matches = bufferString.match(/\/Type[\s]*\/Page[^s]/g);
    
    if (matches && matches.length > 0) {
      return matches.length;
    }
    
    // Fallback conservador se o PDF for muito ofuscado
    return 1;
  } catch (error) {
    console.error("Erro no countPdfPagesFromBuffer:", error);
    return 1;
  }
}
