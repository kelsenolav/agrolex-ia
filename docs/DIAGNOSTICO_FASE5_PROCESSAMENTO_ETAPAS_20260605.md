# Diagnóstico Técnico — FASE 5: Processamento em Etapas (Anti-Timeout)

**Data:** 05/06/2026  
**Status:** Diagnóstico — Nenhum arquivo alterado  
**Branch:** `stable/rebuild-beta-01-laudo-compartilhavel`  
**Commit base:** `e2e24022ed2f3b90ebf8550f229dde14068ea863`

---

## 1. Como o timeout é tratado hoje

### 1.1 Camada Vercel (`maxDuration`)

- **Arquivo:** `src/app/api/analyze/route.ts`, linha 10
- **Valor:** `export const maxDuration = 120;` (120 segundos)
- **Efeito:** Se a função POST exceder 120s, a Vercel mata a execução com `FUNCTION_INVOCATION_TIMEOUT`. Nenhum catch no código consegue capturar esse evento — a resposta HTTP é um 504 entregue pela infraestrutura, e o banco de dados **não** é atualizado com status de erro (a análise permanece `processing` indefinidamente).

### 1.2 Camada de download de documentos

- **Arquivo:** `src/app/api/analyze/route.ts`, linhas 477-481
- **Mecanismo:** `withTimeout(downloadPromise, 10000, 'download_...')` — 10 segundos por arquivo
- **Comportamento:** Se o download de qualquer arquivo exceder 10s, lança exceção com mensagem contendo `"Timeout: download_..."`. Essa exceção NÃO é capturada como `ai_timeout` porque a string contém `"Timeout:"` — é tratada no catch interno (linhas 801+), mas a mensagem `rawMessage.toLowerCase()` contém `"timeout:"` → é classificada como `ai_timeout` com `retry_available`.

### 1.3 Camada Gemini (chamada à IA)

- **Arquivo:** `src/app/api/analyze/route.ts`, linhas 561-574
- **Mecanismo:** `withTimeout(aiPromise, aiTimeoutMs, "gemini_generation")`
- **Timeout adaptativo:**
  - Documentos comuns: **90 segundos** (linha 573)
  - Documentos densos: **110 segundos** (linha 573)
- **Problema crítico:** A soma dos tempos (downloads + timeout da IA) pode exceder 120s da Vercel. Exemplo: 5 arquivos × 10s = 50s + 110s da IA = 160s > 120s → `FUNCTION_INVOCATION_TIMEOUT`.

### 1.4 Detecção de timeout no catch

- **Arquivo:** `src/app/api/analyze/route.ts`, linha 806
- **Lógica:** `const isTimeout = messageLower.includes("timeout:");`
- **Classificação:** Se `isTimeout` → `technicalErrorType = 'ai_timeout'`
- **Problema:** Só funciona para timeouts capturáveis (Promise.race). O timeout da Vercel (`maxDuration`) NÃO é capturável — mata o processo antes de qualquer catch.

---

## 2. Onde a lógica de retry está

### 2.1 Backend — Funções auxiliares

| Função | Localização (route.ts) | Propósito |
|---|---|---|
| `isRecoverableErrorType()` | Linha 33-35 | Valida se o tipo de erro é recuperável (`ai_timeout`, `ai_unavailable`, `ai_incomplete_response`) |
| `getRecoverableRetryReason()` | Linhas 37-52 | Varre `findings` em busca do motivo do último erro recuperável |
| `getRetryCount()` | Linhas 54-67 | Extrai contagem de retries de `retry_state` ou `case_file.retry_state` |
| `buildRetryState()` | Linhas 69-77 | Constrói novo estado de retry incrementando contagem |

### 2.2 Backend — Validação de status antes de processar

- **Arquivo:** `src/app/api/analyze/route.ts`, linhas 346-366
- **Fluxo:**
  1. Verifica se status atual é `processing` → retorna 409
  2. Verifica se é retry recuperável: `currentStatus === 'error'` E (`retry_available === true` OU tem `retryReason` OU `forceRetry === true` com `retry_exhausted`)
  3. Se não for `ready_for_processing` nem retry recuperável → retorna 400

### 2.3 Backend — Limite de retries e esgotamento

