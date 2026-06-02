# PROJECT_CONTEXT_AGROLEX.md

## 1. Identidade do Projeto

O projeto se chama **AgroLex**.

O posicionamento atual é:

**AgroLex Forense — Auditoria Fundiária Inteligente**

O AgroLex é uma plataforma de inteligência fundiária, jurídica e forense para análise de imóveis rurais.

O sistema deve ajudar:

- advogados agraristas;
- advogados imobiliários;
- advogados de regularização fundiária;
- produtores rurais;
- corretores de imóveis rurais;
- consultores fundiários;
- profissionais de georreferenciamento;
- profissionais que atuam com regularização, compra, venda ou judicialização de imóveis rurais.

O sistema analisa:

- matrícula;
- cadeia dominial;
- títulos do INCRA;
- cláusulas resolutivas;
- CAR;
- SIGEF;
- CCIR;
- ITR;
- georreferenciamento;
- documentos ausentes;
- riscos registrais;
- indícios de grilagem;
- nulidades;
- processos, ônus e restrições;
- risco dominial;
- risco cartorial;
- risco processual;
- recomendações jurídicas e documentais.

## 2. O que o AgroLex NÃO deve parecer

Nas rotas principais, o AgroLex NÃO deve parecer:

- plataforma ESG;
- plataforma de carbono;
- plataforma EUDR;
- sistema de CPR Verde;
- sistema de crédito de carbono;
- trade verde;
- rastreabilidade de grãos;
- plataforma de fornecedores;
- auditor de carteiras B2B;
- dashboard de compliance socioambiental genérico.

## 3. Termos proibidos nas rotas principais

Não renderizar nas rotas principais:

- Agrilex;
- Agrilex Enterprise Dashboard;
- Enterprise Dashboard;
- Auditor de Carteiras B2B;
- Auditoria de Carteiras de Fornecedores;
- fornecedores;
- Importar Lote de Fornecedores;
- Perfil Geral de Risco de Compliance;
- compliance socioambiental;
- rastreabilidade;
- ESG;
- Score ESG;
- Média Score ESG;
- carbono;
- Carbono Estimado;
- crédito de carbono;
- CPR Verde;
- EUDR;
- Passaporte EUDR;
- Anti-Triangulação de Grãos;
- Sala de Situação Agro-Ambiental;
- ROI ambiental;
- monetização ambiental;
- Créditos B2B;
- Painl Forense;
- Matriculas sem acento;
- geo-referenciamento com hífen.

## 4. Termos corretos

Usar:

- AgroLex;
- AgroLex Forense;
- AgroLex Inteligência Fundiária;
- Painel AgroLex Forense;
- Auditoria Fundiária Inteligente;
- Dossiê Forense AgroLex;
- Matrículas;
- georreferenciamento;
- Forensic Score;
- Grilagem Score;
- Robustez Documental;
- Risco INCRA;
- Risco Dominial;
- Risco Registral;
- Risco Processual;
- Cadeia Dominial Profunda;
- INCRA Deep Check;
- SIGEF / Geospatial Cross Check;
- Documentos Ausentes Inteligentes;
- Parecer Estratégico;
- Data Room Forense.

## 5. Rotas principais

- `/`
- `/plans`
- `/checkout?plan=premium`
- `/report/mock-sprint-45-agrolex`
- `/dashboard`
- `/login`

URL pública principal:

https://agrolex-ia-qx32.vercel.app

Dashboard:

https://agrolex-ia-qx32.vercel.app/dashboard

Dossiê exemplo:

https://agrolex-ia-qx32.vercel.app/report/mock-sprint-45-agrolex

Planos:

https://agrolex-ia-qx32.vercel.app/plans

Checkout premium:

https://agrolex-ia-qx32.vercel.app/checkout?plan=premium

## 6. Landing Page

A landing deve vender:

**Auditoria Fundiária Inteligente**

Mensagem principal:

“Analise matrículas, cadeia dominial, títulos do INCRA, riscos registrais, possíveis nulidades, indícios de grilagem e inconsistências documentais antes de comprar, vender, regularizar ou judicializar uma área rural.”

CTAs:

- Solicitar Auditoria Gratuita;
- Ver Exemplo de Dossiê.

## 7. Página de Planos

Planos principais:

- Dossiê Básico — R$ 497 — 20 créditos;
- Dossiê Profissional — R$ 997 — 40 créditos;
- Dossiê Forense Premium — R$ 2.497 — 100 créditos;
- Escritório Starter — R$ 497/mês;
- Escritório Pro — R$ 997/mês;
- Escritório Premium — R$ 1.997/mês;
- Enterprise — sob consulta.

