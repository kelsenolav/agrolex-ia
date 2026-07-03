import { validarFoto, validarLoteFotos, MAX_FOTOS, MAX_FOTO_MB } from '../photosToPdf';

// photosToPdf/normalizarFoto usam canvas/createImageBitmap (browser-only) —
// cobertos pela verificação real no preview. Aqui, a lógica pura de validação.

describe('validarFoto', () => {
  it('aceita JPEG e PNG dentro do limite', () => {
    expect(validarFoto({ type: 'image/jpeg', size: 1024, name: 'a.jpg' })).toBeNull();
    expect(validarFoto({ type: 'image/png', size: 1024, name: 'b.png' })).toBeNull();
  });

  it('rejeita não-imagem com mensagem clara', () => {
    const err = validarFoto({ type: 'application/pdf', size: 1024, name: 'doc.pdf' });
    expect(err).toContain('não é uma imagem');
    expect(err).toContain('doc.pdf');
  });

  it(`rejeita foto acima de ${MAX_FOTO_MB}MB`, () => {
    const err = validarFoto({ type: 'image/jpeg', size: (MAX_FOTO_MB + 1) * 1024 * 1024, name: 'grande.jpg' });
    expect(err).toContain(`${MAX_FOTO_MB} MB`);
  });

  it('aceita exatamente no limite', () => {
    expect(validarFoto({ type: 'image/jpeg', size: MAX_FOTO_MB * 1024 * 1024, name: 'ok.jpg' })).toBeNull();
  });
});

describe('validarLoteFotos', () => {
  it('aceita até o limite total', () => {
    expect(validarLoteFotos(0, MAX_FOTOS)).toBeNull();
    expect(validarLoteFotos(MAX_FOTOS - 1, 1)).toBeNull();
  });

  it('rejeita quando o acumulado passa do limite', () => {
    expect(validarLoteFotos(MAX_FOTOS, 1)).toContain(`${MAX_FOTOS}`);
    expect(validarLoteFotos(15, 10)).toContain(`${MAX_FOTOS}`);
  });
});
