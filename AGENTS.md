# AGENTS.md

## Agent Rules for AgroLex Project

---

- **Data**: 08/06/2026
- **Bloco**: SPRINT COMERCIAL P0.5 — MERCADO PAGO + ATIVAÇÃO DE PLANOS
- **Arquivos criados**:
  - `src/lib/subscriptions.ts` *(novo)* — Biblioteca de gerenciamento de assinaturas, controle de créditos e planos.
  - `src/lib/__tests__/subscriptions.test.ts` *(novo)* — Testes unitários para o gerenciamento de assinaturas.
  - `supabase/migrations/20260607_subscriptions.sql` *(novo)* — SQL de criação de tabela subscriptions e RLS.
- **Arquivos alterados**:
  - `AGENTS.md`
  - `src/app/dashboard/planos/page.tsx` — Correção de tipagem planKey e integração direta com fluxo de checkout Mercado Pago.
  - `src/app/api/checkout/route.ts` — Nova lógica para geração de preferência de pagamentos de planos (Starter, Pro, Premium, Enterprise) com precificação recalculada estritamente no backend.
  - `src/app/api/webhook/mercadopago/route.ts` — Webhook de processamento de checkout de planos com ativação de assinatura correspondente e provisionamento de créditos correspondentes ao plano comprado.
  - `src/app/dashboard/page.tsx` — Exibição de informações sobre assinatura e créditos disponíveis, bloqueando intake de novas análises ou uploads caso créditos estejam zerados ou trial esgotado.
- **Rotas afetadas**: `/dashboard/planos`, `/api/checkout`, `/api/webhook/mercadopago`, `/dashboard`
- **Alterações implementadas**:
  1. Criação do modelo de subscriptions com controle de saldo de créditos por plano (Starter: 10, Pro: 25, Premium: 60, Enterprise: 200).
  2. Implementação das funções centralizadas `getUserSubscription()`, `consumeCredits()`, `activateSubscription()` e `hasAvailableCredits()`.
  3. Integração com checkout real Mercado Pago redirecionando diretamente após clique em "Escolher Plano" para os planos pagos.
  4. Webhook para escutar eventos de status de pagamentos (`approved`, `rejected`, `cancelled`) e gerenciar a liberação automática de assinaturas e seus créditos.
  5. Travamento e exibição de banners no dashboard e intake de nova análise/uploads quando os créditos do usuário se esgotam ou quando o trial expira.
- **Validações**: `npx tsc --noEmit` (✓), `npm run lint` (✓), `npm test` (474/474 — ✓), `npm run build` (✓)
- **Deploy em produção**: **NÃO EFETUADO** (somente ambiente local conforme instruções da sprint)

---

- **Data**: 07/06/2026
- **Bloco**: SPRINT COMERCIAL P0.4 + P0.4B — Captura de Interesse e Dashboard Comercial Admin
- **Arquivos criados**:
  - `src/components/commercial/InterestModal.tsx` *(novo)* — Componente React de captura de interesse.
  - `supabase/migrations/20260607_marketing_leads_interest.sql` *(novo)* — SQL sugerido com colunas de interesse comercial.
  - `src/app/dashboard/leads/page.tsx` *(novo)* — Dashboard comercial prioritário completo de leads com KPIs executivos.
- **Arquivos alterados**:
  - `AGENTS.md`
  - `src/lib/commercial/scoring.ts` — Lógica de score de interesse comercial.
  - `src/lib/commercial/__tests__/scoring.test.ts` — Testes de score de interesse comercial.
  - `src/app/api/marketing/leads/route.ts` — Actions `register_interest` e `update_interest_status` com fallback resiliente em metadata JSONB.
  - `src/app/dashboard/planos/page.tsx` — Integração de planos starter/profissional/empresarial para acionar o modal de interesse.
  - `src/app/dashboard/resultado/page.tsx` — Interceptação dos CTAs da prévia trial para abrir o modal de interesse.
- **Rotas afetadas**: `/dashboard/planos`, `/dashboard/resultado`, `/dashboard/leads`, `/api/marketing/leads`
- **Alterações implementadas**:
  1. Captura e persistência resiliente de interesse comercial em `marketing_leads` (plano, volume, perfil e status).
  2. Painel comercial CRM em `/dashboard/leads` ordenado por Score Comercial (leads mais quentes primeiro).
  3. 5 KPIs executivos no topo: Total Interessados, Lead Score Médio, Plano Mais Desejado, Potencial Mensal, Perfil Frequente.
  4. Filtros avançados: Plano, Perfil, Status, Score Mínimo.
  5. Ações rápidas de alteração de status (`Novo`, `Contato Realizado`, `Qualificado`, `Aguardando Mercado Pago`, `Convertido`).
  6. Widget "Oportunidades Quentes" listando Top 10 leads interessados por pontuação de temperatura.
  7. Telemetria avançada de ações comerciais: `commercial_dashboard_view`, `lead_status_changed`, `lead_priority_view`.
- **Validações**: `npx tsc --noEmit` (✓), `npm run lint` (✓), `npm test` (468/468 — ✓), `npm run build` (✓)
- **Deploy em produção**: **EFETUADO** com `vercel --prod --yes` (autorização explícita do usuário em 07/06/2026)
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard → HTTP 200 (redirect para login) ✓
- **Commits inclusos**: `ea9ffce` (P0.4) e `7c80ed9` (P0.4B)

---
- **Alterações implementadas**:
  1. Criação do modal de interesse comercial coletando Nome, Email, WhatsApp, Perfil, Plano e Volume mensal estimado.
  2. Implementação de tracking de eventos específicos: `interest_modal_open`, `interest_form_started`, `interest_form_completed`, `interest_plan_selected`, `interest_volume_selected`.
  3. Lógica resiliente para APIs salvando dados em colunas estruturadas ou no metadata JSONB como fallback automático caso a migration não tenha sido aplicada.
  4. Nova lógica pure de score de interesse: Empresarial + Mais de 100 análises (100 pontos), Profissional + Até 25 análises (70 pontos), Ocasional + Até 5 análises (30 pontos).
- **Validações**: `npx tsc --noEmit` (exit 0), `npm run lint` (✓), `npm test` (468/468 — 15 suítes, ✓), `npm run build` (✓)
- **Deploy em produção**: **NÃO EFETUADO** (aguardando autorização para deploy)

---

- **Data**: 07/06/2026
- **Bloco**: SPRINT COMERCIAL P0.3 — Conversão Persuasiva (Gatilhos Psicológicos e Valor)
- **Arquivos criados**: Nenhum (apenas refatorações de UX e copy).
- **Arquivos alterados**:
  - `AGENTS.md`
  - `src/app/dashboard/page.tsx` — Customização de copy do banner de trial utilizado ("Sua análise gratuita foi concluída...") com eventos de telemetria `conversion_banner_view` e `conversion_banner_click`.
  - `src/app/dashboard/resultado/page.tsx` — Inclusão do aviso detalhado de riscos e impacto jurídico, barra de valor ("Relatório liberado: 20%"), blocos de gatilhos visuais de perda ("O que você ainda não viu"), credibilidade ("Como o AgroLex trabalha") e urgência de correção de riscos, com telemetria `upgrade_cta_click`.
  - `src/app/dashboard/planos/page.tsx` — Título e descrição orientados a segurança ("Proteja sua próxima decisão fundiária"), renomeação de planos e copies focadas na dor de cada público-alvo (Acesso Experimental, Usuário Ocasional, Profissional, Empresarial) e eventos de telemetria `plans_page_view` e `plans_cta_click`.
- **Rotas afetadas**: `/dashboard`, `/dashboard/resultado`, `/dashboard/planos`
- **Alterações implementadas**:
  1. Reforço de valor no Dossiê com avisos estruturados de atenção ao risco fundiário detectado.
  2. Implementação visual de 3 gatilhos persuasivos na página de visualização parcial (Perda, Credibilidade e Urgência).
  3. Reestruturação de copies e headlines de planos focados em proteção e segurança com cards adaptados a perfis de uso.
  4. Rastreamento e log em banco de dados de eventos avançados de conversão: `conversion_banner_view`, `conversion_banner_click`, `plans_page_view`, `plans_cta_click`.
- **Validações**: `npx tsc --noEmit` (exit 0), `npm run lint` (✓), `npm test` (464/464 — 15 suítes, ✓)
- **Deploy em produção**: **NÃO EFETUADO** (aguardando autorização explícita do usuário)

---

