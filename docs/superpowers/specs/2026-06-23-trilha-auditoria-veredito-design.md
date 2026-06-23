# Trilha de Auditoria do Veredito ISF

> **Eixo 1 — Blindar o núcleo · Sub-bloco 1.4**
> Data: 2026-06-23 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`
> Depende de: sub-bloco 1.1 (Proof Engine / `computeISFVerdict`).

## 1. Problema (buraco B4)

Hoje é **impossível reconstruir, meses depois, por que um ISF deu X**: quais dimensões vieram do JSON da IA vs foram inferidas, quais travas dispararam e com quais inputs. Para um laudo jurídico, defensabilidade exige rastro. Além disso, o harvest do Proof Engine (1.1) hoje **reconstrói** o input de veredito a partir de campos espalhados em `findings` (imperfeito); e não há como saber, olhando uma análise antiga, se o veredito persistido ainda corresponde ao motor atual (a origem do chip `task_596c2ba1`).

## 2. Solução

Persistir, em toda análise, um **registro de veredito** auto-contido: o `ISFVerdictInput` exato + a saída-chave + a proveniência + um `schema_version`. Aditivo — **não altera o veredito**, apenas grava o "porquê".

Benefícios:
- **Auditabilidade**: reexecutar `computeISFVerdict(registro.input)` reproduz o `registro.output` → o "porquê" é reconstruível e verificável.
- **Harvest exato**: o Proof Engine passa a ler `findings.isf_verdict.input` diretamente (sem reconstrução).
- **Detecção de defasagem**: comparar `computeISFVerdict(input)` atual com `output` persistido revela análises cujo motor mudou (resolve a base do `task_596c2ba1`).

## 3. Componentes

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/lib/isf/isfVerdict.ts` | Modify | `ISFVerdictRecord` + `buildVerdictRecord(input, verdict)` puro. |
| `src/lib/isf/__tests__/isfVerdict.test.ts` | Modify | Teste de `buildVerdictRecord`. |
| `src/app/api/analyze/route.ts` | Modify | Capturar `verdictInput`, montar registro + `computed_at`, persistir em `findings.isf_verdict`. |
| `scripts/harvest-verdict-fixtures.mjs` | Modify | Preferir `findings.isf_verdict.input` quando presente (exato); fallback à reconstrução. |

### 3.1 Contrato

```ts
export interface ISFVerdictRecord {
  schema_version: 1;
  input: ISFVerdictInput;
  output: { isf_score: number; faixa: string; isf_score_bruto: number; travas_aplicadas: string[] };
  dimensoes_source: 'ai_json' | 'inferred';
  insufficient_data: boolean;
}
export function buildVerdictRecord(input: ISFVerdictInput, verdict: ISFVerdict): ISFVerdictRecord;
```

`computed_at` (ISO) é acrescentado no `route.ts` (timestamp de runtime), não na função pura.

### 3.2 Persistência

Em `route.ts`, após `computeISFVerdict`, adicionar a `patchedFindings`:
```ts
isf_verdict: { ...buildVerdictRecord(verdictInput, verdict), computed_at: new Date().toISOString() }
```

## 4. Não-objetivos
- ❌ Coluna dedicada / migration — vai dentro do JSONB `findings` (sem mudança de schema).
- ❌ UI de auditoria — só persistência; visualização é outro sub-bloco.
- ❌ Re-processar análises antigas — é o `task_596c2ba1`, separado.

## 5. Governança e validação
- Classe D (toca write-path do `route.ts`), porém **aditivo** (novo campo no findings) — risco 🟢 baixo, comportamento do veredito inalterado.
- Validação: `tsc`, `lint`, `build`, `jest` (664 + novos). Rollback = reverter 1 commit.

## 6. Critérios de aceite
1. `buildVerdictRecord` puro e testado.
2. `findings.isf_verdict` persistido em toda análise nova, com `input` reexecutável.
3. Harvest prefere `isf_verdict.input` quando presente.
4. Zero regressão (suíte verde, veredito inalterado).
