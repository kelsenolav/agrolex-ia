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
- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/planos/page.tsx`, `src/app/dashboard/cofre/page.tsx`, `src/app/dashboard/nova-analise/page.tsx`, `src/app/dashboard/radar/page.tsx`, `src/app/dashboard/resultado/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/api/analyze/route.ts`, `src/app/api/webhook/mercadopago/route.ts`, `src/app/cofre/view/[id]/page.tsx`, `src/lib/supabase.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/`, `/dashboard`, `/dashboard/planos`, `/dashboard/cofre`, `/dashboard/nova-analise`, `/dashboard/radar`, `/dashboard/resultado`, `/login`, `/cadastro`
- **Botões corrigidos**: Restaurada interface simplificada padrão pré-sprint 1 com redirecionamento de mock em localStorage e sem módulos proibidos.
- **Resultados de validação**: `npm run build` e `npm run lint` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Aguardar homologação do usuário pós-rollback total para reimplantação progressiva.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`
- **Botões corrigidos**: Botão "Ver Parecer" condicionado a ter status concluído e findings.resumo preenchido.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel validado localmente.
- **Problemas restantes**: Iniciar o Bloco 3 para restaurar de forma controlada o formulário de Nova Análise.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/resultado/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/resultado`
- **Botões corrigidos**: Botão "Exportar PDF" preservado para uso com window.print(), exibido somente com parecer válido. Outros CTAs de compartilhamento ocultados/removidos.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de laudo validado localmente.
- **Problemas restantes**: Restabelecer a página de Nova Análise de forma controlada (Bloco 4).

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: Removidos botões de seleção de pagamento (Pix, Cartão, Crédito) e o botão "Iniciar Parecer com IA". Simplificado para um único botão de envio ("Enviar Documentos para Auditoria") com mensagem informativa.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de Nova Análise validado localmente.
- **Problemas restantes**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5).

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: Botões de seleção de módulos, upload de documentos e forma de pagamento Pix/Debito/Crédito na criação da auditoria.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de Nova Análise validado localmente.
- **Problemas restantes**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5).

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/checkout/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/api/checkout`
- **Botões corrigidos**: Adicionado botão "Liberar processamento" no Dashboard para análises com status pendente.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel do dashboard validado localmente.
- **Problemas restantes**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5 - execução da IA).

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/api/analyze`
- **Botões corrigidos**: Adicionado botão "Iniciar parecer" no Dashboard para análises com status liberado.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel do dashboard e resultado validado localmente.
- **Problemas restantes**: Homologação geral do fluxo completo.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/api/analyze`
- **Botões corrigidos**: Ajustados alertas/mensagens no frontend e retornos de erro no backend para mascarar erros técnicos de conexão/modelos e exibir apenas mensagens amigáveis seguras aos usuários.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel do dashboard e visualização de resultados validados localmente.
- **Problemas restantes**: Homologação geral em ambiente real de produção.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/lib/auditModules.ts`, `src/app/dashboard/nova-analise/page.tsx`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: Adicionados cards de seleção para os novos módulos reestruturados (`matricula_individual`, `cruzamento_matriculas`, `cadeia_dominial`, `origem_publica`, `geoespacial`, `nulidades_fraudes`, `cruzamento_total`) na UI. Configurada a regra de teto dinâmico de R$ 499,90 e inserida nota discreta de transição.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel de Nova Análise validado localmente.
- **Problemas restantes**: Realizar o mapeamento no motor da IA no próximo sub-bloco para processamento.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `AGENTS.md`
- **Rotas afetadas**: `/api/analyze`
- **Botões corrigidos**: Mapeamento do processamento da API do motor de IA para normalizar novos e antigos IDs de módulos fundiários de forma transparente e compatível. Introduzidas no prompt a seção obrigatória de 'Limitação do Escopo da Análise' e a estrutura padronizada de Achados (Achado -> Base -> Risco -> Criticidade -> Documento necessário -> Recomendação).
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Processamento validado em compilação de produção.
- **Problemas restantes**: Implementar lógica de desabilitação e avisos de compatibilidade na interface de intake baseada em arquivos anexados (Bloco 7.2).

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/lib/auditModules.ts`, `src/app/dashboard/nova-analise/page.tsx`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: Atualizada a interface de intake de Nova Análise com lógica de desabilitação de cards incompatíveis, exibição de tooltips de razões de exclusão, avisos de ressalva para escopos preliminares, auto-filtração de módulos incompatíveis após mudanças nos uploads e adequação da ação "Selecionar módulos compatíveis".
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Intake com regras de compatibilidade validado localmente.
- **Problemas restantes**: Homologar e testar o fluxo de processamento de ponta a ponta.

