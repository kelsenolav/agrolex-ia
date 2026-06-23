# Proof Engine — Camada A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair a cauda de julgamento determinística do ISF do `route.ts` para uma função pura `computeISFVerdict()` e cravá-la com um portão de regressão de fixtures bloqueante no CI, matando o "falso-78" por regressão provada.

**Architecture:** A lógica de veredito (portão de suficiência → trava de litígio → `calcularISFV2_2` → tetos externos → guardrail risk_level → trava de dados insuficientes), hoje inline em `route.ts:2099-2204`, é movida sem mudança de comportamento para `src/lib/isf/isfVerdict.ts`. Um corpus de fixtures JSON `{input, expected}` (golden semeado do histórico + characterization colhido de prod) roda por essa função num runner jest, dentro de `npm test`, bloqueando o CI.

**Tech Stack:** TypeScript, Next.js (App Router), Jest + ts-jest, Node ESM scripts (`.mjs`), Supabase (read-only no harvest).

## Global Constraints

- Branch de trabalho: `stable/rebuild-beta-01-laudo-compartilhavel` (verbatim do `GEMINI.md`).
- `route.ts` é arquivo crítico: alteração só com diagnóstico + risco + teste + rollback. A extração é **comportamento-preservante** (MODO: REFACTOR) — comportamento externo idêntico, menor diff possível.
- Validação obrigatória após qualquer alteração de produção: `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm test`. Os 642 testes atuais devem permanecer verdes.
- `git push`, `vercel --prod`, migration, `.env`, RLS: **só com autorização explícita** (Classe E).
- Harvest de produção é **somente SELECT** (read-only). Nunca escrever em prod.
- Sem corte silencioso: se o harvest pular um caso, logar o motivo.
- Não reintroduzir termos proibidos do projeto (ESG, carbono, EUDR, etc.) — não aplicável a este plano, mas a regra vale.

---

