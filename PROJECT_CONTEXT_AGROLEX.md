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

- **Data**: 02/06/2026
- **Tarefa**: Bloco 4 — Restaurar Formulário de Nova Análise com Upload Real e Registros Reais
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Ajustado o formulário de Nova Análise para envio de dados reais com seleção múltipla de focos/módulos de auditoria e cálculo de preço estimado.
  - O upload de múltiplos documentos em PDF foi re-homologado e direcionado para o Supabase Storage real (bucket `documents`) sob o contexto da conta do usuário autenticado.
  - A criação de novos registros no banco de dados para `properties`, `documents` e `analyses` foi totalmente integrada baseada em dados reais enviados.
  - Implementada a marcação inicial segura de status para a análise criada como `payment_pending`.
  - Normalizado o nome da marca para usar estritamente "AgroLex" na navegação e nos formulários.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada locais**: `/dashboard/nova-analise`
- **Próximos Passos Recomendados**: Bloco 5 — Restauração controlada do processamento de laudos via IA em background.

- **Data**: 02/06/2026
- **Tarefa**: Bloco 4.1 — Desacoplar Nova Análise de Checkout, Crédito e Processing
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
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

- **Data**: 02/06/2026
- **Tarefa**: Bloco 4 — Restaurar Formulário de Nova Análise com Upload Real e Registros Reais
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Ajustado o formulário de Nova Análise para envio de dados reais com seleção múltipla de focos/módulos de auditoria e cálculo de preço estimado.
  - O upload de múltiplos documentos em PDF foi re-homologado e direcionado para o Supabase Storage real (bucket `documents`) sob o contexto da conta do usuário autenticado.
  - A criação de novos registros no banco de dados para `properties`, `documents` e `analyses` foi totalmente integrada baseada em dados reais enviados.
  - Implementada a marcação inicial segura de status para a análise criada como `payment_pending`.
  - Normalizado o nome da marca para usar estritamente "AgroLex" na navegação e nos formulários.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada locais**: `/dashboard/nova-analise`
- **Próximos Passos Recomendados**: Bloco 5 — Restauração controlada do processamento de laudos via IA em background.

- **Data**: 02/06/2026
- **Tarefa**: Bloco 4.1 — Desacoplar Nova Análise de Checkout, Crédito e Processing
- **Arquivos alterados**: `src/app/dashboard/nova-analise/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Transformada a página `/dashboard/nova-analise` em fluxo puro de intake, sem opções de pagamento (Pix, Cartão, Crédito) ou botão de iniciar parecer/IA.
  - Removidas as referências de estado obsoletas (`paymentMethod`, `paymentStatus`, `userCredits`, `handleStartAnalysis`, `isAnalyzing`).
  - Adicionada mensagem informativa indicando que a análise foi criada como pendente e a liberação de processamento será restaurada em bloco posterior.
  - Mantidas a criação de propriedade, documentos e análise com status inicial `payment_pending` e findings estruturados.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada localmente**: `/dashboard/nova-analise`
- **Pendências**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5).

- **Data**: 02/06/2026
- **Tarefa**: Bloco 5 — Liberação Controlada para Processamento Sem Iniciar IA
- **Arquivos alterados**: `src/app/api/checkout/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Refatorada a rota POST `/api/checkout` para atuar como endpoint de liberação de análise simulado, removendo a integração com Mercado Pago Preference API.
  - Implementada validação robusta no backend: autenticação da sessão, propriedade da análise (`user_id`), status atual (`payment_pending` ou `pending`) e presença de módulos de auditoria selecionados (`findings.selected_modules`).
  - Atualização do status para `ready_for_processing` e realização do merge dos metadados de simulação (`payment_mode`, `payment_status`, `current_step`, `ready_for_processing_at`) em `findings` sem sobrescrever outras chaves.
  - Adicionado botão "Liberar processamento" no dashboard para análises pendentes, chamando `/api/checkout` e atualizando o status visual para "Liberada" ("Aguardando início da IA") após a conclusão com sucesso.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada localmente**: `/dashboard`
- **Pendências**: Restabelecer o processamento de laudos via IA em background de forma controlada (Bloco 5 - execução da IA).

- **Data**: 02/06/2026
- **Tarefa**: Bloco 6 — Restaurar Processamento IA Seguro: ready_for_processing -> processing -> completed/error
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Refatorada a rota POST `/api/analyze` para processamento síncrono controlado (removendo `waitUntil` e retornos assíncronos antecipados).
  - Implementada validação robusta antes do início da análise (autenticação de sessão, propriedade da análise, status do tipo `ready_for_processing` e verificação de documentos).
  - Configurados timeouts explícitos de download (10s por arquivo) e chamada global da IA (35s) usando promessas competitivas com `AbortController` e rejeição de timeout.
  - Adicionado tratamento de erro para persistir status `error` no banco de dados e retornar resposta adequada no caso de falhas ou timeouts.
  - Adicionado botão "Iniciar parecer" no dashboard para análises no estado "Liberada", redirecionando o usuário para o laudo pericial após a conclusão com sucesso.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados with 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada localmente**: `/dashboard`
- **Pendências**: Homologação geral do fluxo completo.

- **Data**: 02/06/2026
- **Tarefa**: Hotfix — Corrigir modelo Gemini e não expor erro técnico no alert
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`, `PROJECT_CONTEXT_AGROLEX.md`, `AGENTS.md`
- **Comportamento implementado**:
  - Removido modelo hardcoded da rota `/api/analyze` e adicionada leitura dinâmica de `process.env.GEMINI_MODEL` com fallback seguro para `gemini-3.5-flash`.
  - Corrigido o retorno de erro da API `/api/analyze` para enviar ao frontend apenas a mensagem de erro segura ao invés do erro técnico bruto da Google.
  - Ajustado o alert/catch no dashboard para exibir apenas a mensagem amigável sem expor segredos, nomes técnicos de modelo ou URLs de conexão.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco).
- **URL validada localmente**: `/dashboard`
- **Pendências**: Homologação geral em ambiente real de produção.

- **Data**: 02/06/2026
- **Tarefa**: Bloco 7.3.5 — Corrigir Cálculo de Preço dos Módulos e Exclusividade do Cruzamento Total
- **Arquivos alterados**: `src/lib/auditModules.ts`, `src/app/dashboard/nova-analise/page.tsx`
- **Comportamento implementado**:
  1. Criada função central `calculateAuditModulesTotal(selectedModules)` em auditModules.ts que encapsula a regra de cálculo de preço.
  2. Removido teto automático geral de R$ 499,90; módulos individuais agora são somados integralmente.
  3. R$ 499,90 é agora preço exclusivo do módulo `cruzamento_total` (não teto geral).
  4. Implementada exclusividade do `cruzamento_total` em `toggleModule()`: ao selecionar `cruzamento_total`, desseleciona todos os outros módulos; ao selecionar outro módulo enquanto `cruzamento_total` ativo, remove automaticamente `cruzamento_total`.
  5. Atualizado `selectAll()` para nunca selecionar `cruzamento_total` automaticamente (pacote exclusivo deve ser selecionado manualmente).
- **Exemplos validados**: 
  - `["matricula_individual"]` = R$ 99,90
  - `["matricula_individual", "cadeia_dominial", "origem_publica", "nulidades_fraudes"]` = R$ 749,60
  - `["cruzamento_total"]` = R$ 499,90
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco; aguardando autorização explícita do usuário).
- **URL validada localmente**: `/dashboard/nova-analise`
- **Pendências**: Teste manual recomendado (validar seleção de múltiplos módulos com preço R$ 749,60 e exclusividade de `cruzamento_total`).

- **Data**: 02/06/2026
- **Tarefa**: Bloco 7.3.5.1 — Preço Server-side como Fonte da Verdade
- **Arquivos alterados**: `src/app/api/checkout/route.ts`
- **Comportamento implementado**:
  1. Importação de `calculateAuditModulesTotal` e `MODULE_PRICES` de auditModules.ts na rota `/api/checkout`.
  2. Validação robusta: cada módulo selecionado em `findings.selected_modules` é verificado contra `MODULE_PRICES` para garantir existência e preço válido.
  3. Recálculo obrigatório do preço no servidor: `serverEstimatedTotal = calculateAuditModulesTotal(selectedModules)`.
  4. Captura do preço enviado pelo cliente (se existir) em `clientEstimatedTotal` para auditoria e comparação.
  5. Salvamento em `findings`: `estimated_total` (valor do servidor), `client_estimated_total` (valor do cliente), `price_source: "server"` e `price_checked_at` (timestamp ISO).
  6. Resposta JSON agora inclui `serverEstimatedTotal` e `clientEstimatedTotal` para o frontend validar e auditar.
- **Exemplos validados**: 
  - `["matricula_individual"]` = R$ 99,90
  - `["matricula_individual", "cadeia_dominial", "origem_publica", "nulidades_fraudes"]` = R$ 749,60
  - `["cruzamento_total"]` = R$ 499,90
- **Segurança**: O frontend pode enviar qualquer `estimated_total`; o servidor a ignora e sempre recalcula a verdade baseada em `selected_modules`. Preço de pagamento é sempre `serverEstimatedTotal`.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme orientações de governança do bloco; aguardando autorização explícita do usuário).
- **URL validada localmente**: `/api/checkout` (rota POST)
- **Pendências**: Teste manual recomendado (validar que backend recalcula mesmo que frontend envie `estimated_total` incorreto).

- **Data**: 03/06/2026
- **Tarefa**: Bloco 8.2.2 — Limitar Loop Infinito de Retry por Timeout da IA
- **Arquivos alterados**: `src/app/api/analyze/route.ts`, `src/app/dashboard/page.tsx`
- **Comportamento implementado**:
  - Adicionado limite máximo de 3 tentativas para erros de timeout da IA (`ai_timeout`).
  - No backend, se `retry_count >= 3` para `ai_timeout`, os campos `retry_available` é setado como `false`, `retry_exhausted` como `true`, e `retry_reason` como `"max_ai_timeout_attempts"`. A mensagem de erro em `current_step` é alterada para alertar que exige processamento em etapas.
  - No frontend, a renderização do dashboard oculta o botão "Tentar novamente" se `findings.retry_exhausted === true` e exibe o badge "Exige processamento em etapas" com uma descrição amigável correspondente.
- **Resultado build/lint**: Build Next.js (`npm run build`), ESLint (`npm run lint`), e TypeScript (`npx tsc --noEmit`) aprovados com 100% de sucesso.
- **Deploy**: Não efetuado (conforme governança do bloco; sem deploy automático).
- **URL validada localmente**: `/dashboard` e `/api/analyze`
- **Pendências**: Homologação final do controle de loop de retry.
