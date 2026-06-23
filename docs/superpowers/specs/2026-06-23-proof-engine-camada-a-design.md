# Proof Engine — Camada A (Portão de Regressão Determinístico)

> **Eixo 1 — Blindar o núcleo · Sub-bloco 1.1**
> Data: 2026-06-23 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`
> Status: **Design aprovado** — aguardando revisão do spec antes do plano de implementação.

---

## 1. Contexto e problema

O loop de valor do AgroLex é `matrícula (PDF) → OCR → IA → ISF → laudo`. O histórico do `AGENTS.md` mostra que ~90% do esforço foi *firefighting* do mesmo loop (OCR truncado, alucinação, achatamento-54, "falso-78"), e **cada correção foi validada contra uma única matrícula, no olho**. Não existe rede de regressão: o fix N+1 pode regredir o fix N **em silêncio**.

Para um produto cujo ativo é a **credibilidade jurídica do laudo**, isso é existencial. Um score 78 numa matrícula que vale 30 não é "um bug" — destrói a tese de valor inteira.

Este sub-bloco constrói a **Camada A** do Proof Engine: um portão de regressão **determinístico** que prova, a cada commit, que as propriedades de confiança da cauda de julgamento do ISF continuam válidas.

### Decisão arquitetural de fundo: duas camadas

O Proof Engine completo tem duas camadas de natureza oposta. Este spec cobre **apenas a Camada A**.

- **🟢 Camada A — Portão de Regressão (este spec).** Determinístico, grátis, roda em CI a cada commit, **bloqueante**. Congela a fronteira entre o estocástico (LLM) e o determinístico (cauda de julgamento) e crava o veredito.
- **🟠 Camada B — Harness de Avaliação (fora de escopo; sub-bloco 1.2).** LLM no loop, PDFs reais, mede qualidade/*drift* de extração contra rótulos do especialista. Lento, custa tokens, flaky → **nunca** bloqueia commit.

---

## 2. A virada de chave (por que há um refactor)

A lógica de veredito — portão de suficiência → trava de litígio → `calcularISFV2_2` → tetos externos → guardrail `risk_level` → trava de dados insuficientes — está **inteiramente inline** em `src/app/api/analyze/route.ts`, **linhas 2099–2204**, intercalada com o parsing da resposta da IA. Apenas `calcularISFV2_2` é uma função pura; **toda a orquestração das travas ao redor dele não é.**

Consequência crítica: **o "falso-78" morava na orquestração, não no `calcularISFV2_2`.** A causa-raiz foi o portão de suficiência (`route.ts:2110-2111` e `2193`), código inline *fora* da função pura. Testar só o `calcularISFV2_2` que já existe **não pegaria o bug que motivou o Eixo 1**.

Portanto, tornar a cauda testável exige **extraí-la para uma função pura** antes de colher fixtures. Enquanto a lógica viver inline no handler HTTP, todo teste precisaria subir o pipeline inteiro (OCR + IA + Supabase) — flaky e caro. Extrair é a fundação que transforma "teste impossível" em "teste determinístico de microssegundos".

A extração é um **refactor comportamento-preservante** (MODO: REFACTOR do `GEMINI.md`): recortar 2099–2204 para uma função sem I/O, sem async, sem efeito colateral. Comportamento idêntico por construção, coberto pelos 642 testes jest atuais, rollback = reverter 1 commit.

---

## 3. Objetivos e não-objetivos

### Objetivos
1. Extrair a cauda de julgamento determinística do `route.ts` para uma função pura `computeISFVerdict()`, sem alterar comportamento observável.
2. Estabelecer um corpus de fixtures `{input, expected}` versionado, semeado com casos *golden* já documentados.
3. Um runner jest que roda cada fixture pela função pura e crava o veredito — **bloqueante no CI**.
4. Um script read-only que colhe análises de produção como fixtures de *caracterização*.

### Não-objetivos (YAGNI / fronteiras deliberadas)
- ❌ Camada B (eval com LLM ao vivo) — sub-bloco 1.2.
- ❌ Persistir `findings.isf_verdict` no write-path do `route.ts` — adiado para o sub-bloco 1.4 (trilha de auditoria), onde a escrita se justifica. Aqui reconstruímos do que já existe.
- ❌ Envelope de Confiança, crítica semântica, detector de contradições, observabilidade da cascata — demais sub-blocos do Eixo 1.
- ❌ Rotulagem *golden* além do seed — incremental, conforme o uso.

---

## 4. Componentes

| # | Artefato | Tipo | Responsabilidade |
|---|---|---|---|
| 1 | `src/lib/isf/isfVerdict.ts` | **novo** | Função pura `computeISFVerdict(input) → veredito`. Encapsula `route.ts:2099–2204`. |
| 2 | `src/app/api/analyze/route.ts` (≈2099–2204) | **refactor** | Vira ~5 linhas: monta `input` → chama `computeISFVerdict` → usa o resultado. Drop-in. |
| 3 | `src/lib/isf/__fixtures__/verdict/*.json` | **novo** | O corpus. Cada arquivo = 1 caso `{input, expected}`. |
| 4 | `src/lib/isf/__tests__/isfVerdict.fixtures.test.ts` | **novo** | Runner: glob das fixtures → roda cada uma por `computeISFVerdict` → assert. |
| 5 | `scripts/harvest-verdict-fixtures.mjs` | **novo** | Colhe análises de produção (read-only) → escreve fixtures de caracterização. |

### 4.1 Contrato da função pura

A fronteira entre o estocástico (saída da IA) e o determinístico (julgamento).

```ts
// src/lib/isf/isfVerdict.ts
import type { ProblemaLike } from './isfEngineV2_2'; // ou tipo equivalente já existente

export interface ISFVerdictInput {
  /** Dimensões explícitas da IA (matricula_individual.isf_dimensoes); null → inferência por keyword. */
  isfDimensoesFromAI?: Record<'D1'|'D2'|'D3'|'D4'|'D5'|'D6',
                              { pontuacao: number; justificativa?: string }> | null;
  /** Achados parseados (problemas) — fonte da inferência, gravames, críticos e litígio. */
  parsedProblemas: ProblemaLike[];
  /** Diagnóstico de OCR — portão de suficiência. */
  ocrIncomplete: boolean;
  ocrPages?: { expected: number; transcribed: number } | null;
  /** Contexto do módulo. */
  ehMatriculaModule: boolean;
  /** Extração registral (portão de suficiência) — de matriculaIndividualJsonParsed. */
  atosCount: number | null;        // atos_registrais.length
  proprietarioNome: string | null; // proprietario_atual.nome
  /** Flags externas. */
  cadeiaNaoAuditada: boolean;
  riskLevel: string;               // 'Crítico' | 'Alto' | 'Médio' | 'Baixo'
}

export interface ISFVerdict {
  /** Resultado ISF final, pós-todas-as-travas. */
  result: ISFResultV2_2;
  /** Proveniência das dimensões — semente da trilha de auditoria (sub-bloco 1.4 / B4). */
  dimensoesSource: 'ai_json' | 'inferred';
  /** true se o portão de suficiência travou em Inválido. */
  insufficientData: boolean;
}

export function computeISFVerdict(input: ISFVerdictInput): ISFVerdict;
```

**Pureza exigida:** sem `fetch`, sem `await`, sem `Date.now()`/`Math.random()`, sem acesso a `process.env` que altere resultado, sem mutação de argumentos de entrada. Mesmo input → mesmo output, sempre.

**Equivalência:** a função reproduz, na mesma ordem, toda a lógica de `route.ts:2099–2204`:
1. Portão de suficiência (`dadosInsuficientes = ocrIncomplete || extractRegistralVazio`).
2. Origem das dimensões: `isfDimensoesFromAI` explícito **ou** `inferirPontuacoesDeAchados(parsedProblemas)` + sincronização de criticidade.
3. Trava de litígio de propriedade (`detectarLitigioPropriedade` → D3/D5 ≤ 15).
4. `calcularISFV2_2(pontuacoes)`.
5. Tetos externos em ordem do mais grave (`detectarGravameGrave`, `travaPorCriticos`, `cadeiaNaoAuditada` → teto 84).
6. Guardrail `risk_level` Crítico → score ≤ 54 (força 39).
7. Trava de dados insuficientes (aplicada por último, vence todas → score 20 / `invalido`).

### 4.2 Formato da fixture

Auto-descritiva e versionável. Um arquivo JSON por caso.

```jsonc
{
  "id": "2705-fazenda-santa-barbara",
  "source": "prod:72c13e14",            // ou "documented:AGENTS.md" para os golden seed
  "label": "golden",                     // "golden" | "characterization"
  "note": "Cancelamento por coisa julgada + 2 penhoras + ação federal",
  "input":  { /* ...ISFVerdictInput exato... */ },
  "expected": {
    "isf_score": 20,
    "faixa": "invalido",
    "travas_includes": ["TRAVA_DADOS_INSUFICIENTES"]
  }
}
```

**Decisões de design embutidas:**
- **`label: golden | characterization`.** Separa "verdade forense abençoada pelo especialista" de "comportamento atual congelado". O CI trata ambos como bloqueantes, mas o relatório distingue: regressão de `golden` é **erro grave**; regressão de `characterization` sinaliza "o comportamento mudou de propósito? então atualize a fixture conscientemente".
- **`travas_includes` (inclusão, não igualdade).** Assert por igualdade exata do array de travas quebraria a cada trava nova legítima. Inclusão crava o que importa sem engessar a evolução do motor.
- **`expected` mínimo e estável.** Crava `isf_score`, `faixa` e travas-chave. Não crava campos cosméticos (cores, labels) que mudam por motivos não-semânticos.

### 4.3 Runner (CI)

`src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`:
- Faz glob de `src/lib/isf/__fixtures__/verdict/*.json`.
- Para cada fixture: `computeISFVerdict(fixture.input)` → assert `isf_score`, `faixa`, e `travas_includes ⊆ result.travas_aplicadas`.
- Falha de fixture `golden` → mensagem destacando "REGRESSÃO DE VERDADE FORENSE".
- Roda dentro do `npm test` existente; entra no `.github/workflows/ci.yml` como gate bloqueante (já roda `npm test` no CI).

---

## 5. Fluxo de dados

```
[Runtime — produção]
  route.ts: parsing da resposta IA
        ↓  monta ISFVerdictInput
  computeISFVerdict(input)  ──────────────►  ISFVerdict { result, dimensoesSource, insufficientData }
        ↓                                            (usado para persistir isf_v2_2, como hoje)

[CI — a cada commit]
  glob __fixtures__/verdict/*.json
        ↓  para cada fixture
  computeISFVerdict(fixture.input)  ──────►  assert vs fixture.expected
        ↓
  verde = nenhuma regressão | vermelho = veredito mudou

[Harvest — manual / pontual, read-only]
  Supabase prod (SELECT analyses)
        ↓  reconstrói ISFVerdictInput de findings
  escreve __fixtures__/verdict/<id>.json  (label: characterization)
        ↓  casos com findings incompleto: PULADOS com motivo logado
```

### 5.1 Seed *golden* (já documentado)

O histórico do `AGENTS.md` contém 3 vereditos forenses já verificados pelo especialista — o seed não exige rotulagem nova:

| Matrícula | Score | Faixa | Trava-chave | Fonte |
|---|---|---|---|---|
| 2.705 (Fazenda Santa Bárbara) | 20 | `invalido` | `TRAVA_DADOS_INSUFICIENTES` | AGENTS.md 23/06 |
| 27.180 (usucapião) | 39 | `critico` | `TRAVA_D3_GRAVAME` | AGENTS.md 20/06 |
| 26.839 (execução fiscal) | 54 | `alto_risco` | `TRAVA_PENHORA` | AGENTS.md 20/06 |

> Nota: o `input` exato de cada seed será montado para reproduzir o cenário documentado (ex.: 2.705 com `ocrIncomplete: true` **ou** miolo registral vazio). Se algum cenário não for reconstruível com fidelidade a partir da documentação, ele é marcado para confirmação do especialista antes de virar `golden` — nunca inventado.

### 5.2 Harvest de caracterização

`scripts/harvest-verdict-fixtures.mjs` (read-only):
- Conecta no Supabase de produção via Management API / credenciais do `.env.local` (mesmo padrão dos scripts existentes), **somente SELECT**.
- Para cada `analysis` com `findings` suficiente, reconstrói `ISFVerdictInput` a partir de: `findings.problemas`, `findings.isf_v2_2.dimensoes`/`isf_dimensoes` (quando presente), `findings.pdf_extraction_diagnostics.ocr_incomplete`/`ocr_pages`, e o módulo selecionado.
- `expected` = o veredito atual persistido (`findings.isf_v2_2.isf_score`, `faixa`, `travas_aplicadas`).
- Casos com `findings` incompleto (sem dimensões reconstruíveis, sem score persistido) são **pulados com motivo logado** — sem corte silencioso.

---

## 6. Sequenciamento (commits isolados)

```
Commit 1 — Extração pura (refactor)
  • cria isfVerdict.ts (move 2099-2204, comportamento idêntico)
  • route.ts vira drop-in (~5 linhas)
  • GATE: npm test (642) + npm run build + npm run lint + npx tsc --noEmit TODOS verdes

Commit 2 — Seed golden + runner
  • 3 fixtures "golden" (2.705, 27.180, 26.839) do histórico documentado
  • runner jest com glob das fixtures
  • GATE: as 3 fixtures passam contra computeISFVerdict

Commit 3 — Harvest de caracterização
  • script read-only colhe N análises de prod → fixtures "characterization"
  • casos incompletos pulados com motivo logado

Commit 4 — CI bloqueante
  • garante que o runner roda no .github/workflows/ci.yml (já executa npm test)
```

---

## 7. Governança (classes GEMINI.md)

| Ação | Classe | Risco | Autorização |
|---|---|---|---|
| Extrair `computeISFVerdict` (toca `route.ts`) | C/D | 🟡 contido (puro, 642 testes, 1-revert) | Pedir antes do Commit 1 |
| Harvest **lê** prod (read-only, SELECT) | A | 🟢 baixo (sem escrita) | Avisar — usa credencial prod |
| Wire/confirmar CI | B | 🟢 baixo | — |
| `git push` / deploy | E | — | Autorização explícita no momento (memória já autoriza deploy autônomo; confirmar) |

---

## 8. Plano de rollback

Cada commit é reversível isolado. O risco concentra-se no **Commit 1** (extração do `route.ts`). Mitigação:
- A extração é o primeiro commit, validado pela suíte inteira **antes** de qualquer fixture.
- Se a suíte (ou validação manual de uma análise real) acusar qualquer divergência: `git revert` de 1 commit restaura o `route.ts` byte-a-byte.
- Os demais commits (fixtures, runner, harvest, CI) não tocam o runtime de produção — rollback trivial.

---

## 9. Validação obrigatória

Após cada commit que afete código de produção:
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm test` (642 atuais + novas fixtures)

Nenhum `git push` / `vercel --prod` / migration sem autorização explícita.

---

## 10. Critérios de aceite

1. `computeISFVerdict` existe, é pura, e o `route.ts` a usa como drop-in.
2. Os 642 testes existentes continuam verdes (zero regressão comportamental).
3. As 3 fixtures *golden* (2.705 → 20/invalido, 27.180 → 39/critico, 26.839 → 54/alto_risco) passam.
4. O runner roda no `npm test` e, por extensão, no CI bloqueante.
5. O script de harvest produz ≥1 fixture de caracterização a partir de prod, pulando incompletos com log.
6. O "falso-78" está protegido por fixture: alterar a trava de suficiência de modo que a 2.705 deixe de ser `invalido` deixa o CI **vermelho**.
