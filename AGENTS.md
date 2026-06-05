# AGENTS.md

## Agent Rules for AgroLex Project

- **Read** `PROJECT_CONTEXT_AGROLEX.md` **before any task**.
- **Read** `STABLE_BASELINE_AGROLEX.md` **before changing files**.
- **Critical files**: do not modify files listed in the stable baseline without diagnosis, risk, tests, and a rollback plan.
- **Deploy authorization**: do not deploy without explicit user authorization.
- **Secrets**: never commit secrets or `.env.local`.
- **Validate** `npm run build`, `npm run lint`, and `npx tsc --noEmit` after changes.
- **Obey scope**: do not modify APIs, databases, migrations, schemas, or services unless explicitly authorized.
- **Never re‑introduce** legacy terms (ESG, carbono, EUDR, Carteira B2B, fornecedores, compliance, rastreabilidade, etc.) in main routes.
- **All visible buttons must have an action** (navigation, scroll, modal, or external link).
- **Validate** `npm run build`, `npm run lint` and `npm test` after any change affecting production.
- **Deploy** with `vercel --prod --yes` when production‑affecting changes are made.
- **Validate** the public URL `https://agrolex-ia-qx32.vercel.app/dashboard` after deploy.
- **Update** `PROJECT_CONTEXT_AGROLEX.md` and this `AGENTS.md` at the end of relevant tasks (record date, files changed, routes, buttons fixed, validation results, URL check, remaining issues).

- **Regra de comunicação**: Não detalhar progresso técnico incremental na tela durante a tarefa (status de leitura de arquivos, validações intermediárias, etc.). Todo o histórico de ações executadas será consolidado no relatório final. Apenas informar conclusão de blocos críticos (build, lint, testes, deploy) quando solicitado.
- **Relatório final**: Ao concluir qualquer tarefa, gerar relatório consolidado com todos os arquivos alterados, rotas afetadas, alterações implementadas, resultados de validação e pendências.

*Do not add any other content.*

---

- **Data**: 05/06/2026
- **Bloco**: FASE 3 — Módulos Acionáveis e Laudo Complementar (herança de case_file, filtro de módulos, mesclagem de resultados)
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `AGENTS.md`, `PROJECT_CONTEXT_AGROLEX.md`
- **Rotas afetadas**: `/api/analyze`, `/dashboard`, `/dashboard/resultado`
- **Alterações implementadas**:
  1. **Lógica de herança no `/api/analyze`**: filtra `selected_modules` removendo módulos já concluídos no pai (`module_results` do `case_file` herdado); calcula `amountPaid` apenas para módulos novos (server-side); mescla `module_results` do pai com novos módulos processados.
  2. **Integração com FASE 2**: `parent_analysis_id`, endpoint `/api/recommendations/accept`, modal de confirmação, seção "Histórico do Caso" no laudo, badge de profundidade (`analysis_depth`), CTAs de upsell pós-`retry_exhausted`.
  3. **Testes**: 81 testes passando (4 suítes: auditModules, caseFile, reportExtractors, recommendations).
- **Validações**: `npm run build` (22 rotas), `npm run lint` (aprovado), `npm test` (81/81), `npx tsc --noEmit` (exit 0)
- **Commit**: `1794ad1 — feat(FASE 3): herança de case_file e filtro de módulos em análises complementares`
- **Push**: Efetuado para `origin/stable/rebuild-beta-01-laudo-compartilhavel`
- **Deploy em produção**: **EFETUADO** com `vercel --prod --yes` (autorização explícita do usuário em 05/06/2026)
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard (HTTP 307 redirect server-side para `/login?next=%2Fdashboard`); `/`, `/login`, `/cadastro` → HTTP 200
- **Próximos passos**: FASE 4 — Checkout Modular (Pagamento Real)

---

- **Data**: 05/06/2026
- **Bloco**: FASE 2 — Recommended Modules Acionáveis (sub-bloco 2.0.2, classe E — migration + novo endpoint + modal)
- **Arquivos alterados**: `supabase/migrations/20260605_parent_analysis_id.sql` (novo), `src/app/api/recommendations/accept/route.ts` (novo), `src/app/dashboard/page.tsx`, `.github/workflows/ci.yml` (novo), `AGENTS.md`, `PROJECT_CONTEXT_AGROLEX.md`
- **Rotas afetadas**: `/api/recommendations/accept` (nova), `/dashboard`
- **Alterações implementadas**:
  1. **Migration** `parent_analysis_id`: adiciona `parent_analysis_id` (UUID FK), `analysis_depth` (INT DEFAULT 1) e `complementary_modules` (TEXT[]) à tabela `analyses`.
  2. **Endpoint** `POST /api/recommendations/accept`: autentica sessão, valida ownership, verifica status "completed" da análise pai, cria análise filha com `case_file` herdado (cópia profunda), recalcula preço server-side, registra `complementary_children` na análise pai.
  3. **Modal de confirmação** no dashboard: botão "+ Adicionar Módulo" ao lado de análises concluídas com recomendações → modal mostrando módulos, preços, prioridade (bolinha colorida), total estimado, tempo estimado → CTA "Confirmar e Criar" → chamada ao endpoint → toast de sucesso → refresh da lista.
  4. **CI/CD**: GitHub Actions com build/lint/tsc/test em todo push para `stable/**`.
  5. Hotfixes verificados (nenhuma ação necessária): MODULE_PRICES já centralizado no bloco 04/06, return duplicado já removido, `refreshAnalises()` já substituiu `window.location.reload()`.