- **Arquivo:** `src/app/api/analyze/route.ts`, linhas 842-878
- **Limite:** `currentRetryCount >= 5` para `ai_timeout` → `retry_exhausted = true`, `retry_available = false`
- **Estado salvo:**
  ```json
  {
    "retry_state": {
      "available": false,
      "exhausted": true,
      "reason": "max_ai_timeout_attempts",
      "retry_count": 5
    }
  }
  ```
- **Mensagem ao usuário:** "Esta análise exige processamento em etapas."

### 2.4 Frontend — Dashboard

- **Arquivo:** `src/app/dashboard/page.tsx`
- **`isRecoverableAnalysisError()`** (linhas 145-153): Determina se mostra botão "Tentar novamente"
- **`getRetryMessage()`** (linhas 156-168): Mensagem contextual por tipo de erro
- **`handleStartAnalysis()`** (linhas 190-229): Envia `forceRetry: true` no body quando `retry_exhausted`
- **Renderização condicional** (linhas 465-536):
  - Se `retry_exhausted === true` → mostra upsell de etapas com 4 módulos fixos (R$ 99,90 a R$ 249,90), cada um com botão "Comprar"
  - Se `canRetryAnalysis` → mostra botão "Tentar novamente"
  - Se nenhum dos dois → mostra "Falha / Reprocessamento necessário"

### 2.5 Frontend — Resultado (polling)

- **Arquivo:** `src/app/dashboard/resultado/page.tsx`, linhas 68-93
- **Polling:** 30 tentativas × 4s = máximo 120s de espera no frontend
- **Sem relação com retry:** Este polling é apenas para aguardar status mudar de `processing` para outro estado

---

## 3. Onde existe detecção de documento denso

### 3.1 Única detecção existente

- **Arquivo:** `src/app/api/analyze/route.ts`, linhas 563-565
- **Critérios:**
  ```typescript
  const pdfPartsCount = geminiParts.filter(p => p.inlineData?.mimeType === 'application/pdf').length;
  const isDenseDocument = pdfPartsCount >= 3 || geminiParts.length > 12;
  ```
- **Impacto:**
  1. Timeout da IA: 110s (vs 90s para docs simples) — linha 573
  2. Sufixo de concisão adicionado ao prompt (limite de 2.000 palavras) — linhas 539-541

### 3.2 Limitações da detecção atual

- **Não considera** o tamanho real dos PDFs (apenas quantidade de parts)
- **Não considera** se os PDFs são matriciais (escaneados) ou textuais — PDFs escaneados produzem payloads muito maiores em base64
- **Não detecta** volume de páginas por documento
- **Não persiste** a flag de densidade para uso em retries ou etapas
- A detecção só existe **dentro do bloco de processamento síncrono** — não há pré-análise antes de iniciar o processamento

---

## 4. Melhor arquitetura para processamento em etapas

### 4.1 Problema central

O modelo atual é **monolítico e síncrono**: todos os módulos selecionados são processados em uma única chamada Gemini com um único prompt. Se o timeout estourar (seja da Vercel aos 120s, seja do Gemini aos 90-110s), a análise inteira falha.

### 4.2 Arquitetura proposta: Processamento Fatiado por Módulo

```
┌─────────────────────────────────────────────────────────────┐
│                  ETAPA 1: Pré-Análise                        │
│  • Avaliar quantidade/tamanho dos PDFs                       │
│  • Determinar se excede limite de processamento único        │
│  • Se sim → fragmentar em N etapas independentes             │
│  • Persistir plano de etapas no findings                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           ETAPA 2: Processamento por Módulo                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Módulo 1    │  │ Módulo 2    │  │ Módulo N    │          │
│  │ matricula   │  │ cadeia      │  │ nulidades   │          │
│  │ individual  │  │ dominial    │  │ fraudes     │          │
│  │             │  │             │  │             │          │
│  │ Chamada     │  │ Chamada     │  │ Chamada     │          │
│  │ Gemini #1   │  │ Gemini #2   │  │ Gemini #N   │          │
│  │ (30-60s)    │  │ (30-60s)    │  │ (30-60s)    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│         Cada etapa: POST /api/analyze/step                   │
│         Status: processing_step → step_completed             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           ETAPA 3: Consolidação (Síntese Final)              │
│  • Juntar resultados de todos os módulos                     │
│  • Gerar resumo consolidado, risk_level, recomendações       │
│  • Montar laudo final unificado                              │
│  • Status: completed                                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Modelo de dados para etapas

```typescript
// Novo campo em findings
interface StepPlan {
  enabled: boolean;
  total_steps: number;
  current_step_index: number;
  steps: Array<{
    index: number;
    module_id: string;
    module_label: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    started_at?: string;
    completed_at?: string;
    result_summary?: string;
    error_type?: string;
    retry_count?: number;
  }>;
  consolidation_status: 'pending' | 'processing' | 'completed' | 'error';
}