## 8. Checkout

A rota `/checkout?plan=premium` deve mostrar:

- Dossiê Forense Premium;
- R$ 2.497;
- 100 créditos.

Não pode cair no fallback “Dossiê Básico” quando o parâmetro for `premium`.

## 9. Dossiê Exemplo

A rota `/report/mock-sprint-45-agrolex` deve exibir um exemplo fictício e realista com dados da Fazenda Santa Aurora, etc., e conter aviso de demonstração.

## 10. Dashboard Principal

A rota `/dashboard` deve ser exclusivamente o **Painel AgroLex Forense** com todas as seções descritas e terminar no CTA “Precisa analisar um imóvel rural real?”.

## 11. Módulo Carteira B2B

Se existir `/dashboard/carteira` pode permanecer, mas não deve ser renderizado em `/dashboard`.

## 12. Sprint 6 — Inteligência Fundiária Profunda

Camadas avançadas devem aparecer no dossiê e no dashboard.

## 13. Regras obrigatórias de escopo

Seguir leitura de arquivos, evitar refatorações fora do escopo, etc.

## 14. Validação obrigatória

Rodar build, lint, testes e validar URL pública.

## 15. Regra específica do Dashboard

Confirmar ausência de termos proibidos e presença dos corretos.

## 16. Regra de atualização deste contexto

Atualizar o histórico resumido ao final de cada tarefa.

## 17. Regra de resposta final do agente

Entregar informações de arquivos alterados, resultados e pendências.

- **Data**: 31/05/2026
- **Tarefa**: Extração local de texto dos documentos e enriquecimento dos prompts
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `package.json`, `PROJECT_CONTEXT_AGROLEX.md`
- **Comportamento implementado**:
  - Instalada a biblioteca `pdfjs-dist` e configurado o carregamento dinâmico e worker assíncrono via CDN no navegador.
  - Implementada a função `extractTextFromPdf` para ler PDFs anexados de forma local no front-end, limitando o processamento a 12 páginas.
  - Adicionado o botão "Extrair Texto dos Documentos" com tratamento visual de estados (Pendente, Extraindo, Texto Extraído, Não Suportado, Falha / Imagem).
  - Criada a seção "Textos Extraídos dos Documentos" exibindo prévias dos textos (limite de 800 caracteres) e botão para cópia individual.
  - Atualizados os prompts do NotebookLM e Claude para incluir os trechos extraídos (limite de 10.000 caracteres por arquivo).
  - Aprimorado o checklist de documentos para marcar itens como `[Possivelmente recebido ✓]` escaneando tanto o nome do arquivo quanto os textos extraídos.
- **Status build/lint/test**: Build Next.js, ESLint e todos os 45 testes passaram com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via Vercel.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Limitações conhecidas**: A extração local funciona apenas para arquivos PDF que possuem camada de texto digitalizada (selecionável). Documentos escaneados como imagem pura (sem OCR) falharão na extração de texto.
- **Pendências futuras**:
  - Implementar OCR para PDFs escaneados, storage real dos documentos, extração estruturada de campos e geração automática do Dossiê Forense.