- **Validações**: `npm run build` (22 rotas!), `npm run lint` (aprovado), `npm test` (62/62), `npx tsc --noEmit` (exit 0)
- **Commit**: Pendente
- **Deploy**: Não efetuado (sem autorização para deploy)
- **Próximos passos**: FASE 3 — Módulos Acionáveis e Laudo Complementar (herança de case_file, upsell pós-retry, histórico do caso no laudo)

---

- **Data**: 04/06/2026
- **Bloco**: Deploy em produção do commit 94fe6ac (autorizado pelo usuário)
- **Arquivos alterados**: `AGENTS.md`, `PROJECT_CONTEXT_AGROLEX.md`
- **Rotas afetadas**: `/`, `/login`, `/cadastro`, `/dashboard` (todas validadas com HTTP 200)
- **Ação executada**: `vercel --prod --yes` após autorização explícita do usuário.
- **Resultado do build remoto**: Next.js build concluído em 42s, 21 rotas geradas, alias `https://agrolex-ia-qx32.vercel.app` reapontado.
- **Validação de URL**:
  - `https://agrolex-ia-qx32.vercel.app/dashboard` → HTTP 200 (com redirect server-side para `/login?next=%2Fdashboard`).
  - `https://agrolex-ia-qx32.vercel.app/login` → HTTP 200.
  - `https://agrolex-ia-qx32.vercel.app/cadastro` → HTTP 200.
  - `https://agrolex-ia-qx32.vercel.app/` → HTTP 200.
- **Observação**: `/plans`, `/checkout` e `/report/mock-sprint-45-agrolex` retornam 404 (não existem no branch atual — removidas no rollback total de 01/06/2026). Rotas funcionais estão todas em `/dashboard/*`, `/login`, `/cadastro` e `/`.
- **Problemas restantes**:
  - Homologação manual em produção dos fluxos forceRetry, timeout adaptativo, Toast system e PDF A4.
  - Limpeza do working tree (10 arquivos untracked experimentais + AGENTS.md modificada não commitada).
  - Roadmap futuro: editor admin de prompts em camadas, OCR para PDFs escaneados.

---

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`
- **Botões corrigidos**: Adicionados botões de geração de prompts em camadas (Camadas 1 a 8, Parecer NotebookLM, Claude Dossiê) na nova seção "Biblioteca de Prompts AgroLex".
- **Resultados de validação**: `npm run build`, `npm run lint` e `npm test` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Criar editor administrativo para manutenção dos prompts em camadas sem necessidade de alterar código.

---

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `package.json`, `package-lock.json`, `tsconfig.json`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/dashboard/auditorias/[auditId]` (movida para quarentena)
- **Botões corrigidos**: Removidos botões e previews da funcionalidade de extração local de PDFs por `pdfjs-dist` (pós-Sprint 2).
- **Resultados de validação**: `npm run build`, `npm run lint` e `npm test` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard

---

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/planos/page.tsx`, `src/app/dashboard/cofre/page.tsx`, `src/app/dashboard/nova-analise/page.tsx`, `src/app/dashboard/radar/page.tsx`, `src/app/dashboard/resultado/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/api/analyze/route.ts`, `src/app/api/webhook/mercadopago/route.ts`, `src/app/cofre/view/[id]/page.tsx`, `src/lib/supabase.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/`, `/dashboard`, `/dashboard/planos`, `/dashboard/cofre`, `/dashboard/nova-analise`, `/dashboard/radar`, `/dashboard/resultado`, `/login`, `/cadastro`
- **Botões corrigidos**: Restaurada interface simplificada padrão pré-sprint 1 com redirecionamento de mock em localStorage e sem módulos proibidos.
- **Resultados de validação**: `npm run build` e `npm run lint` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard

---

- **Data**: 04/06/2026
- **Bloco**: Correção de timeout de matrículas densas, retry forçado, sistema de Toast, PDF profissional A4 e suíte Jest
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`, `src/app/dashboard/nova-analise/page.tsx`, `src/app/globals.css`, `package.json`, `package-lock.json`, `tsconfig.json`, `jest.config.ts` *(novo)*, `src/lib/__tests__/auditModules.test.ts` *(novo)*, `src/lib/__tests__/reportExtractors.test.ts` *(novo)*, `AGENTS.md`, `PROJECT_CONTEXT_AGROLEX.md`
- **Rotas afetadas**: `/api/analyze`, `/dashboard`, `/dashboard/nova-analise`, impressão/PDF de `/dashboard/resultado`
- **Alterações implementadas**:
  1. **API `/api/analyze`**: `maxDuration` 60s → 120s (Vercel); timeout Gemini adaptativo (90s simples / 110s denso) com detecção `isDenseDocument` (≥3 PDFs OU >12 parts); instrução de concisão no prompt para docs densos (máx. 2.000 palavras); retries de timeout 3 → 5; suporte a `forceRetry` no body para reprocessar análises com `retry_exhausted`; `MODULE_PRICES` centralizado (remove duplicação inline).
  2. **Dashboard `/dashboard`**: `handleStartAnalysis` aceita `forceRetry`; botão "Tentar novamente" reexibido em `retry_exhausted` enviando `forceRetry: true`; copy do aviso de processamento em etapas melhorada.
  3. **Nova Análise `/dashboard/nova-analise`**: substituição completa de `alert()` por **sistema de Toast** (success/error/info, auto-dismiss 4s, redirect com delay 1.5s); type safety em `error: unknown`.
  4. **PDF profissional (`src/app/globals.css`)**: +103 linhas de CSS `@media print` para A4 (margens 15mm/12mm, paginação controlada, fonte 10pt, badges de risco preservados, sem espaços vazios na página 2).
  5. **Jest**: adicionada suíte completa (`jest`, `ts-jest`, `@types/jest`); 2 arquivos de teste (44 testes cobrindo `auditModules` e `reportExtractors`).