// Estados de status da análise
type AnalysisStatus = 
  | 'payment_pending'
  | 'ready_for_processing'
  | 'processing'           // etapas em andamento
  | 'processing_step'      // uma etapa específica em andamento
  | 'consolidating'        // unificação dos resultados
  | 'completed'
  | 'error';
```

### 4.4 API Design

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/analyze` | POST | Mantido para modo simples (legado). Detecta densidade e decide rota. |
| `/api/analyze/plan` | POST | **Novo.** Avalia documentos, calcula etapas necessárias, persiste `step_plan`. |
| `/api/analyze/step` | POST | **Novo.** Processa uma etapa individual (um módulo). Recebe `analysisId` + `stepIndex`. |
| `/api/analyze/consolidate` | POST | **Novo.** Junta resultados de todas as etapas, gera laudo final. |

### 4.5 Fluxo de chamada do frontend

1. Usuário clica "Iniciar parecer" → `POST /api/analyze/plan`
2. Backend avalia documentos, decide se processamento único ou etapas
3. Se etapas:
   - Responde com `{ mode: 'stepped', total_steps: 4, steps: [...] }`
   - Frontend mostra progresso: "Etapa 1 de 4: Analisando Matrícula Individual..."
   - Loop sequencial: `POST /api/analyze/step` para cada etapa
   - Após última etapa: `POST /api/analyze/consolidate`
4. Se processamento único (documentos leves):
   - Comportamento atual mantido como fallback

### 4.6 Vantagens desta arquitetura

| Vantagem | Descrição |
|---|---|
| **Cada chamada Gemini < 60s** | Um módulo por vez com prompt enxuto reduz tempo de resposta da IA |
| **Resiliência granular** | Se uma etapa falhar, as outras continuam independentes |
| **Retry por etapa** | Apenas a etapa com falha é reprocessada, sem repetir módulos já concluídos |
| **Progresso visível** | Usuário vê avanço incremental (1/4, 2/4...) em vez de spinner indefinido |
| **Timeout da Vercel seguro** | Cada POST `/api/analyze/step` tem seu próprio `maxDuration` de 60s |
| **Reutiliza FASE 3** | `module_results` já existe no `case_file` — cada etapa popula seu resultado |
| **Fallback mantido** | Documentos simples (< 3 PDFs, < 12 parts) continuam no fluxo monolítico atual |

### 4.7 Estratégia de fragmentação

| Cenário | Ação |
|---|---|
| 1-2 PDFs, ≤6 parts | Processamento único (modo atual) |
| 3+ PDFs OU >12 parts | Fragmentar: 1 módulo por etapa |
| `cruzamento_total` selecionado | Sempre fragmentar (é o módulo mais pesado) |
| Retry esgotado (`retry_exhausted`) | Forçar fragmentação, ignorar modo único |
| `forceRetry` com `retry_exhausted` | Ativar `step_plan` e processar etapa por etapa |

---

## 5. Arquivos que precisarão ser alterados

### 5.1 Alterações obrigatórias (core da FASE 5)

| Arquivo | Tipo de alteração | Complexidade |
|---|---|---|
| `src/app/api/analyze/route.ts` | **Refatoração pesada.** Extrair lógica de chamada Gemini para função reutilizável. Adicionar endpoints `/plan`, `/step`, `/consolidate` ou adaptar POST existente com parâmetro `mode`. Adicionar lógica de fragmentação. | **Alta** |
| `src/app/dashboard/page.tsx` | Adicionar polling/SSE para progresso das etapas. Atualizar `handleStartAnalysis` para orquestrar etapas sequenciais. Atualizar UI para mostrar progresso (barra de etapas). | **Média** |
| `src/app/dashboard/resultado/page.tsx` | Adaptar polling para aguardar consolidação (novo status `consolidating`). | **Baixa** |
| `src/lib/caseFile.ts` | Adicionar tipo `StepPlan` e `CaseFileStepResult`. Atualizar interface `CaseFile` com campo `step_plan`. | **Baixa** |
| `src/types/analise.ts` | Adicionar tipos `StepPlan`, `StepInfo`, novos status. | **Baixa** |

