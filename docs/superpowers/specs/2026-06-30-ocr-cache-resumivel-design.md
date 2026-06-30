# Análise de matrícula resumível — Cache de OCR (anti-timeout)

> **Segurança da análise de matrículas** · Data: 2026-06-30
> Branch: `stable/rebuild-beta-01-laudo-compartilhavel`

## 1. Problema-raiz

`/api/analyze` faz OCR (N páginas, página-a-página) + Análise IA + Pós-processamento numa **única função Vercel de `maxDuration=300s`**. Matrículas densas (6+ páginas) não cabem. Pior: **o OCR transcrito NÃO é persistido** — `ocrTextBlocks` é reconstruído a cada invocação. Logo **todo retry refaz o OCR do zero** e nunca converge. Os guardas de orçamento de tempo (já implementados) impedem o órfão (falham limpo), mas a densa ainda não conclui porque o retry não faz progresso.

## 2. Solução: cache de OCR (retry resumível)

Persistir o texto transcrito do OCR em `findings.ocr_cache` e reaproveitá-lo nas re-execuções. Cada invocação passa a avançar:

- **Invocação 1**: OCR → **persiste `ocr_cache`** (checkpoint) → tenta a análise. Se a análise não couber no orçamento, falha LIMPO (`ai_timeout`/`ai_unavailable`, re-tentável) — mas o OCR fica salvo.
- **Auto-chain** (dashboard, já existe) re-dispara com `forceRetry`.
- **Invocação 2**: `ocr_cache` HIT → pula o OCR → análise com o orçamento quase inteiro → **completa**.

Garante conclusão de qualquer matrícula em ≤2 passos, sem perder trabalho e sem órfão. A blindagem determinística do veredito (Eixo 1) permanece intacta.

## 3. Contrato

```ts
// findings.ocr_cache (novo campo, aditivo)
{
  done: true,
  blocks: string[],              // os ocrTextBlocks transcritos (1 por documento)
  diagnostics: {                 // pdfExtractionDiags relevante p/ o portão de suficiência
    ocr_incomplete: boolean,
    ocr_pages: { expected: number; transcribed: number } | null,
    markdown_success: number,
    extraction_total_ms: number,
    warnings: string[],
  },
  cached_at: string,             // ISO
}
```

## 4. Mudanças (cirúrgicas, aditivas)

**`src/app/api/analyze/route.ts`** (apenas o trecho de OCR, ~1423–1540):

1. **Reuso (no início do OCR)**: antes do loop de documentos, se `findings.ocr_cache?.done && Array.isArray(findings.ocr_cache.blocks)`:
   - `ocrTextBlocks = findings.ocr_cache.blocks`
   - restaura `pdfExtractionDiags` a partir de `ocr_cache.diagnostics`
   - `anyOcrUsed = true`
   - **pula o loop de OCR** (log "OCR reaproveitado do cache").

2. **Checkpoint (após o loop de OCR, antes de montar a análise)**: se houve OCR novo (não veio do cache) e `anyOcrUsed`, gravar:
   ```ts
   await supabaseAdmin.from('analyses').update({
     findings: { ...findings, ocr_cache: { done: true, blocks: ocrTextBlocks, diagnostics: {...}, cached_at: new Date().toISOString() } }
   }).eq('id', analysisId);
   ```
   (Atualiza só o campo via merge; mantém status `processing`.)

3. **Reset do cache em forceRetry total** (opcional, seguro): se `forceRetry` E o usuário quer releitura limpa — NÃO invalidar por padrão (queremos resumir). O cache só é escrito; nunca apaga dados do laudo.

## 5. Garantias

- **Caso comum (1–3 págs)**: OCR cabe na 1ª invocação → cache gravado → análise segue na mesma invocação → `completed`. **Comportamento idêntico ao atual** (o cache é só um checkpoint extra).
- **Caso denso (6+ págs)**: invocação 1 grava OCR e falha limpo na análise → auto-chain → invocação 2 reusa OCR → `completed`.
- **Sem regressão de segurança**: o portão de suficiência e `computeISFVerdict` operam sobre o mesmo texto (do cache ou novo) — veredito idêntico.

## 6. Validação

- `tsc`, `lint`, `build`, `jest` (693).
- E2E na 2.705 (densa): deve concluir (no 2º passo) em vez de orfanizar/errar. Provar `completed` com veredito coerente (Crítico/Inválido conforme o conteúdo real).
- Deploy `vercel --prod --yes`.

## 7. Próximo (fora deste escopo, se necessário)
Se mesmo o OCR de 6 páginas não couber numa invocação, evoluir o cache para **per-página** (persistir página-a-página, retomar da última transcrita). Hoje o OCR da 2.705 coube em ~134s, então o cache por-documento já resolve.