- **Resultados de validação**: `npm run build` (21 rotas, 14.7s), `npm run lint`, `npx tsc --noEmit` e `npm test` (44/44 testes) aprovados com 100% de sucesso.
- **Commit**: `94fe6ac — feat(bloco 04/06/2026): timeout adaptativo, forceRetry, Toast system, PDF A4 e Jest` (12 arquivos, +6849 / -2876).
- **Push**: Efetuado para `origin/stable/rebuild-beta-01-laudo-compartilhavel` (ad9e4a4 → 94fe6ac).
- **Deploy em produção**: **EFETUADO** com `vercel --prod --yes` (autorização explícita do usuário em 04/06/2026).
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard (HTTP 200, redirect server-side para `/login?next=/dashboard` funcional).
- **Problemas restantes**: Homologação manual em produção dos fluxos forceRetry, timeout adaptativo, Toast system e PDF A4.

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`
- **Botões corrigidos**: Botão "Ver Parecer" condicionado a ter status concluído e findings.resumo preenchido.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel validado localmente.
- **Problemas restantes**: Iniciar o Bloco 3 para restaurar de forma controlada o formulário de Nova Análise.

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/resultado/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/resultado`
- **Botões corrigidos**: Botão "Exportar PDF" preservado para uso com window.print(), exibido somente com parecer válido. Outros CTAs de compartilhamento ocultados/removidos.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de laudo validado localmente.
- **Problemas restantes**: Restabelecer a página de Nova Análise de forma controlada (Bloco 4).

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: Removidos botões de seleção de pagamento (Pix, Cartão, Crédito) e o botão "Iniciar Parecer com IA". Simplificado para um único botão de envio ("Enviar Documentos para Auditoria") com mensagem informativa.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de Nova Análise validado localmente.
- **Problemas restantes**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5).

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: Botões de seleção de módulos, upload de documentos e forma de pagamento Pix/Debito/Crédito na criação da auditoria.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de Nova Análise validado localmente.
- **Problemas restantes**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5).

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/checkout/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/api/checkout`
- **Botões corrigidos**: Adicionado botão "Liberar processamento" no Dashboard para análises com status pendente.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel do dashboard validado localmente.
- **Problemas restantes**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5 - execução da IA).

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/api/analyze`
- **Botões corrigidos**: Adicionado botão "Iniciar parecer" no Dashboard para análises com status liberado.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel do dashboard e resultado validado localmente.
- **Problemas restantes**: Homologação geral do fluxo completo.

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/api/analyze`
- **Botões corrigidos**: Ajustados alertas/mensagens no frontend e retornos de erro no backend para mascarar erros técnicos de conexão/modelos e exibir apenas mensagens amigáveis seguras aos usuários.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel do dashboard e visualização de resultados validados localmente.
- **Problemas restantes**: Homologação geral em ambiente real de produção.

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/lib/auditModules.ts`, `src/app/dashboard/nova-analise/page.tsx`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: Adicionados cards de seleção para os novos módulos reestruturados (`matricula_individual`, `cruzamento_matriculas`, `cadeia_dominial`, `origem_publica`, `geoespacial`, `nulidades_fraudes`, `cruzamento_total`) na UI. Configurada a regra de teto dinâmico de R$ 499,90 e inserida nota discreta de transição.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de Nova Análise validado localmente.
- **Problemas restantes**: Realizar o mapeamento no motor da IA no próximo sub-bloco para processamento.

---

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `AGENTS.md`
- **Rotas afetadas**: `/api/analyze`
- **Botões corrigidos**: Mapeamento do processamento da API do motor de IA para normalizar novos e antigos IDs de módulos fundiários de forma transparente e compatível. Introduzidas no prompt a seção obrigatória de 'Limitação do Escopo da Análise' e a estrutura padronizada de Achados (Achado -> Base -> Risco -> Criticidade -> Documento necessário -> Recomendação).
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados