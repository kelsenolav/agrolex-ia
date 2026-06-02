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
- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/planos/page.tsx`, `src/app/dashboard/cofre/page.tsx`, `src/app/dashboard/nova-analise/page.tsx`, `src/app/dashboard/radar/page.tsx`, `src/app/dashboard/resultado/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/api/analyze/route.ts`, `src/app/api/webhook/mercadopago/route.ts`, `src/app/cofre/view/[id]/page.tsx`, `src/lib/supabase.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/`, `/dashboard`, `/dashboard/planos`, `/dashboard/cofre`, `/dashboard/nova-analise`, `/dashboard/radar`, `/dashboard/resultado`, `/login`, `/cadastro`
- **Botões corrigidos**: Restaurada interface simplificada padrão pré-sprint 1 com redirecionamento de mock em localStorage e sem módulos proibidos.
- **Resultados de validação**: `npm run build` e `npm run lint` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Aguardar homologação do usuário pós-rollback total para reimplantação progressiva.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`
- **Botões corrigidos**: Botões da coluna "Ação" na tabela "Suas Análises" (corrigido para exibir "Ver Parecer" e "Ativar Radar" para todas as propriedades cujo status é concluído ou equivalente).
- **Resultados de validação**: `npm run build` e `npm run lint` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Nenhum.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/resultado/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/resultado`
- **Botões corrigidos**: Nenhum. Aplicado alinhamento justificado (`text-justify`) para parágrafos do Parecer Executivo com títulos internos alinhados à esquerda.
- **Resultados de validação**: `npm run build` e `npm run lint` aprovados com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/resultado?id=b6b71afb-ad5e-4034-870e-45e961d8f713
- **Problemas restantes**: Nenhum.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`, `/api/analyze`
- **Botões corrigidos**: Exibicao clara do valor total dos modulos selecionados; inicio da IA preserva modulos registrados e nao conclui laudo vazio.
- **Resultados de validação**: `npm.cmd run build` (OK), `npm.cmd run lint` (OK) e `npx.cmd tsc --noEmit` (OK).
- **Deploy**: Nao executado por determinacao expressa deste incidente.
- **Problemas restantes**: As analises antigas que ja ficaram em `error` nao foram reprocessadas; homologar um novo fluxo autenticado antes de publicar.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`
- **Botões corrigidos**: "Usar Crédito" agora só confirma liberação após atualizar a análise para `processing`; em falha, restaura o saldo descontado.
- **Resultados de validação**: `npm.cmd run build`, `npm.cmd run lint` e `npx.cmd tsc --noEmit` aprovados.
- **Deploy**: Não executado por determinação expressa desta validação.
- **Problemas restantes**: Homologar visualmente o fluxo completo autenticado após publicação; reprocessar separadamente análises antigas inconsistentes.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `src/app/api/checkout/route.ts`, `src/app/api/analyze/route.ts`, `src/app/dashboard/resultado/page.tsx`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`, `/api/checkout`, `/api/analyze`, `/dashboard/resultado`, `/dashboard`
- **Botões corrigidos**: Restaurado "Selecionar Todas as Análises"; `Cruzamento Total` funciona como pacote master sem soma indevida.
- **Resultados de validação**: `npm.cmd run build`, `npm.cmd run lint` e `npx.cmd tsc --noEmit` aprovados.
- **Deploy**: Não executado por determinação expressa deste sprint.
- **Problemas restantes**: Reprocessar análises antigas que já estejam em estado inconsistente `completed` sem `findings.resumo`.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/(auth)/login/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/api/auth/session/route.ts`, `src/lib/authCookies.ts`, `src/proxy.ts`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/login`, `/dashboard/:path*`, `/admin/:path*`, `/api/auth/session`
- **Botões corrigidos**: Logout agora remove também cookies protegidos da sessão Supabase.
- **Resultados de validação**: `npm.cmd run build`, `npm.cmd run lint` e `npx.cmd tsc --noEmit` aprovados.
- **Deploy**: Efetuado com sucesso via `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Nenhum.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/resultado/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/resultado`
- **Botões corrigidos**: Adicionados "Copiar mensagem para WhatsApp" e "Abrir WhatsApp" após a geração do link público seguro.
- **Resultados de validação**: `npm.cmd run build`, `npm.cmd run lint` e `npx.cmd tsc --noEmit` aprovados.
- **Deploy**: Não executado por determinação expressa deste sprint.
- **Problemas restantes**: Teste funcional autenticado deve ser executado em ambiente com sessão válida antes da publicação.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/api/checkout/route.ts`, `src/app/dashboard/nova-analise/page.tsx`, `src/app/api/webhook/mercadopago/route.ts`, `.env.example`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`, `/api/checkout`, `/api/webhook/mercadopago`
- **Botões corrigidos**: Pagamento Pix e cartão agora exibem mensagem amigável quando o Mercado Pago não está configurado; "Usar Crédito" permaneceu independente.
- **Resultados de validação**: `npm.cmd run build`, `npm.cmd run lint` e `npx.cmd tsc --noEmit` aprovados.
- **Deploy**: Não executado por determinação expressa desta tarefa.
- **Problemas restantes**: Configurar `MERCADO_PAGO_ACCESS_TOKEN` em produção e homologar Pix real; auditar futuramente o fluxo de créditos.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `src/app/api/checkout/route.ts`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`, `/api/checkout`
- **Botões corrigidos**: Cards de auditoria agora selecionam somente um plano; Pix adiciona instrução visual e restringe meios incompatíveis no Checkout Pro.
- **Resultados de validação**: `npm.cmd run build`, `npm.cmd run lint` e `npx.cmd tsc --noEmit` aprovados.
- **Deploy**: Não executado por determinação expressa deste sprint.
- **Problemas restantes**: Homologar Checkout Pro Pix após deploy; dinheiro em conta Mercado Pago pode permanecer disponível por limitação do provider.

- **Data**: 01/06/2026
- **Arquivos alterados**: `src/app/api/checkout/route.ts`, `src/app/api/webhook/mercadopago/route.ts`, `src/app/api/analyze/route.ts`, `src/app/dashboard/nova-analise/page.tsx`, `.env.example`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`, `/api/checkout`, `/api/webhook/mercadopago`, `/api/analyze`
- **Botões corrigidos**: Em `PAYMENT_PROVIDER=simulated`, Pix e cartão exibem "Confirmar pagamento simulado"; "Usar Crédito" permanece independente.
- **Resultados de validação**: `npm.cmd run build`, `npm.cmd run lint` e `npx.cmd tsc --noEmit` aprovados.
- **Deploy**: Não executado por determinação expressa deste sprint.
- **Problemas restantes**: Criar futuramente tabela de pagamentos para auditoria financeira completa; o registro atual nos `findings` é suficiente apenas para a fase beta.