- **Data**: 07/06/2026
- **Bloco**: SPRINT COMERCIAL P0.2 — Trial Control Engine + Resultado Parcial + Conversão (Fases 1–9)
- **Arquivos criados**:
  - `src/lib/trial/trialControl.ts` *(novo)* — Camada de controle de Trial baseada em `marketing_leads`.
  - `src/lib/trial/__tests__/trialControl.test.ts` *(novo)* — Testes unitários para o Trial Control Engine.
  - `supabase/migrations/20260607_marketing_leads_trial_control.sql` *(novo)* — SQL sugerido para campos de trial em `marketing_leads` (NÃO executado).
- **Arquivos alterados**:
  - `AGENTS.md`
  - `src/app/api/marketing/leads/route.ts` — Adicionados endpoints `get_trial_status` e `track_event`.
  - `src/app/api/analyze/route.ts` — Bloqueio trial backend no processamento e telemetria `trial_started` / `trial_completed`.
  - `src/app/dashboard/nova-analise/page.tsx` — Bloqueio trial frontend e telemetria `trial_blocked` / `upgrade_cta_view`.
  - `src/app/dashboard/page.tsx` — Banner de trial esgotado, telemetria de visualização do banner, telemetria de click, experiência de valor com mensagens rotativas e correção de hooks React (linter).
  - `src/app/dashboard/resultado/page.tsx` — Resultados parciais limitados a Top 3 achados, barra de progresso, restrições nas seções premium, telemetria `result_partial_view` e `upgrade_cta_click`.
- **Rotas afetadas**: `/dashboard/nova-analise`, `/dashboard/resultado`, `/api/analyze`, `/dashboard`, `/api/marketing/leads`
- **Alterações implementadas**:
  1. Centralização do controle de trial na tabela `marketing_leads`.
  2. Bloqueio de intake de segunda análise tanto no frontend quanto no backend com telemetria associada.
  3. Resultado parcial exibindo score ISF e resumo, limitando a visualização para os Top 3 riscos e ocultando seções avançadas.
  4. Barra de progresso visual de conversão e banner no dashboard informando limites com CTA de upgrade.
  5. Experiência de valor com mensagens informativas rotativas durante o loading.
- **Validações**: `npx tsc --noEmit` (exit 0), `npm run lint` (✓), `npm test` (464/464 — 15 suítes, ✓)
- **Deploy em produção**: **EFETUADO** com `vercel --prod --yes` (autorização explícita do usuário em 07/06/2026)
- **Riscos encontrados**:
  - O banco de dados de produção precisará ter os novos campos de `marketing_leads` aplicados antes de subir estas alterações para produção.

---


- **Data**: 07/06/2026
- **Bloco**: SPRINT COMERCIAL P0.1 — Captura de Leads Estratégica (Fases 1–7)
- **Arquivos criados**:
  - `src/lib/marketing/leadCapture.ts` *(novo)* — Camada de serviço: `captureLead`, `updateLeadActivity`, `markLeadConverted`, `complementLead`
  - `src/app/api/marketing/leads/route.ts` *(novo)* — API Route POST (capture/update_activity/mark_converted/complement) + GET admin com verificação de role
  - `src/app/dashboard/leads/page.tsx` *(novo)* — Dashboard admin `/dashboard/leads` com KPIs + tabela + formulário de complementação inline
  - `supabase/migrations/20260607_marketing_leads.sql` *(novo)* — SQL sugerido para tabela `marketing_leads` (NÃO executado)
- **Arquivos alterados**:
  - `src/app/(auth)/cadastro/page.tsx` — Captura automática de lead no signup (`captureLead` com nome, email, whatsapp, origem="signup")
  - `src/app/(auth)/login/page.tsx` — Atualização de `ultima_atividade` no login (`updateLeadActivity`, falha silenciosa)
  - `AGENTS.md`
