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

## Estado Atual (03/07/2026)

**Produto (tudo em produção em https://agrolexi.com.br):** análise de matrícula rural por IA com ISF v2.2 (motor determinístico + Proof Engine com fixtures golden + guardas semânticas + trilha de auditoria `findings.isf_verdict`); Radar de Monitoramento (R$49,90/prop/mês, assinatura MP Preapproval com auto-débito + cancelamento no app, dunning/graça/win-back); Crédito Rural (elegibilidade, defesa em execução de cédula, ambiental com verificação AO VIVO TerraBrasilis/CAR, **Dossiê CMN 5.193** com veredito apto/ressalvas/impedido + saneamento); **Análise de Sobreposição Georreferenciada** (`/dashboard/sobreposicao`: TI/UC/embargo/CAR-vizinho com mapa e leitura jurídica determinística); Data Room real (signed URLs); Calendário Ambiental com lembrete por e-mail (7/3/0 dias); Nova Análise aceita **foto da matrícula** (foto→PDF no navegador); recuperação de senha; painel comercial `/dashboard/leads` com atividade real + botão WhatsApp manual (wa.me).

**Infra/operacional:** Vercel (projeto `agrolex-ia-qx32`, domínio agrolexi.com.br); Supabase prod `hbcnsgpdosooodmwfsgh` (SQL em prod via **Management API** com `SUPABASE_ACCESS_TOKEN`+`SUPABASE_PROD_PROJECT_ID` do .env.local — o pooler-url do .temp está corrompido, não usar); **Mercado Pago em PRODUÇÃO real** (`MERCADOPAGO_PRODUCTION=true`; conta KELSENBRUNO/kelsenb@hotmail.com — dono não consegue assinar de si mesmo); Resend com domínio **agrolexi.com.br verificado** (remetente `contato@agrolexi.com.br`); Supabase Auth `site_url=https://agrolexi.com.br` + allowlist; crons: `/api/monitoring/cron` (dias 1 e 15) e `/api/cron/renewals` (diário 08h UTC — inclui trial reminders com `TRIAL_REMINDER_ENABLED=true` e calendar reminders); cascata de IA **4/4 viva** (Gemini 3.5-flash → claude-haiku-4-5 → OpenAI → Groq gpt-oss-120b; checar com `node scripts/ai-cascade-preflight.mjs`).

**Gotchas técnicos vivos (aprendidos ao vivo — não redescobrir):** ArcGIS do PAMGIA/IBAMA exige espaço como `%20` (não `+`) e **derruba a query inteira** se `outFields` listar campo inexistente; geoserver FUNAI exige **WFS 1.0.0** (2.0 falha sem sortBy) e **User-Agent de browser**; bucket `documents` é **PDF-only 50MB** (decisão mantida — foto vira PDF no cliente); `properties` tem `car_code` (Radar) **e** `car_number` (legado); `profiles` tem `name` (não `full_name`); `analyses.completed_at` vive no JSONB `findings` (não é coluna); e2e da análise: **limpar os docs da propriedade de teste antes** (a rota OCR-iza todos os docs da propriedade).

**Pendências:** 🔴 revisão jurídica de mérito pelo usuário (advogado) dos textos de `overlapLegalReading.ts` e `dossieEngine.ts`; INCRA/SIGEF fora do ar (sobreposição com parcelas certificadas rotulada `indisponivel`); `verifyWebhookSignature` do MP é TODO (mitigado: handlers consultam a API do MP como fonte de verdade); sub-bloco 1.2 (eval LLM) aguarda volume de uso; **próximo passo é COMERCIAL** — ligações pra rede do usuário usando a sobreposição como isca ("me dá o código CAR que eu te mando o relatório").

**Regras de trabalho acordadas:** rodar `/brainstorming` + `/product-brainstorming` antes de trabalho de feature/produto; testar fontes externas AO VIVO antes de desenhar; honestidade de proveniência (nunca fingir que verificou); determinístico onde importa juridicamente; deploy autônomo autorizado (`git push` + `vercel --prod --yes`); 1 bloco por commit; specs em `docs/superpowers/specs/` (dir no gitignore — `git add -f`, mesmo p/ `src/lib/pdf/__tests__`).

> **Histórico completo dos blocos** (jun/2026 em diante) em `AGENTS-ARCHIVE.md` — consultar sob demanda; não é carregado automaticamente. **Rotação**: ao registrar um bloco novo aqui, mover o mais antigo dos "Últimos blocos" para o topo do archive e atualizar o Estado Atual.

## Últimos blocos

- **Data**: 26/10/2026
- **Bloco**: Fix — Groq aposentou a família Llama (404 model_not_found); 4º degrau da cascata migrado p/ `openai/gpt-oss-120b`
- **Achado**: preflight de retomada deu 3/4 vivos; `/models` da Groq não lista mais nenhum Llama geral. gpt-oss testado AO VIVO antes da troca: JSON limpo (raciocínio vem em campo separado), ~1,7s; reasoning_tokens consomem `max_tokens` (teto 32768 cobre).
- **Arquivos**: `src/lib/aiProviders.ts` (default `GROQ_MODEL`), `scripts/ai-cascade-preflight.mjs`. Vercel não tem `GROQ_MODEL` fixado (verificado) — vale o default do código.
- **Validação**: preflight **4/4**, tsc 0, lint 0 erros, jest **794**, build OK. Commit `8f467959`. Deploy EFETUADO (agrolexi.com.br 200; /dashboard 307).
- **Nota operacional**: CLI da Vercel tinha perdido o login nesta máquina (usuário refez `vercel login`); push nesta branch gera só Preview — produção exige `vercel --prod --yes`.
---
- **Data**: 05/07/2026
- **Bloco**: Fix — matrícula densa truncava JSON em 8192 tokens (análise nunca concluía) + revisão de código pegou 3 gaps na cascata
- **Caso real**: Raimundo Nonato/Miracema (usucapião do usuário) — inteiro teor + vintenária estouravam `maxOutputTokens=8192` → JSON truncado → parse falhava → retry determinístico. OCR estava perfeito; o gargalo era SAÍDA.
- **Fix**: caminho denso pede 16384; `PROVIDER_OUTPUT_CAPS` (fonte única em `aiProviders.ts`) protege cada provedor contra 400 por pedido acima do teto (400 casa com NON_FALLBACK e derrubaria a cascata inteira).
- **`/code-review` (protocolo novo, 1ª utilização) pegou ANTES do deploy**: (1) Claude/OpenAI/Groq devolviam resposta truncada como sucesso — agora `stop_reason`/`finish_reason` viram `ai_incomplete_response` (elegível a fallback, cascateia); (2) teto 8192 dado ao Claude era factualmente errado (haiku 4.5 aceita 64k) e reintroduzia o bug no fallback; (3) Gemini sem clamp.
- **Prova em produção**: reprocesso da análise real concluiu — ISF 39/crítico, parecer forense íntegro (7,2k chars), trilha `isf_verdict` presente. OCR resumível (cache do bloco 30/06) fez o reprocesso custar só a etapa de síntese.
- **Limpeza**: 3 propriedades "Raimundo Nonato" duplicadas (retries do wizard, 0 análises/0 docs) deletadas de prod.
- **Validação**: tsc 0, lint 0, jest **794** (+4), build OK. Deploy EFETUADO.
- **Nota UX a observar**: wizard cria propriedade nova a cada tentativa — candidato a dedup futuro.
---
- **Data**: 03/07/2026
- **Bloco**: Foto da matrícula → PDF no navegador (Nova Análise) — a "capacidade mobile" sem app
- **Contexto**: pergunta do usuário "o AgrolexI pode virar app Android/iOS?" → `/product-brainstorming` concluiu: PWA/lojas são prematuros (gatilho = 1º assinante do Radar; iOS tem armadilha dupla: rejeição de wrapper por Guideline 4.2 + IAP 15-30% colidindo com o checkout MP); a ÚNICA capacidade mobile com dor real observada é o produtor com matrícula em papel esbarrando no upload PDF-only. Usuário escolheu executar só isso. `/brainstorming` fechou: escopo só Nova Análise; N fotos → 1 PDF com prévia ordenada; limites 20 fotos/8MB.
- **Implementação (aditiva, arquivos críticos preservados)**:
  - `src/lib/pdf/photosToPdf.ts` *(novo, client-side)* — `photosToPdf(File[]) → File` PDF: normaliza orientação EXIF (`createImageBitmap` + canvas — foto de celular chega deitada sem isso), comprime JPEG 0.85, 1 foto/página A4 (paisagem gira a página), nome `matricula-fotos-Npag-<ts>.pdf`. Validações puras exportadas (`validarFoto`/`validarLoteFotos`, 6 testes). `pdf-lib` já era dependência.
  - `nova-analise/page.tsx` (crítico no baseline — mudança **aditiva**): seção "Sem PDF? Fotografe a matrícula" com `input accept="image/*" capture="environment" multiple`, miniaturas ordenadas (pág. 1..N) com remoção, botão gera o PDF e entrega ao `processFiles` **existente**. Fluxo de PDF atual intocado; **bucket segue PDF-only** (decisão do bloco Data Room mantida) e `/api/analyze` não foi tocado — o backend nem sabe que era foto.
- **Prova no browser real (preview autenticado)**: 2 fotos geradas via canvas (retrato 900×1200 + paisagem 1200×900) injetadas no input via `DataTransfer` → miniaturas renderizadas → `matricula-fotos-2pag-*.pdf` apareceu na lista de documentos pronto pro envio normal. (A conversão usa APIs de browser — canvas/createImageBitmap — então jsdom não cobre; a prova real é essa.)
- **Nota de higiene**: `src/lib/pdf/__tests__` está no `.gitignore` legado — teste força-adicionado (`git add -f`), mesmo padrão de blocos anteriores.
- **Validação**: `tsc` 0, `lint` 0 erros, `jest` **790** (+6), `build` OK. Deploy **EFETUADO**.
- **Decisões registradas da avaliação mobile**: PWA com web push quando houver 1º assinante do Radar; wrapper Capacitor só Android e só com demanda por loja; iOS por último (IAP); reescrita React Native descartada neste estágio.

---

- **Data**: 03/07/2026
- **Bloco**: Aposta 2 — Dossiê de Conformidade CMN 5.193 por operação de crédito (fecha o ciclo das 2 apostas de valor agregado)
- **Contexto**: continuação direta da aposta 1 (mesma sessão de `/product-brainstorming` com pesquisa de mercado; `/brainstorming` fechou 3 decisões: conteúdo completo com saneamento; gate dentro do plano ativo — cobrança por operação só quando houver cooperativa compradora; UI como aba nova no módulo Crédito Rural). Spec em `docs/superpowers/specs/2026-07-03-dossie-cmn-5193-design.md`.
- **Implementação (quase tudo reuso)**:
  - `src/lib/creditoRural/dossieEngine.ts` *(novo, puro)* — `computeDossieVerdict`: veredito determinístico `apto | apto_com_ressalvas | impedido` à luz das Res. CMN 5.193/5.267/5.268. Regras: embargo geo OU autodeclarado→impedido; TI→impedido (art. 231 §6º CF); UC crítica→impedido, uso sustentável→ressalva; CAR CA/SU→impedido, PE→ressalva; DETER com alerta→ressalva (não bloqueia sozinho — nível município); vizinho >50%→ressalva de conflito dominial. **Regra de honestidade central: fonte indisponível/falha NUNCA vira `apto` pleno** — rebaixa pra ressalva com lacuna explícita. Cada impedimento/ressalva carrega base normativa + plano de saneamento (template determinístico, mérito sujeito a revisão do usuário-advogado). **12 testes**.
  - `api/credito-rural/dossie` *(novo)* — mesmo `authGate`; orquestra `fetchCarPolygon`→sobreposições (aposta 1) + `consultarDesmatamentoTerraBrasilis` em `Promise.allSettled`; persiste `tipo:'dossie'` em `credito_rural_analises` (CHECK de `tipo` ampliado via migration `20260703`, **aplicada em prod** via Management API; `faixa` guarda o veredito).
  - `dashboard/credito-rural/page.tsx` — aba "Dossiê 5.193" + card no hub; código CAR pré-preenchido da propriedade (**achado**: a página usava só `car_number` legado; agora lê `car_code` do Radar com fallback — as DUAS colunas existem em prod); checkbox de embargo declarado; veredito em banner colorido, impedimentos/ressalvas com base normativa e providência, lacunas de verificação, link pra sobreposição completa, export PDF.
- **Prova ao vivo (mesmo CAR real de Couto Magalhães/TO)**: veredito **`apto_com_ressalvas`** com raciocínio exato — 34 alertas DETER na região (854,5 ha) + conflito dominial de 99,82% (CAR vizinho) + lacuna INCRA explícita — persistido em 2,6s. UI verificada autenticada: banner, ressalvas com base/providência, disclaimer, zero erro de console.
- **Validação**: `tsc` 0, `lint` 0 erros, `jest` **784** (+12), `build` OK. Deploy **EFETUADO**.
- **⚠️ Revisão jurídica pendente (mesmo gate da aposta 1)**: textos de `dossieEngine.ts` (bases normativas e planos de saneamento) redigidos pelo agente — revisar mérito antes de usar comercialmente.
- **✅ CICLO DAS 2 APOSTAS COMPLETO**: sobreposição georreferenciada (isca de demo) + dossiê 5.193 (produto vendável a cooperativas/advogados com prazo regulatório). Próximo passo natural é COMERCIAL, não código: usar a sobreposição como gancho nas ligações pra rede do usuário ("me dá o código CAR que eu te mando o relatório").

---

- **Data**: 03/07/2026
- **Bloco**: Aposta 1 — Análise de Sobreposição Georreferenciada (TI/UC/embargo/CAR vizinho) — NENHUM player BR tem isso em self-service
- **Contexto**: usuário pediu sugestão de CTO com pesquisa de mercado real; sessão de `/product-brainstorming` validou 2 apostas (spec da 1ª em `docs/superpowers/specs/2026-07-02-sobreposicao-georreferenciada-design.md`); `/brainstorming` fechou 4 decisões (posicionamento: página própria + PDF; sem CAR → digitar na hora c/ fallback mapa; CAR-vs-CAR entra na v1; leitura jurídica DETERMINÍSTICA por template, sem IA).
- **Fontes geoespaciais validadas AO VIVO antes do design (regra do projeto)**: polígono do imóvel via **camada CAR nacional espelhada no PAMGIA/IBAMA** (ArcGIS REST, 1 camada por UF — mapa completo das 27 UFs extraído do metadata; busca por `cod_imovel` exato devolve GeoJSON); embargos IBAMA **ativos** em `SISCOM/publico/MapServer/3` (desembargos=4 e cancelados=5 separados — nunca acusamos embargo levantado; isso destrava o embargo georreferenciado que era "impossível" via zip de 53MB); TIs no geoserver FUNAI (**exige User-Agent de browser** — 403 com UA padrão); UCs federais no INDE (`ICMBio:limiteucsfederais_a`). **INCRA/SIGEF fora do ar em todos os testes** → v1 rotula `indisponivel` explicitamente.
- **Implementação**: `src/lib/geo/geoProviders.ts` (fetchers c/ proveniência), `overlapEngine.ts` (interseção turf pura, ha/%, severidade por faixa, agregação por entidade), `overlapLegalReading.ts` (templates jurídicos: TI→art. 231 §6º CF + STF; UC→SNUC; embargo→propter rem + Res. CMN 5.193; vizinho→CAR declaratório art. 29 §2º), rota `/api/geo/sobreposicao` (authGate do crédito rural, `Promise.allSettled`, persiste em `geo_overlap_reports` — migration aplicada em prod via Management API), página `/dashboard/sobreposicao` (mapa Leaflet, badges de severidade, leitura jurídica, painel de fontes, export PDF), botão "Sobreposições" no card da propriedade no Radar. Deps novas: @turf/*, leaflet/react-leaflet.
- **🔴 3 bugs de integração achados AO VIVO (e por isso o teste ao vivo é regra)**: (1) o ArcGIS do PAMGIA **rejeita espaço como `+`** (padrão URLSearchParams) — exige `%20`, senão "Failed to execute query"; (2) `outFields` com UM campo inexistente **derruba a query inteira** (usar só campos confirmados no metadata, ou `*`); (3) o geoserver da FUNAI **rejeita WFS 2.0 sem sortBy** ("Cannot do natural order without a primary key") — usar WFS 1.0.0 (bbox lon,lat).
- **Prova ao vivo (CAR real de Couto Magalhães/TO)**: 5/5 fontes consultadas, ~2s, relatório persistido — e o primeiro teste já revelou **caso real de CAR vizinho sobrepondo 99,82% do imóvel** (possível CAR duplicado/conflito dominial pleno; multipartes do mesmo vizinho agregadas num único achado; regra nova: vizinho >50% → severidade 'alta'). UI verificada autenticada no preview: mapa renderiza, 3 badges, leitura jurídica presente, zero erro de console.
- **⚠️ Revisão jurídica pendente (gate de qualidade)**: os textos de `overlapLegalReading.ts` foram redigidos pelo agente e DEVEM ser revisados pelo usuário (advogado) — mérito jurídico é dele.
- **Validação**: `tsc` 0, `lint` 0 erros, `jest` **772** (+13), `build` OK (rotas novas presentes). Deploy **EFETUADO**; `/dashboard/sobreposicao` → 307 (gated OK).
- **Próximo (aposta 2, já autorizada)**: "Dossiê de Conformidade CMN 5.193" por operação de crédito — REUSA sobreposição + módulo ambiental + motores de elegibilidade/defesa; decisões de escopo em aberto com o usuário.
