# RELEASE_LOG

## 2026-06-02 - Baseline Da Reconstrucao

- Branch: `stable/rebuild-beta-01-laudo-compartilhavel`
- Base: `2c3a1b6`
- Resgate: `f9293a3`
- Objetivo: reconstruir seletivamente o AgroLex a partir de uma base reproduzivel.
- Status: base limpa em validacao.

## 2026-06-02 - Bloco 2: Auth Minimo

- Branch: `stable/rebuild-beta-01-laudo-compartilhavel`
- Objetivo: restaurar sessao HttpOnly e protecao server-side de `/dashboard/:path*` e `/admin/:path*`.
- Validacao: build, lint, TypeScript e redirecionamentos locais aprovados.
- Status: concluido sem deploy.