- **Data**: 02/06/2026
- **Bloco**: 7.3.5 — Corrigir Cálculo de Preço dos Módulos e Exclusividade do Cruzamento Total
- **Arquivos alterados**: `src/lib/auditModules.ts`, `src/app/dashboard/nova-analise/page.tsx`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Alterações implementadas**: 1) Criada função central `calculateAuditModulesTotal()` em auditModules.ts; 2) Removido teto automático geral de R$ 499,90; 3) R$ 499,90 é agora preço exclusivo de `cruzamento_total`; 4) Módulos individuais somados sem teto; 5) Exclusividade de `cruzamento_total` implementada em `toggleModule()` (desseleciona outros ao clicar); 6) Botão "Selecionar recomendados" nunca seleciona `cruzamento_total` automaticamente.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco; aguardando autorização explícita do usuário).
- **URL validada**: Não aplicável.
- **Commit**: b1a896d — "fix: calculate selected audit modules without global cap and enforce cruzamento_total exclusivity"
- **Exemplos de preço validados**: ["matricula_individual"] = R$ 99,90; ["matricula_individual", "cadeia_dominial", "origem_publica", "nulidades_fraudes"] = R$ 749,60; ["cruzamento_total"] = R$ 499,90.
- **Problemas restantes**: Teste manual recomendado (validar R$ 749,60 com 4 módulos e exclusividade de cruzamento_total).

- **Data**: 02/06/2026
- **Bloco**: 7.3.5.1 — Preço Server-side como Fonte da Verdade
- **Arquivos alterados**: `src/app/api/checkout/route.ts`
- **Rotas afetadas**: `/api/checkout`
- **Alterações implementadas**: 1) Importação de `calculateAuditModulesTotal` e `MODULE_PRICES` de auditModules.ts; 2) Validação robusta de cada módulo selecionado (existência e preço válido); 3) Recálculo obrigatório do preço no servidor usando `calculateAuditModulesTotal(selectedModules)`; 4) Salvamento de `estimated_total` (calculado no servidor), `client_estimated_total` (do frontend, para auditoria), `price_source: "server"` e `price_checked_at` em findings; 5) Resposta JSON agora inclui `serverEstimatedTotal` e `clientEstimatedTotal` para comparação.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco; aguardando autorização explícita do usuário).
- **URL validada**: Não aplicável.
- **Commit**: bf78042 — "fix: enforce server-side audit module pricing"
- **Exemplos de preço validados (servidor)**: ["matricula_individual"] = R$ 99,90; ["matricula_individual", "cadeia_dominial", "origem_publica", "nulidades_fraudes"] = R$ 749,60; ["cruzamento_total"] = R$ 499,90.
- **Segurança**: Frontend pode enviar qualquer `estimated_total`; servidor ignora e recalcula a verdade. Preço do pagamento é sempre o valor recalculado no servidor.
- **Problemas restantes**: Teste manual recomendado (validar que backend recalcula mesmo que frontend envie valor incorreto).

- **Data**: 03/06/2026
- **Bloco**: 8.2.2 — Limitar Loop Infinito de Retry por Timeout da IA
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`
- **Rotas afetadas**: `/api/analyze`, `/dashboard`
- **Alterações implementadas**: 1) Adicionado teto de 3 tentativas para erros `ai_timeout`; 2) Ao atingir ou superar 3 tentativas, o status continua `error`, mas `retry_available` é setado para `false`, `retry_exhausted` para `true`, `retry_reason` para `"max_ai_timeout_attempts"`, e o passo de processamento (`current_step` / `userMessage`) indica que a análise exige processamento em etapas; 3) O dashboard oculta o botão "Tentar novamente" se `findings.retry_exhausted === true` e renderiza um badge informativo "Exige processamento em etapas" com descrição adequada.
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados com 100% de sucesso.
- **Deploy**: Não aplicável (sem deploy neste bloco; aguardando autorização explícita do usuário).
- **URL validada**: Não aplicável.
- **Commit**: "fix: limit retry loop for ai timeouts"
- **Problemas restantes**: Nenhum. Fluxo de retry por timeout de IA robusto e livre de loop infinito.