- **Rotas afetadas**: `/cadastro`, `/login`, `/dashboard/leads` (nova), `/api/marketing/leads` (nova)
- **Alterações implementadas**:
  1. **FASE 1 — Diagnóstico**: Fluxo signup em `cadastro/page.tsx` (supabase.auth.signUp), login em `login/page.tsx` (signInWithPassword + /api/auth/session), profiles com campo `role` ('user'/'admin'), tabela `leads` existente (migration 20260607), sem middleware de rota.
  2. **FASE 2 — Modelagem**: SQL sugerido para `marketing_leads` com campos: id, created_at, user_id, nome, email, whatsapp, tipo_usuario, origem, converteu, converted_at, trial_utilizado, ultima_atividade, metadata. Constraint UNIQUE(email). RLS restritiva (apenas admin/service_role). NÃO executado.
  3. **FASE 3 — Camada de serviço**: `leadCapture.ts` com 4 funções idempotentes via fetch para `/api/marketing/leads`. Falha silenciosa em todas (não bloqueia fluxo principal).
  4. **FASE 4 — Captura automática**: Signup salva lead (nome, email, whatsapp, user_id, origem="signup"). Login atualiza `ultima_atividade` (fire-and-forget com `.catch(() => {})`).
  5. **FASE 5 — Complementação**: Formulário inline na tabela do dashboard admin (campos WhatsApp + select Tipo de Usuário). Chama `complementLead` via API Route.
  6. **FASE 6 — Dashboard admin `/dashboard/leads`**: KPIs (Total, Últimos 7 dias, Convertidos, Taxa Conversão) + tabela (nome, email, whatsapp, tipo, origem, convertido, data cadastro, botão Editar). Dados via GET `/api/marketing/leads` com token de sessão.
  7. **FASE 7 — Segurança**: `useEffect` verifica `role === 'admin'` via Supabase; redireciona usuário comum para `/dashboard`. API GET verifica token + role admin via `supabaseAdmin`. Usuário comum não acessa `/dashboard/leads`.
- **Ponto de captura**: No signup (após `supabase.auth.signUp` bem-sucedido) e no login (após `/api/auth/session` bem-sucedido).
- **Idempotência**: Upsert por email (`onConflict: 'email'`) — sem duplicidade.
- **Validações**: `npm run build` (25 rotas, ✓), `npm run lint` (✓), `npm test` (456/456 — 14 suítes, ✓)
- **Deploy em produção**: **NÃO EFETUADO** (aguardando autorização explícita do usuário)
- **SQL sugerido**: `supabase/migrations/20260607_marketing_leads.sql` — NÃO executado. Requer autorização para aplicar em produção.
- **Riscos encontrados**:
  - `SUPABASE_SERVICE_ROLE_KEY` deve estar configurado no `.env.local` e no Vercel para a API Route funcionar em produção.
  - A tabela `marketing_leads` ainda não existe no banco — a migration precisa ser executada antes do deploy.
  - Captura no signup é client-side (fetch para API Route) — se o usuário fechar a aba antes do fetch completar, o lead pode não ser salvo. Mitigação futura: trigger no banco via `handle_new_user`.
- **Próxima sprint recomendada**: Executar migration `20260607_marketing_leads.sql` em produção + configurar `SUPABASE_SERVICE_ROLE_KEY` no Vercel + integrar `markLeadConverted` no fluxo de upgrade de plano (Mercado Pago webhook).


---

- **Data**: 07/06/2026
- **Bloco**: Deploy em produção — SPRINT CONVERSÃO + SPRINT COMERCIAL P0 (Fases 2 e 3)
- **Arquivos alterados**: Nenhum (deploy do estado atual do repositório)
- **Rotas afetadas**: Todas as rotas do projeto (23 rotas)
- **Alterações implementadas**: Deploy em produção via `vercel --prod --yes` do commit `0637f9d`. Inclui todas as entregas das sprints anteriores: Landing Page Trial (CTA Gratuito), SPRINT COMERCIAL P0 Fase 2 (Bloqueio Trial + Captura de Lead + Conversão) e Fase 3 (Lead Scoring + Eventos Comerciais + Ranking de Leads Quentes).
- **Validações**: Build remoto concluído em 54s, 23 rotas geradas.
- **Deploy em produção**: **EFETUADO** com `vercel --prod --yes` (autorização explícita do usuário em 07/06/2026)
- **URL validada**: https://agrolex-ia-qx32.vercel.app/ → HTTP 200 ✓
- **Problemas restantes**: Nenhum.

---

