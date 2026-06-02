# STABLE_BASELINE_AGROLEX

## Marco

- Branch limpa atual: `stable/rebuild-beta-01-laudo-compartilhavel`
- Base limpa: `2c3a1b6`
- Branch de resgate: `rescue/current-dirty-agrolex-2026-06-02`
- Commit de resgate: `f9293a3`
- Marco: Estavel Beta 01 - Laudo Compartilhavel

## Reconstrucao Seletiva

Reconstruir em blocos independentes:

- login/auth;
- dashboard;
- nova analise minima;
- geracao de laudo;
- PDF;
- link publico seguro;
- revogacao;
- WhatsApp;
- marca AgroLex;
- pagamento simulado controlado.

## Funcionalidades Congeladas

- Mercado Pago real;
- OCR;
- integracoes INCRA/SIGEF/CAR;
- score fundiario;
- marketplace;
- novas mudancas grandes em `/api/analyze`.

## Arquivos Criticos

- `src/app/api/analyze/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/dashboard/nova-analise/page.tsx`
- `src/app/dashboard/resultado/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/lib/supabase.ts`
- `src/lib/supabaseAdmin.ts`

Nenhum arquivo critico pode ser alterado sem diagnostico, risco, teste e plano de rollback.

## Checklist Antes De Deploy

- build;
- lint;
- TypeScript;
- teste manual;
- `git status` limpo;
- commit criado.

## Regra De Commits

Usar um bloco por commit. Nao misturar recursos.

## Plano De Rollback

Reverter somente o commit do bloco com falha. Se necessario, retornar para `2c3a1b6`. O snapshot integral anterior permanece preservado em `f9293a3` e na tag `rescue-before-clean-rebuild-2026-06-02`.
