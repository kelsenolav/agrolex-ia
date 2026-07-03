# Upload de foto da matrícula (foto → PDF no cliente)

> **Funil/mobile** — remove a barreira "só aceita PDF" pro produtor com a
> matrícula em papel e o celular na mão (única capacidade "mobile" com dor real
> observada; decidida em product-brainstorming da avaliação app Android/iOS)
> Data: 2026-07-03 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`

## 1. Decisões fechadas com o usuário

1. **Escopo**: só Nova Análise (Cofre/Data Room segue PDF-only).
2. **UX**: N fotos → **1 PDF**, com pré-via em miniaturas ordenadas (pág. 1..N)
   e remoção antes de gerar; o PDF entra na lista de documentos como os demais.
3. **Limites**: até 20 fotos, 8MB/foto (antes da compressão).

## 2. Abordagem (A — conversão client-side)

Nenhuma mudança em bucket (segue `application/pdf`-only por decisão anterior),
nenhuma mudança em `/api/analyze` (crítico) nem no pipeline de OCR — o backend
recebe um PDF normal.

| Arquivo | Papel |
|---|---|
| `src/lib/pdf/photosToPdf.ts` *(novo, client-side)* | `photosToPdf(files) → File`: valida (20 fotos / 8MB / tipos image/*), normaliza orientação EXIF (`createImageBitmap` + canvas — foto de celular chega rotacionada), comprime JPEG q=0.85, monta PDF A4 (1 foto/página, proporção preservada) com `pdf-lib` (dep existente). Constantes exportadas p/ teste. |
| `src/app/dashboard/nova-analise/page.tsx` | Seção aditiva na etapa de documentos: input `accept="image/*" capture="environment" multiple`, miniaturas com remover, botão "Gerar documento (N página(s))" → `photosToPdf` → `processFiles([pdf])` **existente**. Zero mudança no fluxo de PDF atual. |

Nome do PDF gerado: `matricula-fotos-<n>pag-<timestamp>.pdf` (passa no
`validateFile` atual: PDF < 20MB — compressão garante margem).

## 3. Erros

- Foto >8MB ou tipo não-imagem → toast por arquivo, sem abortar as demais.
- >20 fotos → toast e corta.
- Falha de decodificação (HEIC sem suporte no browser etc.) → toast pedindo
  JPEG/PNG (câmera nativa entrega JPEG; HEIC só em transferência de arquivos).
- PDF final >20MB (teto do validateFile) → toast pedindo menos fotos.

## 4. Testes

- Unitário (jsdom): validação de limites e tipos (parte pura exportada).
- Preview real: gerar imagens via canvas no browser, injetar no input com
  `DataTransfer`, conferir PDF na lista e página count via pdf-lib.

## 5. Risco

`nova-analise/page.tsx` é crítico no baseline — mudança aditiva, fluxo PDF
intocado. Rollback = revert de 1 commit.