### 5.2 Alterações recomendadas (qualidade e UX)

| Arquivo | Tipo de alteração | Complexidade |
|---|---|---|
| `src/lib/auditModules.ts` | Adicionar função `estimateDocumentComplexity(documents)` para pré-avaliação. | **Baixa** |
| `src/lib/auditPromptBuilder.ts` | Criar variante `buildSingleModulePrompt(moduleId, documents)` para prompts por módulo. | **Média** |
| `src/app/globals.css` | Estilos para barra de progresso de etapas. | **Baixa** |

### 5.3 NÃO alterar (fora de escopo)

- `src/app/api/checkout/route.ts` — pagamento (FASE 4)
- `src/app/api/webhook/mercadopago/route.ts` — webhook (FASE 4)
- `src/app/dashboard/nova-analise/page.tsx` — intake
- `src/lib/supabase.ts` / `src/lib/supabaseAdmin.ts` — infra
- Migrations do Supabase — sem alterações de schema necessárias (step_plan vai em `findings` JSONB)
- `src/lib/payments/mercadopago.ts` — FASE 4

---

## 6. Riscos

### 6.1 Riscos técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Timeout da Vercel (120s) nas etapas** | Média | Alto | Cada etapa individual deve ter `maxDuration` de 60-90s. Se uma etapa ainda estourar, fragmentar ainda mais (sub-etapas). |
| **Custo Gemini multiplicado** | Alta | Médio | N chamadas separadas = N × tokens de entrada (PDFs reenviados). Mitigação: cache do upload? Não viável no modelo atual. Alternativa: cada etapa recebe PDFs filtrados (apenas os relevantes para aquele módulo). |
| **Inconsistência entre etapas** | Média | Alto | Cada módulo processado independentemente pode gerar conclusões contraditórias. A etapa de consolidação precisa harmonizar. |
| **Estado inconsistente (etapa parcial)** | Média | Alto | Se o frontend fechar durante o loop de etapas, a análise fica em `processing_step`. Solução: cron job ou endpoint de retomada (`/api/analyze/resume`). |
| **Regressão no fluxo simples** | Baixa | Alto | O fluxo atual (documentos leves, processamento único) deve ser preservado como fallback. Testes de regressão obrigatórios. |
| **Concorrência** | Baixa | Médio | Se duas requisições chegarem para a mesma etapa, processamento duplicado. Mitigação: validação de status antes de iniciar etapa (já existe para `processing`). |

### 6.2 Riscos de negócio

| Risco | Descrição |
|---|---|
| **Aumento no tempo total percebido** | 4 etapas × 45s = 3min, vs 1 chamada de 90s. Usuário pode perceber como mais lento, mesmo sendo mais confiável. UX precisa comunicar progresso. |
| **Custo operacional** | Cada etapa independente consome tokens do Gemini. Processamento em etapas pode custar 2-4× mais que o modo único. |
| **Complexidade de manutenção** | O código atual de `/api/analyze` já tem 895 linhas. Adicionar modo de etapas pode torná-lo difícil de manter. Recomendação: extrair para `src/lib/analyze/` com módulos separados. |

### 6.3 Risco de rollback

- **Plano:** Se a FASE 5 causar regressão, reverter commits deste bloco e retornar ao fluxo monolítico atual
- **Segurança:** O branch `stable/rebuild-beta-01-laudo-compartilhavel` tem o commit `2c3a1b6` como base limpa. Tag `rescue-before-clean-rebuild-2026-06-02` preserva snapshot anterior.

---

## 7. Dependências

### 7.1 Dependências de código existentes