- **Data**: 07/06/2026
- **Bloco**: SPRINT CONVERSÃO — Landing Page Trial (CTA Gratuito + Seção "Como funciona a análise gratuita")
- **Arquivos alterados**:
  - `src/app/page.tsx` — CTA principal trocado para "Fazer Análise Gratuita", subtexto adicionado, nova seção com 4 cards, link `/cadastro?next=/dashboard/nova-analise&trial=true`
  - `AGENTS.md`
- **Rotas afetadas**: `/` (landing page)
- **Alterações implementadas**:
  1. **CTA principal do hero**: trocado de "Verificar Minha Propriedade" para **"Fazer Análise Gratuita"** com link `/cadastro?next=/dashboard/nova-analise&trial=true`.
  2. **Subtexto do CTA**: adicionado "Teste o AgroLex com 1 matrícula simples. Sem compromisso." (verde) + "Resultado em até 5 minutos · Prévia inteligente gratuita" (dourado).
  3. **Seção "Como funciona a análise gratuita"**: inserida logo após o hero, com badge "1 análise gratuita · sem cartão · sem compromisso" e 4 cards: (1) Cadastre-se, (2) Envie uma matrícula simples, (3) Veja a prévia inteligente (ISF + classificação + alertas), (4) Desbloqueie quando quiser (relatório completo nos planos pagos).
  4. **Nota de transparência**: texto explícito de que a prévia gratuita inclui ISF/classificação/alertas, e que o relatório completo é exclusivo dos planos pagos. Sem promessa de relatório completo gratuito.
  5. **Linguagem premium mantida**: "análise gratuita", "prévia inteligente", "relatório completo bloqueado para planos".
  6. **Novos ícones importados**: `UserPlus`, `Send`, `BarChart2` do lucide-react.
- **Validações**: `npm run build` (23 rotas, ✓), `npm run lint` (0 erros, 0 warnings, ✓), `npm test` (456/456 — 14 suítes, ✓)
- **Deploy em produção**: **NÃO EFETUADO** (aguardando autorização explícita do usuário)
- **Problemas restantes**: Nenhum.


---

- **Data**: 07/06/2026
- **Bloco**: SPRINT COMERCIAL P0 — FASE 3 (Lead Scoring + Eventos Comerciais + Ranking de Leads Quentes)
- **Arquivos alterados**:
  - `src/lib/commercial/scoring.ts` *(novo)* — Motor de scoring comercial (funções PURE)
  - `src/lib/commercial/__tests__/scoring.test.ts` *(novo)* — Suíte de testes do scoring (61 testes)
  - `src/app/dashboard/resultado/page.tsx` — Importação de scoring, registro de eventos comerciais, CTA com blocked_premium_clicked
  - `src/app/dashboard/planos/page.tsx` — Importação de scoring, registro de evento plan_clicked no CTA
  - `src/app/admin/leads/page.tsx` — KPIs de temperatura (Frios/Mornos/Quentes/Muito Quentes), colunas Score/Temperatura/Último Evento, ordenação por score
  - `AGENTS.md`
- **Rotas afetadas**: `/dashboard/resultado`, `/dashboard/planos`, `/admin/leads`
- **Alterações implementadas**:
  1. **scoring.ts**: `CommercialEventType`, `CommercialScoreLevel`, `CommercialEvent`, `COMMERCIAL_EVENT_SCORES`, `getCommercialEventScore`, `calculateCommercialScore`, `getCommercialScoreLevel`, `getCommercialScoreLabel`, `getCommercialScoreBadge`, `createCommercialEvent`, `extractEventsFromMetadata`, `appendCommercialEvent`, `buildMetadataWithEvent`, `calculateLeadScore`, `getLastCommercialEvent`, `compareLeadScores`.
  2. **Persistência**: via `leads.metadata.commercial_events` (campo JSON existente). Fallback silencioso se metadata não existir. TODO técnico documentado no código.
  3. **resultado/page.tsx**: registra `result_viewed` (useEffect, uma vez por sessão), `blocked_premium_clicked` (CTA "Desbloquear Relatório Completo").
  4. **planos/page.tsx**: registra `plan_clicked` (CTA "Escolher Plano") com `plan_id` no meta.
  5. **admin/leads**: 4 novos KPIs (Leads Frios 🧊, Mornos 🌤️, Quentes 🔥, Muito Quentes 🚀), 3 novas colunas (Score, Temperatura, Último Evento), tabela ordenada por score decrescente (muito_quente → frio).
  6. **scoring.test.ts**: 61 testes cobrindo pontuação por evento, soma, classificação frio/morno/quente/muito_quente, fallback para evento desconhecido, score acima de 100, helpers de persistência, ordenação.