- **Data**: 02/06/2026
- **Arquivos alterados**: `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`, `/api/checkout`, `/api/webhook/mercadopago`, `/api/analyze`
- **Botões corrigidos**: Modo de pagamento simulado ativado e validado na URL de produção com alias.
- **Resultados de validação**: `npm.cmd run build` (OK), `npm.cmd run lint` (OK) e `npx.cmd tsc --noEmit` (OK).
- **Deploy**: Efetuado com `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Nenhum.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/planos/page.tsx`, `src/app/cofre/view/[id]/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/api/cron/reminders/route.ts`, `src/app/api/analyze/route.ts`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/`, `/login`, `/cadastro`, `/dashboard`, `/dashboard/planos`, `/cofre/view/[id]`, `/api/analyze`, `/api/cron/reminders`
- **Botões corrigidos**: Normalização da marca visual para "AgroLex" nas navbars, footers, logos, formulários de autenticação, e-mails de laudo e alertas de cron. Remoção do sufixo "B2B" nos botões de créditos/planos no dashboard.
- **Resultados de validação**: `npm run build` (OK), `npm run lint` (OK) e `npx tsc --noEmit` (OK).
- **Deploy**: Efetuado com `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Nenhum.

- **Data**: 02/06/2026
- **Arquivos alterados**: `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard`, `/dashboard/nova-analise`, `/api/analyze`, `/dashboard/resultado`
- **Botões corrigidos**: Nenhum. Executado deploy controlado e validações de build, lint, TypeScript e publicação em produção do hotfix de nova análise e parecer real.
- **Resultados de validação**: `npm.cmd run build` (OK), `npm.cmd run lint` (OK) e `npx.cmd tsc --noEmit` (OK).
- **Deploy**: Efetuado com sucesso via `vercel --prod --yes`.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Problemas restantes**: Nenhum.

- **Data**: 02/06/2026
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/resultado/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Rotas afetadas**: `/api/analyze`, `/dashboard/resultado`
- **Botões corrigidos**: Nenhum. Adicionados timeout seguro da IA e aviso de processamento acima do tempo esperado.
- **Resultados de validação**: `npm.cmd run build` (OK), `npm.cmd run lint` (OK) e `npx.cmd tsc --noEmit` (OK).
- **Deploy**: Nao executado por determinacao expressa deste incidente.
- **Problemas restantes**: Homologar uma nova analise autenticada apos publicacao; a analise antiga presa nao foi alterada nem reprocessada.