## File Structure

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/lib/isf/isfVerdict.ts` | Create | Função pura `computeISFVerdict` + tipos `ISFVerdictInput`/`ISFVerdict`/`VerdictProblema`. Única responsabilidade: dado o veredito estruturado da IA + diagnóstico OCR, produzir o `ISFResultV2_2` final pós-travas. |
| `src/lib/isf/__tests__/isfVerdict.test.ts` | Create | Testes unitários diretos da função pura (os 3 casos golden + bordas de cada trava). |
| `src/lib/isf/__fixtures__/verdict/*.json` | Create | Corpus de fixtures `{input, expected}`. Um arquivo por caso. |
| `src/lib/isf/__tests__/isfVerdict.fixtures.test.ts` | Create | Runner: glob das fixtures → roda cada uma por `computeISFVerdict` → assert. Bloqueante no CI. |
| `src/app/api/analyze/route.ts` (2099-2204) | Modify | Substituir o bloco inline por chamada drop-in a `computeISFVerdict` + reatribuir `parsedProblemas`. |
| `scripts/harvest-verdict-fixtures.mjs` | Create | Colhe análises de prod (read-only) → escreve fixtures `characterization`. |
| `.github/workflows/ci.yml` | Verify/Modify | Garantir que `npm test` (com o runner de fixtures) roda como gate bloqueante. |

---

## Task 1: Função pura `computeISFVerdict`

**Files:**
- Create: `src/lib/isf/isfVerdict.ts`
- Test: `src/lib/isf/__tests__/isfVerdict.test.ts`

**Interfaces:**
- Consumes (de `./isfEngineV2_2`): `calcularISFV2_2(pontuacoes: PontuacaoEntradaV2_2[]): ISFResultV2_2`, `classificarFaixaV2_2(score: number)`, `inferirPontuacoesDeAchados(problemas): { pontuacoes: PontuacaoEntradaV2_2[]; criticidadeInferida: Map<string,string> }`, `detectarLitigioPropriedade(p)`, `detectarGravameGrave(p): {teto,motivo}|null`, `travaPorCriticos(p): {teto,motivo}|null`, e os tipos `ISFResultV2_2`, `PontuacaoEntradaV2_2`. (Nota: `ProblemaLike` NÃO é exportado — por isso definimos `VerdictProblema` local.)
- Produces: `computeISFVerdict(input: ISFVerdictInput): ISFVerdict` e os tipos `ISFVerdictInput`, `ISFVerdict`, `VerdictProblema`.

- [ ] **Step 1: Write the failing test**

Criar `src/lib/isf/__tests__/isfVerdict.test.ts`:

```ts
import { computeISFVerdict, type ISFVerdictInput } from '../isfVerdict';

function baseInput(overrides: Partial<ISFVerdictInput> = {}): ISFVerdictInput {
  return {
    isfDimensoesFromAI: { D1:{pontuacao:90}, D2:{pontuacao:90}, D3:{pontuacao:90},
                          D4:{pontuacao:90}, D5:{pontuacao:90}, D6:{pontuacao:90} },
    parsedProblemas: [],
    ocrIncomplete: false,
    ocrPages: null,
    ehMatriculaModule: true,
    atosCount: 5,
    proprietarioNome: 'Idemar José Ferreira',
    cadeiaNaoAuditada: false,
    riskLevel: 'Baixo',
    ...overrides,
  };
}

describe('computeISFVerdict — pureza e equivalência', () => {
  it('título impecável (dimensões altas, sem achados) → faixa alta, não trava', () => {
    const v = computeISFVerdict(baseInput());
    expect(v.insufficientData).toBe(false);
    expect(v.dimensoesSource).toBe('ai_json');
    expect(v.result.isf_score).toBeGreaterThan(54);
    expect(v.result.travas_aplicadas).not.toContain('TRAVA_DADOS_INSUFICIENTES');
  });

  it('NÃO muta o array de entrada (problemasSincronizados é cópia)', () => {
    const problemas = [{ titulo: 'Penhora', criticidade: 'baixo' }];
    const input = baseInput({ isfDimensoesFromAI: null, parsedProblemas: problemas });
    const snapshot = JSON.stringify(problemas);
    computeISFVerdict(input);
    expect(JSON.stringify(problemas)).toBe(snapshot); // entrada intacta
  });

  it('GOLDEN 2.705 — OCR incompleto → 20 / invalido / TRAVA_DADOS_INSUFICIENTES', () => {
    const v = computeISFVerdict(baseInput({
      ocrIncomplete: true,
      ocrPages: { expected: 6, transcribed: 1 },
    }));
    expect(v.result.isf_score).toBe(20);
    expect(v.result.faixa).toBe('invalido');
    expect(v.result.travas_aplicadas.some(t => t.startsWith('TRAVA_DADOS_INSUFICIENTES'))).toBe(true);
  });

  it('GOLDEN 27.180 — usucapião (litígio de terceiro) → ≤39 / critico', () => {
    const v = computeISFVerdict(baseInput({
      isfDimensoesFromAI: null,
      parsedProblemas: [{ titulo: 'Usucapião averbada (AV-2)', criticidade: 'alto',
                          descricao: 'ação de usucapião por terceiro em andamento' }],
    }));
    expect(v.result.isf_score).toBeLessThanOrEqual(39);
    expect(['critico','invalido']).toContain(v.result.faixa);
  });

  it('GOLDEN 26.839 — penhora/execução fiscal → ≤54 / alto_risco ou pior', () => {
    const v = computeISFVerdict(baseInput({
      isfDimensoesFromAI: null,
      parsedProblemas: [{ titulo: 'Penhora fiscal (AV-4)', criticidade: 'alto',
                          descricao: 'penhora em execução fiscal' }],
    }));
    expect(v.result.isf_score).toBeLessThanOrEqual(54);
  });

  it('extração registral vazia (atos=0, sem proprietário, sem achados) → 20 / invalido', () => {
    const v = computeISFVerdict(baseInput({
      isfDimensoesFromAI: null,
      atosCount: 0,
      proprietarioNome: 'não consta',
      parsedProblemas: [],
    }));
    expect(v.result.isf_score).toBe(20);
    expect(v.result.faixa).toBe('invalido');
  });

  it('é determinística — mesmo input, mesmo output', () => {
    const input = baseInput({ isfDimensoesFromAI: null,
      parsedProblemas: [{ titulo: 'Hipoteca', criticidade: 'medio' }] });
    const a = computeISFVerdict(input);
    const b = computeISFVerdict(input);
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/isf/__tests__/isfVerdict.test.ts`
Expected: FAIL — `Cannot find module '../isfVerdict'`.

- [ ] **Step 3: Write minimal implementation**

Criar `src/lib/isf/isfVerdict.ts` (lógica movida verbatim de `route.ts:2099-2204`, parametrizada pelo `input`):

```ts
import {
  calcularISFV2_2,
  classificarFaixaV2_2,
  inferirPontuacoesDeAchados,
  detectarLitigioPropriedade,
  detectarGravameGrave,
  travaPorCriticos,
  type ISFResultV2_2,
  type PontuacaoEntradaV2_2,
} from './isfEngineV2_2';

/** Forma local permissiva — ProblemaLike não é exportado pelo motor. Superset assignável. */
export type VerdictProblema = {
  titulo?: string;
  descricao?: string;
  criticidade?: string;
  eixo?: string;
  dimensao?: string;
  baseDocumental?: string;
  [key: string]: unknown;
};