- **Validações**: `npm run build` (23 rotas), `npm run lint` (0 erros, 0 warnings), `npm test` (456/456 — 14 suítes)
- **Deploy em produção**: **NÃO EFETUADO** (aguardando autorização explícita do usuário)
- **Problemas restantes**: Migration `leads.metadata` (coluna JSONB) pendente para ativar persistência real de eventos. Próxima Sprint: integração Mercado Pago para upgrade de plano.


---

- **Data**: 07/06/2026
- **Bloco**: SPRINT COMERCIAL P0 — FASE 2 (Bloqueio Trial + Captura de Lead + Conversão)
- **Arquivos alterados**:
  - `src/app/dashboard/nova-analise/page.tsx` — Bloqueio trial, modal de lead obrigatório, useEffect de verificação
  - `src/app/dashboard/resultado/page.tsx` — Card Premium trial, gatilhos de conversão, importações comerciais
  - `src/app/dashboard/page.tsx` — Importações comerciais (trial.ts, plans.ts), estado trialProfile/trialBlockModal
  - `src/app/dashboard/planos/page.tsx` — Tela de planos (Starter, Profissional, Empresarial, Trial)
  - `src/app/admin/leads/page.tsx` *(novo)* — Dashboard comercial /admin/leads
  - `AGENTS.md`
- **Rotas afetadas**: `/dashboard/nova-analise`, `/dashboard/resultado`, `/dashboard`, `/dashboard/planos`, `/admin/leads`
- **Alterações implementadas**:
  1. **Obj 1 — Bloqueio de segunda análise trial**: `nova-analise/page.tsx` verifica `plan_type === 'trial' && trial_used === true` via Supabase; exibe tela de bloqueio com CTA "Ver Planos" em vez do formulário.
  2. **Obj 2 — Captura obrigatória de lead**: Modal obrigatório ao entrar em `/dashboard/nova-analise`; verifica existência e completude do lead (nome, email, telefone, cidade, estado) via `supabase.from('leads')`; upsert com `onConflict: 'user_id'`; usa helpers `montarLeadPayload` de `lead.ts`.
  3. **Obj 3 — Experiência gratuita controlada**: `resultado/page.tsx` busca `plan_type` do profile; usuário trial vê Card Premium com prévia limitada (ISF + classificação + alertas visíveis, mas relatório completo bloqueado visualmente).
  4. **Obj 4 — Gatilhos de conversão**: Card Premium com indicadores psicológicos (✓ Auditoria realizada, ✓ Documento processado, ✗ riscos encontrados, 🔒 Relatório completo bloqueado, 🔒 Cadeia dominial bloqueada, 🔒 Módulos avançados bloqueados) + contador "Você está visualizando apenas uma prévia da análise" + CTA "Desbloquear Relatório Completo".
  5. **Obj 5 — Tela de planos**: `/dashboard/planos` com grid de 4 planos (Trial, Starter, Profissional, Empresarial), features, highlights, preços, CTA "Escolher Plano", badge "Plano Atual".
  6. **Obj 6 — Dashboard comercial**: `/admin/leads` com KPIs (Total Leads, Trials, Conversões, Taxa Conversão, ISF Médio) + tabela de leads com nome, email, WhatsApp, cidade/UF, origem, status.
- **Validações**: `npm run build` (23 rotas), `npm run lint` (aprovado), `npm test` (395/395 — 13 suítes)
- **Deploy em produção**: **NÃO EFETUADO** (aguardando autorização explícita do usuário)
- **Problemas restantes**: Nenhum. Próxima Sprint: integração Mercado Pago para upgrade de plano.


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
- **Bloco**: Hotfix — Correção de desalinhamento no layout do laudo (card unificado — FASE 3.1)
- **Arquivos alterados**: `src/app/dashboard/resultado/page.tsx` (deploy do commit `9680d3e`), `AGENTS.md`
- **Rotas afetadas**: `/dashboard/resultado`
- **Alterações implementadas**: Deploy do commit `9680d3e` (FASE 3.1) que unificou o layout do laudo em um card único com `overflow-hidden`, corrigindo o desalinhamento visual entre os dois cards separados (cabeçalho `rounded-t-2xl` + corpo `rounded-b-2xl`) que criavam um gap/borda no layout antigo.
- **Validações**: `npm run build` (22 rotas), `npm run lint` (aprovado), `npx tsc --noEmit` (exit 0), `npm test` (81/81)
- **Deploy em produção**: **EFETUADO** com `vercel --prod --yes` (autorização explícita do usuário em 05/06/2026)
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard (HTTP 307 → `/login`)
- **Problemas restantes**: Nenhum.