- **Data**: 01/06/2026
- **Tarefa**: Criação da Biblioteca de Prompts AgroLex em camadas e substituição de placeholders
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`
- **Comportamento implementado**:
  - Criada a seção "Biblioteca de Prompts AgroLex" abaixo da seção de Análise Assistida.
  - Adicionados 10 botões para geração de prompts em camadas estruturadas (Camadas 1 a 8, Parecer Técnico Final no NotebookLM, e Prompt Claude).
  - Prompts incorporam dados preenchidos no formulário (imóvel, município/uf, matrícula, área, observações, lista de arquivos e textos extraídos localmente).
  - Substituídos os placeholders genéricos das 8 camadas, do Parecer Final do NotebookLM e do Dossiê Claude por instruções de prompts operacionais e profundos reais, estruturados sob as regras de anti-superficialidade e precisão registral/geodésica.
  - Mantidas as funções de copiar prompt e baixar .txt para o prompt de camada atualmente ativo.
- **Status build/lint/test**: Build, Lint e testes aprovados com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via Vercel.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Pendências futuras**:
  - Criar editor administrativo para manutenção dos prompts em camadas sem necessidade de alterar código.

- **Data**: 01/06/2026
- **Tarefa**: Rollback controlado total até o fim do Sprint 2
- **Motivo**: Estabilização do AgroLex para reimplantar sprint por sprint
- **Branch de backup criada**: `backup-agrolex-antes-rollback-sprint2`
- **Arquivos restaurados/alterados**: `src/app/dashboard/page.tsx`, `package.json`, `package-lock.json`, `tsconfig.json`
- **Funcionalidades preservadas**: Landing page, planos, checkout, dossiê exemplo, dashboard estável visualmente com KPIs, ações rápidas, central de auditorias, inteligência fundiária, nova auditoria fundiária, e prompts de análise assistida/biblioteca em camadas.
- **Funcionalidades removidas/desativadas**: Extração local de texto dos documentos via `pdfjs-dist`, preview de textos extraídos na UI, e rotas dinâmicas experimentais de auditorias (movidas para quarentena).
- **Resultado build/lint/test**: Next.js build, ESLint e 45 testes aprovados com 100% de sucesso.
- **Deploy**: Realizado com sucesso via Vercel.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Data**: 01/06/2026
- **Tarefa**: Rollback total do AgroLex para o estado imediatamente anterior a todos os sprints (V4.2 / commit 4a22124)
- **Motivo**: Estabilização absoluta e restauração das telas, layouts e dependências pré-sprints
- **Arquivos restaurados/alterados**: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/planos/page.tsx`, `src/app/dashboard/cofre/page.tsx`, `src/app/dashboard/nova-analise/page.tsx`, `src/app/dashboard/radar/page.tsx`, `src/app/dashboard/resultado/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/api/analyze/route.ts`, `src/app/api/webhook/mercadopago/route.ts`, `src/app/cofre/view/[id]/page.tsx`, `src/lib/supabase.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Funcionalidades restauradas**: Landing page com CTA inicial, painel do dashboard pré-sprints (sem as abas ou KPIs extras de fornecedores, ESG, créditos B2B ou EUDR), fluxo de nova análise mockado em localStorage, planos, checkout e cofre simplificado.
- **Resultado build/lint**: Build Next.js e ESLint aprovados com 100% de sucesso.
- **Deploy**: Efetuado com sucesso via Vercel Production.
- **URL validada**: https://agrolex-ia-qx32.vercel.app/dashboard
- **Pendências**: Homologação do usuário e planejamento controlado de reimplantação.

- **Data**: 02/06/2026
- **Tarefa**: Bloco 2.1 — Restaurar Dashboard Mínimo Confiável Sem Mocks ou Overrides
- **Arquivos alterados**: `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Removidos completamente os dados mockados da tabela e cards do Dashboard (Fazenda Boa Esperança, Sítio Alvorada).
  - Implementada a busca de análises reais do Supabase, incluindo os dados em `findings` para validação do parecer.
  - Implementadas regras estritas de normalização e exibição de status: pending/payment_pending como "Pendente", processing/analisando como "Analisando", completed/done/concluido como "Concluído", e error/failed como "Falha".
  - Implementadas regras seguras para o botão "Ver Parecer": somente é exibido se o status for concluído e existir `findings.resumo` não vazio. Caso seja concluído mas sem o resumo, exibe "Anomalia: parecer não localizado".
  - Removido qualquer override visual de simulação que marcava status temporários como concluídos.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Commit**: `feat: restore reliable dashboard summary` na branch `stable/rebuild-beta-01-laudo-compartilhavel`.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada localmente**: `/dashboard`
- **Próximos Passos Recomendados**: Bloco 3 — Restauração controlada do formulário de Nova Análise com as novas validações.

- **Data**: 02/06/2026
- **Tarefa**: Bloco 3 — Restaurar Laudo Privado e Exportação PDF
- **Arquivos alterados**: `src/app/dashboard/resultado/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Reconstruído o controle de renderização e estado de `ResultadoContent` buscando dados reais e exigindo autenticação do usuário.
  - Removido completamente qualquer uso de `mockResponses`, fallbacks de propriedade fixa ou simulação.
  - Implementada restrição estrita de exibição do laudo: somente renderiza se a análise estiver com status do tipo `completed` E contiver `findings.resumo` preenchido.
  - Tratados devidamente os estados de erro/falha (exibindo "Parecer técnico indisponível"), processamento ("Análise em processamento") e ausência de ID/registro ("Parecer não encontrado").
  - Corrigida a marca visual para usar estritamente "AgroLex" nos elementos de navegação e cabeçalho de impressão.
  - Preservado o botão de exportação via `window.print()` e a estilização de impressão em PDF.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada localmente**: `/dashboard/resultado`
- **Próximos Passos Recomendados**: Bloco 4 — Restauração controlada do fluxo de Nova Análise.
