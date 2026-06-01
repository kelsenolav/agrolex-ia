# AGENTS.md

## Agent Rules for AgroLex Project

- **Read** `PROJECT_CONTEXT_AGROLEX.md` **before any task**.
- **Obey scope**: do not modify APIs, databases, migrations, schemas, or services unless explicitly authorized.
- **Never re‑introduce** legacy terms (ESG, carbono, EUDR, Carteira B2B, fornecedores, compliance, rastreabilidade, etc.) in main routes.
- **All visible buttons must have an action** (navigation, scroll, modal, or external link).
- **Validate** `npm run build`, `npm run lint` and `npm test` after any change affecting production.
- **Deploy** with `vercel --prod --yes` when production‑affecting changes are made.
- **Validate** the public URL `https://agrolex-ia-qx32.vercel.app/dashboard` after deploy.
- **Update** `PROJECT_CONTEXT_AGROLEX.md` and this `AGENTS.md` at the end of relevant tasks (record date, files changed, routes, buttons fixed, validation results, URL check, remaining issues).

*Do not add any other content.*

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`
- **Botões corrigidos**: Adicionados botões de geração de prompts em camadas (Camadas 1 a 8, Parecer NotebookLM, Claude Dossiê) na nova seção "Biblioteca de Prompts AgroLex".
- **Resultados de validação**: `npm run build`, `npm run lint` e `npm test` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Criar editor administrativo para manutenção dos prompts em camadas sem necessidade de alterar código.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `package.json`, `package-lock.json`, `tsconfig.json`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/dashboard/auditorias/[auditId]` (movida para quarentena)
- **Botões corrigidos**: Removidos botões e previews da funcionalidade de extração local de PDFs por `pdfjs-dist` (pós-Sprint 2).
- **Resultados de validação**: `npm run build`, `npm run lint` e `npm test` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Revalidar Sprint 1 e Sprint 2 e planejar reimplantação controlada do Sprint 3.




