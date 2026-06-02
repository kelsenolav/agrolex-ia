# STABLE_BASELINE_AGROLEX

## 1. Marco Estavel Escolhido

Nome: **Marco Estavel Beta 01 - Laudo Compartilhavel**

Base Git reproduzivel para reconstrucao: `2c3a1b6` sobre o rollback `aead692`.

Candidato operacional de referencia na Vercel: `dpl_7kmGX2JnZG9qEPVD3CDcv3njkyhF`, publicado em 01/06/2026 18:17:46 no fuso America/Araguaina.

Importante: o deployment candidato foi criado com `gitDirty=1`. Ele serve como referencia operacional, mas nao como snapshot reproduzivel. A nova linha de base deve ser reconstruida em branch limpa e commitada antes de qualquer deploy.

## 2. Funcionalidades Consideradas Estaveis

- Login e protecao das rotas privadas.
- Dashboard com acesso aos pareceres.
- Geracao de laudo tecnico a partir de analise concluida.
- Exibicao do laudo privado correto por `analysisId`.
- Exportacao PDF por impressao.
- Marca visual AgroLex.
- Link publico seguro com token.
- Revogacao do link publico.
- Pagina publica do laudo sem login.
- Mensagem pronta para WhatsApp apos gerar o link.
- Botoes "Copiar mensagem para WhatsApp" e "Abrir WhatsApp".

Pagamento real, Mercado Pago, selecao avancada de modulos e processamento assincrono da IA nao fazem parte deste marco estavel.

## 3. Arquivos Criticos

- `src/app/api/analyze/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/webhook/mercadopago/route.ts`
- `src/app/dashboard/nova-analise/page.tsx`
- `src/app/dashboard/resultado/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/api/laudos/share/route.ts`
- `src/app/api/laudos/share/revoke/route.ts`
- `src/app/laudo/publico/[token]/page.tsx`
- `src/lib/publicReports.ts`
- `src/lib/supabaseAdmin.ts`
- `src/lib/supabaseServerUser.ts`
- `src/lib/authCookies.ts`
- `src/proxy.ts`
- `supabase/migrations/00001_public_report_links.sql`

## 4. Regras Para Alterar Arquivos Criticos

1. Criar branch limpa para cada sprint.
2. Nao publicar com `gitDirty=1`.
3. Commitar rotas, helpers e migration relacionados no mesmo marco funcional.
4. Alterar no maximo um fluxo critico por sprint.
5. Nao misturar checkout, motor de analise e apresentacao do laudo no mesmo sprint.
6. Preservar login, PDF, compartilhamento, revogacao e WhatsApp em toda alteracao.
7. Nao salvar `completed` sem `findings.resumo` valido.
8. Nao deixar analise indefinidamente em `processing`.
9. Nao usar preco enviado pelo frontend como fonte de verdade.
10. Nao alterar banco ou RLS sem migration revisada e autorizacao expressa.

## 5. Checklist Obrigatorio Antes de Deploy

- Confirmar branch e `git status` limpo.
- Confirmar commit exato a publicar.
- Rodar `npm.cmd run build`.
- Rodar `npm.cmd run lint`.
- Rodar `npx.cmd tsc --noEmit`.
- Validar login e redirecionamento de rota privada.
- Criar analise nova autenticada com documento real de teste.
- Confirmar transicao de status sem `processing` eterno.
- Confirmar que laudo concluido possui `findings.resumo`.
- Confirmar PDF.
- Gerar link publico e abrir em aba anonima.
- Revogar link e confirmar indisponibilidade.
- Confirmar mensagem WhatsApp e ausencia de dados internos.
- Registrar deployment ID, commit e URL especifica da Vercel.

## 6. Plano de Rollback

1. Nao usar rollback cego para um deployment com `gitDirty=1`.
2. Criar branch de estabilizacao a partir de `2c3a1b6`.
3. Reaplicar seletivamente auth, laudo privado, PDF, link publico, revogacao e WhatsApp.
4. Commitar todos os arquivos hoje nao rastreados que pertencem ao marco.
5. Validar localmente e em preview.
6. Publicar somente apos homologacao do preview.
7. Manter o alias atual ate o preview aprovado estar pronto.

## 7. Funcionalidades Congeladas Temporariamente

- Mercado Pago e Pix real.
- Checkout Pro.
- Modo de pagamento simulado em producao.
- Selecao multipla e pacote master de modulos.
- Novas alteracoes em `/api/analyze`.
- Reprocessamento automatico.
- Novas migrations ou alteracoes de RLS.

## 8. Proximos Sprints Permitidos

- Reconstrucao da branch limpa de estabilizacao.
- Inclusao em Git dos arquivos de auth e compartilhamento seguro.
- Teste controlado do motor de analise em preview.
- Observabilidade de erros da IA sem exposicao de segredo.
- Homologacao do laudo, PDF, link publico, revogacao e WhatsApp.

## 9. Proximos Sprints Proibidos Ate Estabilizacao

- Novas features comerciais.
- Alteracoes simultaneas em checkout e analise.
- Mudancas visuais amplas no dashboard.
- Novos modulos de auditoria.
- Deploy a partir de arvore suja.
- Alteracoes manuais no banco remoto.
- Reprocessamento em massa de analises antigas.