| Dependência | Localização | Como afeta a FASE 5 |
|---|---|---|
| `withTimeout()` | `route.ts:12-20` | Reutilizável para timeout por etapa |
| `MODULE_PRICES` | `src/lib/auditModules.ts` | Usado para calcular preço por etapa |
| `buildLegalAuditPrompt()` | `src/lib/auditPromptBuilder.ts` | Precisa de variante para prompt por módulo individual |
| `withEnsuredCaseFile()` | `src/lib/caseFile.ts` | Já mantém `module_results` — cada etapa popula seu resultado |
| `isRecoverableErrorType()` | `route.ts:33-35` | Reutilizável para retry por etapa |
| `buildRetryState()` | `route.ts:69-77` | Adaptável para retry por etapa |
| `normalizeStatus()` | `src/types/analise.ts` | Precisa de novos status (`processing_step`, `consolidating`) |
| `extractProblemsFromReport()` | `src/lib/reportExtractors.ts` | Continuará sendo usado na etapa de consolidação |
| `deriveRiskLevelFromResumo()` | `route.ts:143-180` | Movido para etapa de consolidação |

### 7.2 Dependências externas

| Dependência | Versão | Impacto |
|---|---|---|
| `@google/generative-ai` | Atual | Suporta múltiplas chamadas simultâneas? Verificar rate limits da API Gemini. |
| Vercel Pro | Atual | `maxDuration` de 120s é o teto do plano Pro? Verificar documentação. |
| Supabase | Atual | JSONB em `findings` suporta o `step_plan` sem migração. |

### 7.3 Ordem de implementação recomendada

1. **Preparação (sem quebrar nada):**
   - Adicionar tipos `StepPlan`, `StepInfo` em `src/types/analise.ts`
   - Adicionar campo `step_plan` na interface `CaseFile` em `src/lib/caseFile.ts`
   - Criar `buildSingleModulePrompt()` em `src/lib/auditPromptBuilder.ts`
   - Criar `estimateDocumentComplexity()` em `src/lib/auditModules.ts`

2. **Endpoint `/api/analyze/plan` (novo):**
   - Avaliar documentos, calcular etapas, persistir `step_plan`
   - Sem chamada Gemini — apenas análise de metadados

3. **Endpoint `/api/analyze/step` (novo):**
   - Processar um módulo por vez
   - Timeout de 60s por etapa
   - Salvar resultado em `module_results[moduleId]`

4. **Endpoint `/api/analyze/consolidate` (novo):**
   - Juntar `module_results`, gerar resumo final
   - Calcular `risk_level`, extrair problemas/recomendações

5. **Adaptação do frontend:**
   - Dashboard: barra de progresso, loop de etapas
   - Resultado: polling para `consolidating`

6. **Adaptação do endpoint legado:**
   - `POST /api/analyze` detecta densidade e redireciona para modo etapas OU mantém fluxo atual para docs simples

---

## 8. Resumo executivo

| Item | Estado atual | Estado desejado (FASE 5) |
|---|---|---|
| **Processamento** | Monolítico (1 chamada Gemini) | Fatiado por módulo (N chamadas Gemini) |
| **Timeout máximo** | 120s (Vercel) + 110s (Gemini para docs densos) | 60s por etapa (Vercel) + 45-60s por etapa (Gemini) |
| **Resiliência** | Tudo ou nada — se timeout, análise inteira falha | Uma etapa falha → apenas aquela etapa é reprocessada |
| **Retry** | 5 tentativas globais, depois `retry_exhausted` | 3 tentativas por etapa, falha não bloqueia outras etapas |
| **UX** | Spinner único "Sintetizando Parecer..." | Barra de progresso: "Etapa 1/4: Matrícula Individual..." |
| **Custo** | 1 chamada Gemini | N chamadas Gemini (maior custo, maior confiabilidade) |
| **Complexidade** | 895 linhas em 1 arquivo | ~1200 linhas distribuídas em múltiplos arquivos |

---

## 9. Pendências para implementação

- [ ] Definir com usuário: fragmentação automática (baseada em densidade) ou manual (usuário escolhe módulos)?
- [ ] Verificar rate limits da API Gemini para múltiplas chamadas sequenciais
- [ ] Confirmar `maxDuration` máximo disponível no plano Vercel atual
- [ ] Validar se o custo adicional de tokens é aceitável para o negócio
- [ ] Criar suíte de testes para o novo fluxo de etapas

---

*Relatório gerado em 05/06/2026. Nenhum arquivo foi alterado.*