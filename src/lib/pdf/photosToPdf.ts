/**
 * Foto → PDF no CLIENTE (Nova Análise).
 *
 * Produtor fotografa as páginas da matrícula no celular; aqui as N imagens
 * viram UM PDF (1 foto/página A4) que entra no fluxo de upload existente.
 * O bucket continua PDF-only e o pipeline de OCR não muda — o backend nem
 * fica sabendo que era foto. Ver spec 2026-07-03-foto-matricula-upload-design.md.
 *
 * Client-side only: usa createImageBitmap/canvas (normaliza a orientação EXIF
 * — foto de celular chega "deitada" sem isso) e pdf-lib (dep existente).
 */

import { PDFDocument } from 'pdf-lib';

export const MAX_FOTOS = 20;
export const MAX_FOTO_MB = 8;
const MAX_FOTO_BYTES = MAX_FOTO_MB * 1024 * 1024;
const JPEG_QUALITY = 0.85;
// A4 em pontos (72 dpi): 595 × 842
const A4 = { width: 595.28, height: 841.89 } as const;

/** Validação pura (testável em jsdom): retorna mensagem de erro ou null. */
export function validarFoto(file: { type: string; size: number; name: string }): string | null {
  if (!file.type.startsWith('image/')) {
    return `"${file.name}" não é uma imagem — envie fotos JPEG ou PNG.`;
  }
  if (file.size > MAX_FOTO_BYTES) {
    return `"${file.name}" excede ${MAX_FOTO_MB} MB. Fotografe em resolução menor.`;
  }
  return null;
}

/** Validação pura do lote. */
export function validarLoteFotos(totalAtual: number, novas: number): string | null {
  if (totalAtual + novas > MAX_FOTOS) {
    return `Limite de ${MAX_FOTOS} fotos por documento atingido.`;
  }
  return null;
}

/**
 * Decodifica a imagem já com a orientação EXIF aplicada e recomprime em JPEG.
 * Falha de decodificação (ex: HEIC sem suporte no browser) vira erro claro.
 */
async function normalizarFoto(file: File): Promise<{ jpegBytes: ArrayBuffer; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Não foi possível ler "${file.name}". Envie a foto em JPEG ou PNG (formatos como HEIC não são suportados pelo navegador).`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error(`Falha ao processar "${file.name}".`);
  return { jpegBytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height };
}

/**
 * Converte N fotos num único PDF (uma foto por página A4, proporção
 * preservada, foto paisagem gira a página). Retorna um File PDF pronto pro
 * fluxo de upload existente.
 */
export async function photosToPdf(fotos: File[]): Promise<File> {
  if (fotos.length === 0) throw new Error('Nenhuma foto selecionada.');

  const pdf = await PDFDocument.create();

  for (const foto of fotos) {
    const { jpegBytes, width, height } = await normalizarFoto(foto);
    const image = await pdf.embedJpg(jpegBytes);

    // Página A4 na orientação da foto; imagem centralizada com margem mínima
    const paisagem = width > height;
    const pageW = paisagem ? A4.height : A4.width;
    const pageH = paisagem ? A4.width : A4.height;
    const page = pdf.addPage([pageW, pageH]);

    const margin = 12;
    const scale = Math.min((pageW - margin * 2) / width, (pageH - margin * 2) / height);
    const w = width * scale;
    const h = height * scale;
    page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  }

  const bytes = await pdf.save();
  const nome = `matricula-fotos-${fotos.length}pag-${Date.now()}.pdf`;
  return new File([new Uint8Array(bytes)], nome, { type: 'application/pdf' });
}
