# Mercado Pago Preapproval — cobrança recorrente real do Radar

> **Eixo 2 — Recorrência/MRR · fechamento da pendência de auto-débito**
> Data: 2026-07-01 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`

## 1. Objetivo

Substituir o modelo de renovação manual do Radar (lembrete por e-mail + cliente
clica e paga de novo todo mês, via Preference) por **cobrança recorrente
automática** (MP Preapproval): o cliente autoriza uma vez e o MP cobra sozinho
todo mês. Inclui cancelamento em 1 clique dentro do app (postura CDC: cancelar
tão fácil quanto assinar; acesso permanece até o fim do período já pago).

Decisões fechadas com o usuário (via /brainstorming, 01/07):
- **Substituição completa** do fluxo do Radar (não haverá opção "pagar manualmente") — não existe assinante ativo hoje, então não há migração de legado; Preference permanece intacta para planos/pacotes.
- **Cancelamento no app na v1.**
- **Critério de pronto**: ciclo completo em sandbox (assinar com cartão de teste → webhook ativa → cancelar pelo botão → status reflete). A 2ª cobrança mensal não é observável em sandbox — coberta por teste unitário e validada na 1ª renovação real.

## 2. Contrato da API MP (verificado na doc oficial, não suposto)

- `POST /preapproval` sem plano associado e sem card_token: body com `reason`,
  `external_reference`, `payer_email`, `auto_recurring {frequency: 1,
  frequency_type: "months", transaction_amount, currency_id: "BRL"}`,
  `back_url`, `status: "pending"`. Resposta traz `id` e `init_point`
  (redirect de autorização — mesma UX do checkout atual).
- Webhooks: `type = "subscription_preapproval"` (vínculo/status da assinatura:
  authorized/paused/cancelled) e `type = "subscription_authorized_payment"`
  (cada cobrança recorrente). Payload traz só `data.id` — buscar o recurso
  completo na API após receber (mesmo padrão do handler de `payment` atual).
- Cancelamento: `PUT /preapproval/{id}` com `{status: "cancelled"}`.

## 3. Componentes

| Arquivo | Ação |
|---|---|
| `src/lib/payments/mercadopagoPreapproval.ts` | **Novo** — `createPreapproval`, `getPreapproval`, `getAuthorizedPayment`, `cancelPreapproval`. Mesmo estilo/env vars do `mercadopago.ts` (que fica intacto). |
| `src/app/api/monitoring/checkout/route.ts` | Modify — troca `createPreference` por `createPreapproval` (`external_reference = user.id`); grava `radar_subscriptions` com `status:'pending'` + `mp_preapproval_id` ANTES do redirect; `orders` sai do fluxo do Radar; fallback simulado (MP não configurado) mantido. |
| `src/app/api/webhook/mercadopago/route.ts` | Modify — 2 ramos novos ANTES do fluxo atual: `subscription_preapproval` (authorized→ativa; cancelled/paused→cancela) e `subscription_authorized_payment` (aprovado→estende `expires_at` via `computeRenewalExpiry`, correlação por `mp_preapproval_id`, idempotente via último payment id processado). Fluxo `payment` avulso intocado. |
| `src/app/api/monitoring/subscription/cancel/route.ts` | **Novo** — POST autenticado; cancela apenas a assinatura do próprio usuário; acesso permanece até `expires_at`. |
| `src/app/dashboard/radar/page.tsx` | Modify — botão "Cancelar renovação automática" (com confirmação) quando assinatura ativa com `mp_preapproval_id`; copy do checkout deixa claro que é assinatura mensal automática. |
| `src/app/api/cron/renewals/route.ts` | Modify — assinatura com `mp_preapproval_id` ativo NÃO recebe lembrete de renovação manual (MP cobra sozinho); recebe aviso apenas se `paused` (cobrança automática falhou). |

## 4. Dados

Sem migration: `radar_subscriptions.mp_preapproval_id` (TEXT) já existe desde
20260614 e nunca foi usada. Idempotência da renovação: último
`authorized_payment_id` processado guardado em `mp_subscription_id` (coluna
também já existente e sem uso) — evita estender `expires_at` duas vezes no
mesmo evento reentregue.

## 5. Fluxos

- **Assinar**: radar page → POST /api/monitoring/checkout → cria preapproval
  `pending` no MP + upsert `radar_subscriptions {status:'pending',
  mp_preapproval_id}` → redirect `init_point` → cliente autoriza no MP →
  webhook `subscription_preapproval` (authorized) → `status:'active'`,
  `expires_at=+30d`.
- **Renovar (automático)**: MP cobra → webhook `subscription_authorized_payment`
  → busca pagamento; se aprovado e inédito → `expires_at =
  computeRenewalExpiry(atual)` (estende, não reseta).
- **Cancelar (app)**: botão → POST /api/monitoring/subscription/cancel → PUT
  MP cancelled → `status:'cancelled'`, `cancelled_at=now` (acesso até
  `expires_at`). Cancelamento feito por dentro do app do MP chega pelo mesmo
  webhook `subscription_preapproval` → nunca dessincroniza.
- **Falha de cobrança**: MP põe `paused` → webhook marca e o cron passa a
  avisar o cliente (dunning aproveitando `sendRadarRenewalReminder`).

## 6. Governança / risco

- Classe: toca webhook de pagamento em produção, mas apenas ADICIONANDO ramos
  por tipos de evento hoje ignorados; fluxo avulso (planos/pacotes) inalterado.
  Sem migration. Rollback = revert de 1 commit. Risco 🟡 médio (dinheiro).
- Sandbox primeiro (`MERCADOPAGO_SANDBOX`), dinheiro real só quando o usuário
  trocar o token para produção.

## 7. Critérios de aceite

1. Assinar em sandbox com cartão de teste ativa `radar_subscriptions` de
   verdade via webhook (`status:'active'`, `expires_at≈+30d`, `mp_preapproval_id` preenchido).
2. Botão de cancelar muda o status no MP e no banco; acesso permanece até `expires_at`.
3. Evento `subscription_authorized_payment` duplicado não estende `expires_at` duas vezes (unitário).
4. Assinante com preapproval ativo não recebe e-mail de "renove manualmente" do cron (unitário).
5. `tsc` 0 · `lint` 0 erros · `jest` sem regressão · `build` OK.