---

- **Data**: 05/06/2026
- **Bloco**: Hotfix — Correção de desalinhamento do parecer na tela (CSS text-align: justify em div/span)
- **Arquivos alterados**: `src/app/globals.css`, `AGENTS.md`
- **Rotas afetadas**: `/dashboard/resultado`
- **Alterações implementadas**: Removido `text-align: justify !important` das regras `.report-text div`, `.report-text span`, `section span`, `section div` e do bloco `.text-left/.text-center/.text-right`. O justify agora aplica-se apenas a `p` e `li`, restaurando o alinhamento correto de badges, ícones, grid e cards do parecer.
- **Validações**: `npm run build` (22 rotas), `npm run lint` (aprovado), `npx tsc --noEmit` (exit 0)
- **Deploy em produção**: **EFETUADO** com `vercel --prod --yes` (autorização explícita do usuário em 05/06/2026) — 42s
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard/resultado (HTTP 307 → `/login`)
- **Problemas restantes**: Nenhum.

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
- **Próximos passos**: FASE 5 — Processamento em Etapas (Anti-Timeout)

---

- **Data**: 05/06/2026
- **Bloco**: FASE 4 — Checkout Modular (Pagamento Real — Mercado Pago Sandbox)
- **Arquivos alterados**: `src/app/api/checkout/route.ts`, `src/app/api/webhook/mercadopago/route.ts`, `src/app/dashboard/page.tsx`, `src/lib/payments/mercadopago.ts` (novo), `supabase/migrations/20260605_orders_payments.sql` (novo), `AGENTS.md`, `PROJECT_CONTEXT_AGROLEX.md`
- **Rotas afetadas**: `/api/checkout`, `/api/webhook/mercadopago`, `/dashboard`
- **Alterações implementadas**:
  1. **Migration** `orders` + `payments`: tabelas para rastrear pedidos e transações do Mercado Pago, com RLS e índices.
  2. **Lib `src/lib/payments/mercadopago.ts`**: integração com API do Mercado Pago (sandbox). Funções `createPreference` (cria checkout) e `getPayment` (consulta status). Fallback automático para simulação quando token não configurado.
  3. **Endpoint `/api/checkout`**: substitui simulação por integração real com Mercado Pago. Cria preferência de pagamento, registra ordem no banco, retorna URL de checkout. Fallback dev quando `MERCADOPAGO_ACCESS_TOKEN` ausente.
  4. **Webhook `/api/webhook/mercadopago`**: processa notificações de pagamento (aprovação/rejeição/cancelamento). Atualiza `orders`, `payments` e status da análise (`payment_pending → ready_for_processing`).
  5. **Dashboard**: botão "Liberar processamento" substituído por "Pagar". Função `handlePayNow` redireciona ao checkout do Mercado Pago (ou simula em dev). Texto do modal atualizado para "realize o pagamento".
- **Validações**: `npm run build` (22 rotas), `npm run lint` (aprovado), `npx tsc --noEmit` (exit 0), `npm test` (81/81)
- **Commit**: Pendente
- **Deploy em produção**: **NÃO EFETUADO** (sandbox — aguardando autorização explícita do usuário para produção)
- **URL validada**: Build local OK
- **Próximos passos**: Configurar `MERCADOPAGO_ACCESS_TOKEN` no .env para testes em sandbox; FASE 5 — Processamento em Etapas

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
- **Resultados de validação**: `npm run build`, `npm run lint` e `npx tsc --noEmit` aprovados.
- **Deploy**: Não aplicável (sem deploy neste bloco).
- **URL validada**: Painel validado localmente.
- **Problemas restantes**: Finalizar configuração de pagamento real (FASE 4) e processamento em etapas (FASE 5).