export interface ISFVerdictInput {
  /** Dimensões explícitas da IA (matricula_individual.isf_dimensoes); null → inferência por keyword. */
  isfDimensoesFromAI?: Record<string, { pontuacao: number; justificativa?: string }> | null;
  parsedProblemas: VerdictProblema[];
  ocrIncomplete: boolean;
  ocrPages?: { expected: number; transcribed: number } | null;
  ehMatriculaModule: boolean;
  /** matriculaIndividualJsonParsed.atos_registrais.length, ou null se ausente/não-array. */
  atosCount: number | null;
  proprietarioNome: string | null;
  cadeiaNaoAuditada: boolean;
  riskLevel: string;
}

export interface ISFVerdict {
  result: ISFResultV2_2;
  dimensoesSource: 'ai_json' | 'inferred';
  insufficientData: boolean;
  /** Problemas com criticidade sincronizada (cópia — entrada nunca é mutada). */
  problemasSincronizados: VerdictProblema[];
}

export function computeISFVerdict(input: ISFVerdictInput): ISFVerdict {
  // Cópia defensiva — a função é pura, nunca muta o array de entrada.
  const problemas: VerdictProblema[] = input.parsedProblemas.map((p) => ({ ...p }));

  // ── Portão de SUFICIÊNCIA (anti "falso-78") ──
  const propNome = String(input.proprietarioNome || '').toLowerCase().trim();
  const proprietarioAusente =
    !propNome || /n[ãa]o\s*consta|n[ãa]o\s*identificad|n[ãa]o\s*informad/.test(propNome);
  // atosCount === 0 já implica que o JSON da matrícula existe com atos_registrais vazio.
  const extractRegistralVazio =
    input.ehMatriculaModule && input.atosCount === 0 && proprietarioAusente && problemas.length === 0;
  const insufficientData = input.ocrIncomplete || extractRegistralVazio;

  // ── Dimensões: explícitas (IA) ou inferidas por keyword ──
  let pontuacoes: PontuacaoEntradaV2_2[];
  let dimensoesSource: 'ai_json' | 'inferred';
  const dimsAI = input.isfDimensoesFromAI;
  if (dimsAI && typeof dimsAI === 'object') {
    dimensoesSource = 'ai_json';
    pontuacoes = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']
      .filter((d) => dimsAI[d] && typeof dimsAI[d].pontuacao === 'number')
      .map((d) => ({
        dimensaoId: d,
        pontuacao: Math.max(0, Math.min(100, Number(dimsAI[d].pontuacao))),
        itemSelecionado: dimsAI[d].justificativa,
      }));
  } else {
    dimensoesSource = 'inferred';
    const inferred = inferirPontuacoesDeAchados(problemas as any);
    pontuacoes = inferred.pontuacoes;
    for (const p of problemas) {
      const chave = (p.titulo || '').trim();
      if (!chave) continue;
      const inferida = inferred.criticidadeInferida.get(chave);
      if (inferida) {
        const atual = (p.criticidade || '').toLowerCase().trim();
        const isDefault = !atual || atual === 'medio' || atual === 'médio';
        const isLessSevere =
          (atual.replace(/[.!?,;]+$/, '') === 'baixo' && (inferida === 'Crítico' || inferida === 'Alto')) ||
          (atual.replace(/[.!?,;]+$/, '') === 'alto' && inferida === 'Crítico');
        if (isDefault || isLessSevere) {
          p.criticidade = inferida;
        }
      }
    }
  }

  // ── Trava de litígio de propriedade (determinística) → D3/D5 ≤ 15 ──
  if (detectarLitigioPropriedade(problemas as any)) {
    for (const p of pontuacoes) {
      if (p.dimensaoId === 'D3' || p.dimensaoId === 'D5') {
        p.pontuacao = Math.min(p.pontuacao, 15);
        p.itemSelecionado = `${p.itemSelecionado ? p.itemSelecionado + ' ' : ''}[Trava: ação de terceiro disputando a propriedade]`;
      }
    }
  }

  let result = calcularISFV2_2(pontuacoes);

  // ── Tetos externos (do mais grave para o menos grave) ──
  const tetosExternos: { teto: number; motivo: string }[] = [];
  const gravame = detectarGravameGrave(problemas as any);
  if (gravame) tetosExternos.push(gravame);
  const tCriticos = travaPorCriticos(problemas as any);
  if (tCriticos) tetosExternos.push(tCriticos);
  if (input.cadeiaNaoAuditada) {
    tetosExternos.push({
      teto: 84,
      motivo: 'TRAVA_CADEIA_NAO_AUDITADA: cadeia dominial não auditada em módulo dedicado — teto máximo 84 (Regular)',
    });
  }
  for (const c of tetosExternos) {
    if (result.isf_score > c.teto) {
      const fx = classificarFaixaV2_2(c.teto);
      result = {
        ...result,
        isf_score: c.teto,
        faixa: fx.faixa,
        faixa_label: fx.label,
        faixa_desc: fx.desc,
        faixa_bg: fx.bg,
        faixa_color: fx.color,
        faixa_meter: fx.meter,
        travas_aplicadas: [...(result.travas_aplicadas || []), c.motivo],
      };
    }
  }

  // ── Guardrail: risk_level Crítico nunca produz ISF > 54 ──
  if (input.riskLevel === 'Crítico' && result.isf_score > 54) {
    result = {
      ...result,
      isf_score: 39,
      faixa: 'critico',
      faixa_label: 'Crítico',
      travas_aplicadas: [...(result.travas_aplicadas || []), 'TRAVA_RISK_LEVEL_CRITICO'],
    };
  }

  // ── Trava de dados insuficientes (aplicada por último — vence todas) ──
  if (insufficientData) {
    const motivo = input.ocrIncomplete
      ? `TRAVA_DADOS_INSUFICIENTES: leitura incompleta do documento (${input.ocrPages ? `${input.ocrPages.transcribed}/${input.ocrPages.expected} páginas` : 'OCR parcial'}) — re-executar a leitura.`
      : 'TRAVA_DADOS_INSUFICIENTES: extração não capturou atos registrais nem proprietário — análise sem base. Re-executar a leitura.';
    const fx = classificarFaixaV2_2(20);
    result = {
      ...result,
      isf_score: 20,
      faixa: fx.faixa,
      faixa_label: fx.label,
      faixa_desc: fx.desc,
      faixa_bg: fx.bg,
      faixa_color: fx.color,
      faixa_meter: fx.meter,
      travas_aplicadas: [...(result.travas_aplicadas || []), motivo],
    };
  }

  return { result, dimensoesSource, insufficientData, problemasSincronizados: problemas };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/isf/__tests__/isfVerdict.test.ts`
Expected: PASS (7 testes verdes).

- [ ] **Step 5: Verify no regression + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: tsc exit 0; jest 642 + 7 novos = **649 passando**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/isf/isfVerdict.ts src/lib/isf/__tests__/isfVerdict.test.ts
git commit -m "feat(isf): extrai cauda de julgamento para computeISFVerdict() puro + testes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Drop-in no `route.ts` (refactor comportamento-idêntico)

**Files:**
- Modify: `src/app/api/analyze/route.ts:2099-2204`

**Interfaces:**
- Consumes: `computeISFVerdict` (Task 1).
- Produces: nada novo — preserva `isfResultV2_2` e `parsedProblemas` para o código a jusante (linhas 2206-2287).

- [ ] **Step 1: Adicionar o import**

No topo de `route.ts`, junto aos imports de `./isfEngineV2_2` (ou logo após), adicionar:

```ts
import { computeISFVerdict } from '@/lib/isf/isfVerdict';
```

- [ ] **Step 2: Substituir o bloco inline (2099-2204) pela chamada drop-in**

Apagar TODO o trecho de `route.ts:2099` (comentário `// ── Portão de SUFICIÊNCIA…`) até `2204` (fechamento da trava de dados insuficientes, imediatamente antes de `const payloadV2_2 = prepararPayloadV2_2(isfResultV2_2);`) e substituir por:

```ts
              // Veredito determinístico extraído (ver src/lib/isf/isfVerdict.ts).
              // computeISFVerdict encapsula portão de suficiência, inferência/sync de
              // criticidade, trava de litígio, calcularISFV2_2, tetos externos,
              // guardrail risk_level e trava de dados insuficientes — comportamento idêntico.
              const verdict = computeISFVerdict({
                isfDimensoesFromAI:
                  (matriculaIndividualJsonParsed?.isf_dimensoes as
                    | Record<string, { pontuacao: number; justificativa?: string }>
                    | undefined) ?? null,
                parsedProblemas,
                ocrIncomplete: !!pdfExtractionDiags.ocr_incomplete,
                ocrPages: pdfExtractionDiags.ocr_pages ?? null,
                ehMatriculaModule:
                  normalizedModules.includes('matricula_individual') ||
                  normalizedModules.includes('cadeia_dominial'),
                atosCount:
                  matriculaIndividualJsonParsed &&
                  Array.isArray(matriculaIndividualJsonParsed.atos_registrais)
                    ? matriculaIndividualJsonParsed.atos_registrais.length
                    : null,
                proprietarioNome:
                  (matriculaIndividualJsonParsed?.proprietario_atual?.nome as string | undefined) ?? null,
                cadeiaNaoAuditada,
                riskLevel,
              });
              isfResultV2_2 = verdict.result;
              // Preserva a criticidade sincronizada para persistência (linha ~2277) e ISF v2.1 (~2222).
              parsedProblemas = verdict.problemasSincronizados as typeof parsedProblemas;
```

- [ ] **Step 3: Garantir que `parsedProblemas` é reatribuível**

Se `parsedProblemas` estiver declarado como `const`, alterar sua declaração para `let` (buscar `const parsedProblemas` no arquivo). Se já for `let`, nenhuma mudança. Verificar com:

Run: `grep -n "parsedProblemas" src/app/api/analyze/route.ts | head -5`
Expected: a declaração deve ser `let parsedProblemas` (ajustar se for `const`).

- [ ] **Step 4: Validar zero-regressão (build + lint + tsc + suíte completa)**

Run: `npx tsc --noEmit && npm run lint && npm run build && npm test`
Expected: tsc exit 0; lint 0 erros; build OK; jest **649 passando**.

- [ ] **Step 5: Verificação manual de comportamento (1 análise real)**

Reusar `scripts/e2e-2705.mjs` (existe no repo) OU `scripts/peek-isf2.mjs` para confirmar que uma análise real produz o mesmo `isf_score`/`faixa`/`travas_aplicadas` de antes.

Run: `node scripts/peek-isf2.mjs`
Expected: o veredito da análise de referência inalterado (ex.: 2.705 permanece Inválido/20).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "refactor(analyze): usa computeISFVerdict() como drop-in (comportamento idêntico)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Corpus de fixtures golden + runner bloqueante

**Files:**
- Create: `src/lib/isf/__fixtures__/verdict/2705-fazenda-santa-barbara.json`
- Create: `src/lib/isf/__fixtures__/verdict/27180-usucapiao.json`
- Create: `src/lib/isf/__fixtures__/verdict/26839-execucao-fiscal.json`
- Create: `src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`

**Interfaces:**
- Consumes: `computeISFVerdict` (Task 1).
- Produces: o formato de fixture `{ id, source, label, note, input, expected }` consumido também pelo harvest (Task 4).

- [ ] **Step 1: Write the failing test (runner)**

Criar `src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { computeISFVerdict, type ISFVerdictInput } from '../isfVerdict';

interface Fixture {
  id: string;
  source: string;
  label: 'golden' | 'characterization';
  note?: string;
  input: ISFVerdictInput;
  expected: { isf_score: number; faixa: string; travas_includes?: string[] };
}

const FIXTURES_DIR = path.join(__dirname, '..', '__fixtures__', 'verdict');

function loadFixtures(): Fixture[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf-8')) as Fixture);
}

describe('Proof Engine — portão de regressão (fixtures de veredito)', () => {
  const fixtures = loadFixtures();

  it('há pelo menos as 3 fixtures golden semeadas', () => {
    const golden = fixtures.filter((f) => f.label === 'golden');
    expect(golden.length).toBeGreaterThanOrEqual(3);
  });

  for (const fx of fixtures) {
    it(`[${fx.label}] ${fx.id} → ${fx.expected.isf_score}/${fx.expected.faixa}`, () => {
      const v = computeISFVerdict(fx.input);
      const tag = fx.label === 'golden' ? 'REGRESSÃO DE VERDADE FORENSE' : 'mudança de comportamento';
      expect(v.result.isf_score, `${tag} em ${fx.id} (score)`).toBe(fx.expected.isf_score);
      expect(v.result.faixa, `${tag} em ${fx.id} (faixa)`).toBe(fx.expected.faixa);
      for (const t of fx.expected.travas_includes ?? []) {
        expect(
          v.result.travas_aplicadas.some((x) => x.startsWith(t)),
          `${tag} em ${fx.id}: trava ausente "${t}"`,
        ).toBe(true);
      }
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`
Expected: FAIL — "há pelo menos as 3 fixtures golden" falha (0 fixtures; diretório ainda não existe).

- [ ] **Step 3: Criar as 3 fixtures golden**

`src/lib/isf/__fixtures__/verdict/2705-fazenda-santa-barbara.json`:

```json
{
  "id": "2705-fazenda-santa-barbara",
  "source": "documented:AGENTS.md@2026-06-23",
  "label": "golden",
  "note": "Cancelamento por coisa julgada + restabelecimento CNJ + 2 penhoras fiscais + ação federal. OCR truncou (1/6 páginas) → portão de suficiência trava em Inválido.",
  "input": {
    "isfDimensoesFromAI": null,
    "parsedProblemas": [],
    "ocrIncomplete": true,
    "ocrPages": { "expected": 6, "transcribed": 1 },
    "ehMatriculaModule": true,
    "atosCount": 0,
    "proprietarioNome": "não consta",
    "cadeiaNaoAuditada": false,
    "riskLevel": "Baixo"
  },
  "expected": {
    "isf_score": 20,
    "faixa": "invalido",
    "travas_includes": ["TRAVA_DADOS_INSUFICIENTES"]
  }
}
```

`src/lib/isf/__fixtures__/verdict/27180-usucapiao.json`:

```json
{
  "id": "27180-usucapiao",
  "source": "documented:AGENTS.md@2026-06-20",
  "label": "golden",
  "note": "Matrícula 27.180 Porto Nacional/TO com usucapião averbada (AV-2). Ação de terceiro disputando a propriedade → trava de litígio força D3/D5 ≤ 15 → TRAVA_D3_GRAVAME, teto 39 (Crítico).",
  "input": {
    "isfDimensoesFromAI": { "D1": {"pontuacao": 85}, "D2": {"pontuacao": 85}, "D3": {"pontuacao": 85}, "D4": {"pontuacao": 85}, "D5": {"pontuacao": 85}, "D6": {"pontuacao": 85} },
    "parsedProblemas": [
      { "titulo": "Usucapião averbada (AV-2)", "criticidade": "alto", "descricao": "ação de usucapião por terceiro em andamento sobre o imóvel" }
    ],
    "ocrIncomplete": false,
    "ocrPages": null,
    "ehMatriculaModule": true,
    "atosCount": 4,
    "proprietarioNome": "Investco S/A",
    "cadeiaNaoAuditada": false,
    "riskLevel": "Crítico"
  },
  "expected": {
    "isf_score": 39,
    "faixa": "critico"
  }
}
```

`src/lib/isf/__fixtures__/verdict/26839-execucao-fiscal.json`:

```json
{
  "id": "26839-execucao-fiscal",
  "source": "documented:AGENTS.md@2026-06-20",
  "label": "golden",
  "note": "Matrícula 26.839 Gurupi/TO com penhora em execução fiscal → TRAVA_PENHORA, teto 54 (Alto Risco). D2 preservada (=85).",
  "input": {
    "isfDimensoesFromAI": { "D1": {"pontuacao": 85}, "D2": {"pontuacao": 85}, "D3": {"pontuacao": 60}, "D4": {"pontuacao": 85}, "D5": {"pontuacao": 60}, "D6": {"pontuacao": 85} },
    "parsedProblemas": [
      { "titulo": "Penhora fiscal (AV-4)", "criticidade": "alto", "descricao": "penhora registrada em execução fiscal" }
    ],
    "ocrIncomplete": false,
    "ocrPages": null,
    "ehMatriculaModule": true,
    "atosCount": 5,
    "proprietarioNome": "Idemar José Ferreira",
    "cadeiaNaoAuditada": false,
    "riskLevel": "Alto"
  },
  "expected": {
    "isf_score": 54,
    "faixa": "alto_risco",
    "travas_includes": ["TRAVA_PENHORA"]
  }
}
```

- [ ] **Step 4: Calibrar `expected` ao motor real**

Os scores/travas das fixtures 27.180 e 26.839 dependem das constantes do motor. Rodar e ajustar `expected` ao que o motor REALMENTE produz hoje (caracterização da verdade atual — desde que coerente com o histórico documentado: 27.180 ≤ 39/critico, 26.839 ≤ 54). Se o motor produzir, por exemplo, `TRAVA_GRAVAME_GRAVE` em vez de `TRAVA_PENHORA` no texto da trava, ajustar `travas_includes` para o prefixo real emitido por `detectarGravameGrave`.

Run: `npx jest src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`
Expected: ajustar `expected` até as 3 golden passarem, mantendo a coerência com o histórico (2.705=20/invalido fixo; 27.180 critico; 26.839 alto_risco).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`
Expected: PASS — "≥3 golden" + 3 casos individuais verdes.

- [ ] **Step 6: Suíte completa**

Run: `npm test`
Expected: jest verde (649 + os do runner de fixtures).

- [ ] **Step 7: Commit**

```bash
git add src/lib/isf/__fixtures__/verdict src/lib/isf/__tests__/isfVerdict.fixtures.test.ts
git commit -m "test(isf): seed golden (2.705/27.180/26.839) + runner de fixtures bloqueante

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Script de harvest (caracterização de produção, read-only)

**Files:**
- Create: `scripts/harvest-verdict-fixtures.mjs`

**Interfaces:**
- Consumes: schema da tabela `analyses` (campo `findings` JSON) e o formato de fixture da Task 3.
- Produces: arquivos `src/lib/isf/__fixtures__/verdict/<id>.json` com `label: "characterization"`.

- [ ] **Step 1: Escrever o script de harvest**

Criar `scripts/harvest-verdict-fixtures.mjs` (padrão dos scripts existentes — parseia `.env.local`, usa Supabase Management API/REST com `SUPABASE_SERVICE_ROLE_KEY`, **somente SELECT**):

```js
// Harvest read-only: colhe análises de produção como fixtures de caracterização.
// NÃO escreve em produção. Pula casos sem dados reconstruíveis, logando o motivo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'lib', 'isf', '__fixtures__', 'verdict');

function parseEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  const txt = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = parseEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const LIMIT = Number(process.argv[2] || 25);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

function reconstructInput(findings, status) {
  const v22 = findings?.isf_v2_2;
  if (!v22 || typeof v22.isf_score !== 'number') return { skip: 'sem isf_v2_2 persistido' };
  const mij = findings?.matricula_individual_json;
  const dims = mij?.isf_dimensoes && typeof mij.isf_dimensoes === 'object' ? mij.isf_dimensoes : null;
  const problemas = Array.isArray(findings?.problemas) ? findings.problemas : [];
  if (!dims && problemas.length === 0) return { skip: 'sem dimensões nem problemas reconstruíveis' };
  const diag = findings?.pdf_extraction_diagnostics || {};
  const modules = Array.isArray(findings?.selected_modules) ? findings.selected_modules : [];
  const input = {
    isfDimensoesFromAI: dims || null,
    parsedProblemas: problemas,
    ocrIncomplete: !!diag.ocr_incomplete,
    ocrPages: diag.ocr_pages || null,
    ehMatriculaModule: modules.includes('matricula_individual') || modules.includes('cadeia_dominial'),
    atosCount: mij && Array.isArray(mij.atos_registrais) ? mij.atos_registrais.length : null,
    proprietarioNome: mij?.proprietario_atual?.nome ?? null,
    cadeiaNaoAuditada: !!findings?.cadeiaNaoAuditada,
    riskLevel: findings?.risk_level || findings?.riskLevel || 'Baixo',
  };
  const expected = {
    isf_score: v22.isf_score,
    faixa: v22.faixa,
    travas_includes: Array.isArray(v22.travas_aplicadas)
      ? v22.travas_aplicadas.map((t) => String(t).split(':')[0].trim()).filter(Boolean).slice(0, 3)
      : [],
  };
  return { input, expected };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const url = `${SUPABASE_URL}/rest/v1/analyses?status=eq.completed&select=id,findings,status&order=created_at.desc&limit=${LIMIT}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    console.error(`Supabase HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const rows = await res.json();
  let written = 0;
  const skipped = [];
  for (const row of rows) {
    const r = reconstructInput(row.findings, row.status);
    if (r.skip) {
      skipped.push(`${row.id}: ${r.skip}`);
      continue;
    }
    const id = `prod-${String(row.id).slice(0, 8)}`;
    const fixture = {
      id,
      source: `prod:${row.id}`,
      label: 'characterization',
      note: 'Colhida automaticamente de produção (read-only).',
      input: r.input,
      expected: r.expected,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(fixture, null, 2));
    written++;
  }
  console.log(`Fixtures escritas: ${written}`);
  if (skipped.length) {
    console.log(`Puladas (${skipped.length}):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar o harvest e validar as fixtures colhidas**

Run: `node scripts/harvest-verdict-fixtures.mjs 25`
Expected: imprime "Fixtures escritas: N" (N ≥ 1) e lista puladas com motivo. Sem erro.

- [ ] **Step 3: Garantir que as fixtures colhidas passam no runner**

Run: `npx jest src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`
Expected: PASS — as fixtures de caracterização batem com o veredito atual (por construção). Se alguma falhar, é sinal de que o `expected` colhido foi de uma análise anterior à extração — revisar/excluir essa fixture.

- [ ] **Step 4: Commit**

```bash
git add scripts/harvest-verdict-fixtures.mjs src/lib/isf/__fixtures__/verdict
git commit -m "test(isf): script de harvest read-only + fixtures de caracterização de prod

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Confirmar gate bloqueante no CI

**Files:**
- Verify/Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: o runner de fixtures (Task 3), que já roda dentro de `npm test`.
- Produces: garantia de que um veredito regredido deixa o CI vermelho.

- [ ] **Step 1: Inspecionar o workflow**

Run: `grep -nE "npm (test|run test)|jest" .github/workflows/ci.yml`
Expected: deve haver um passo que executa `npm test`. Como o runner de fixtures está dentro de `npm test`, ele já é coberto.

- [ ] **Step 2: Se NÃO houver `npm test`, adicioná-lo**

Se o passo não existir, acrescentar ao job de validação (após `npm run build`):

```yaml
      - name: Run tests (inclui Proof Engine — portão de regressão)
        run: npm test
```

- [ ] **Step 3: Provar o gate localmente (red/green)**

Editar temporariamente `src/lib/isf/isfVerdict.ts` para quebrar a trava de suficiência (ex.: trocar `score: 20` por `score: 78`), rodar e confirmar que o CI ficaria vermelho:

Run: `npx jest src/lib/isf/__tests__/isfVerdict.fixtures.test.ts`
Expected: FAIL em `2705-fazenda-santa-barbara` com "REGRESSÃO DE VERDADE FORENSE". **Reverter a edição temporária** e confirmar verde de novo.

- [ ] **Step 4: Commit (se houve mudança no ci.yml)**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: garante npm test (Proof Engine) como gate bloqueante

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Camada A determinística → Tasks 1-3. ✓
- Extração `computeISFVerdict` pura → Task 1. ✓
- Drop-in no `route.ts` comportamento-idêntico → Task 2. ✓
- Corpus golden semeado do histórico → Task 3. ✓
- Harvest read-only de prod, pula incompletos com log → Task 4. ✓
- Runner bloqueante no CI → Task 3 (runner) + Task 5 (CI). ✓
- Fronteiras (Camada B, persistência verdict, demais sub-blocos) → fora de escopo, não há task (correto). ✓
- Critério "falso-78 protegido por fixture" → Task 5 Step 3 (prova red/green). ✓

**2. Placeholder scan:** Sem TBD/TODO/"add error handling" vagos. Task 3 Step 4 ("calibrar expected") é uma instrução concreta de ajuste ao motor real, não um placeholder — necessária porque os scores dependem de constantes do motor. ✓

**3. Type consistency:** `computeISFVerdict(input: ISFVerdictInput): ISFVerdict` usado identicamente nas Tasks 1, 2, 3. `VerdictProblema`, `problemasSincronizados`, `dimensoesSource`, `insufficientData` consistentes. O `input` montado na Task 2 bate campo-a-campo com `ISFVerdictInput` da Task 1. O formato de fixture (`id/source/label/note/input/expected`) idêntico entre Task 3 (golden) e Task 4 (harvest). ✓

**Observação para o executor:** a Task 3 Step 4 pode exigir ajuste fino dos `expected` das fixtures 27.180/26.839 ao comportamento real do motor (os textos exatos das travas vêm de `detectarGravameGrave`/`travaPorCriticos`). A fixture 2.705 (20/invalido/TRAVA_DADOS_INSUFICIENTES) é determinística e não deve precisar de ajuste.
