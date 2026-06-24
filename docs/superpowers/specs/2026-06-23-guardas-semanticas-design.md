# Guardas Semânticas (crítica + contradições + negação)

> **Eixo 1 — Blindar o núcleo · Sub-bloco 1.3**
> Data: 2026-06-23 · Branch: `stable/rebuild-beta-01-laudo-compartilhavel`
> Depende de: 1.1 (Proof Engine / `computeISFVerdict`) e 1.4 (trilha de auditoria).

## 1. Problema (buracos B2 e B5)

- **B2** — o caminho JSON estruturado (matrícula/cadeia, o principal) **pula a crítica de achados** (`runAchadosCritique` só roda no texto-livre, [route.ts:1980](src/app/api/analyze/route.ts)). Achados-ruído (duplicados, recomendação-disfarçada) entram no scoring sem filtro.
- **B5** — três contradições não detectadas: (1) `risk_level` × `isf_score` divergem; (2) `documentosFaltantes` × achado que cita o doc como presente (CAR ativo vs CAR faltante) — sem cruzamento; (3) **contexto negativo**: `inferirPontuacoesDeAchados` faz keyword-match sem regex de negação geral → "**não há** usucapião" rebaixa o score indevidamente.

## 2. Postura (decisão jurídica do usuário)

**Corrigir conservador:** nunca deixar uma inconsistência **inflar** o laudo; **desfazer** um rebaixamento **indevido** (bug de negativa); quando ambíguo, tratar como problema. Toda mudança de veredito é coberta por fixture golden do Proof Engine.

## 3. Componentes

Novo módulo **`src/lib/isf/semanticGuards.ts`** (puro, testável), com 3 funções, integrado a `computeISFVerdict` (G1+G2) e ao `route.ts` (G3).

### Guarda 1 — Negação/Ausência
`classificarAchadoSemantico(achado): 'problema' | 'ausencia' | 'favoravel'`
- **Whitelist de ausência inequívoca**: `não consta`, `nada consta`, `não há`, `inexiste`/`inexistência de`, `não foi identificad`, `sem registro de`, `sem ônus`, `livre de ônus`, `livre e desembaraçad`, `ausência de`, `isento de`, `não averbad`.
- **Litígio resolvido a favor**: `transitad[ao] em julgado a favor d[oa] proprietári`, `julgad[ao] improcedente`, `usucapião d[oe]/pel[oa] proprietári`, `usucapião já registrad`.
- **Regra de contexto (mão-dupla)**: `(ônus|hipoteca|penhora|gravame|arresto|sequestro|indisponibilidade)…(cancelad|baixad|extint|liberad|quitad)` → `favoravel`; `(matrícula|registro|título)…cancelad` → `problema` (grave); ambíguo → `problema` (conservador).
- A negação só vence se a frase de ausência/favorável **dominar** o achado e **não** houver marcador de problema grave (matrícula cancelada, penhora vigente etc.).

### Guarda 2 — Crítica determinística (fecha B2)
`critiqueAchados(problemas): { validados: VerdictProblema[]; removidos: Array<{ achado: VerdictProblema; motivo: string }> }`
- Remove **duplicados exatos** (mesmo título+descrição normalizados) e **recomendação-disfarçada-de-achado** (`/recomenda-se|sugere-se|sugiro|deve-se (obter|verificar|solicitar)/i` sem fato).
- **Conservador**: NÃO remove por "base documental vaga" (mantém + sinaliza em `removidos` só os dois casos acima). Sem LLM (não carrega a cascata degradada; auditável).

### Guarda 3 — Contradições + reconciliação (fecha B5 #1 e #2)
`detectContradicoes(args): Contradicao[]`, onde `args = { riskLevel, isfScore, faixa, documentosFaltantes, problemas }`.
- **(a)** `risk_level` × faixa ISF: se divergem, registra contradição. Reconciliação no `route.ts`: `risk_level` persistido = `faixaParaRiskLevel(isf_score)` (fonte única; o ISF já carrega todas as travas → nunca infla).
- **(b)** doc-faltante × achado-presente: se um achado afirma um doc presente/ativo (ex.: "CAR ativo") e `documentosFaltantes` lista o mesmo doc, registra contradição. **Sinaliza apenas** (mantém "faltante" — é o seguro).
- Persiste `findings.contradicoes` para o laudo.

## 4. Integração

### Em `computeISFVerdict` (isfVerdict.ts) — G1 + G2
1. `critiqueAchados(problemas)` → `validados` (dedup + remove recomendação-disfarçada).
2. `scoringProblemas = validados.filter(p => classificarAchadoSemantico(p) === 'problema')`.
3. **Deduções** (`inferirPontuacoesDeAchados`, `detectarGravameGrave`, `travaPorCriticos`, `detectarLitigioPropriedade`) usam `scoringProblemas`.
4. **Portão de suficiência mantém `problemas` ORIGINAL** (`problemas.length`) — não tocar o gatilho do falso-78.
5. `ISFVerdict` ganha `removidos` e `naoPontuantes` (metadados de auditoria); `problemasSincronizados = validados`.

### Em `route.ts` — G3
Após o veredito: `detectContradicoes(...)` → `findings.contradicoes`; reconcilia `risk_level` à faixa do ISF na persistência.

## 5. Garantias e cobertura

- **4 golden atuais inalteradas** (validado: 2.705/72c13e14 sem achados → no-op; 27.180 usucapião-de-terceiro e 26.839 penhora são problemas reais → mantidos).
- **Novas golden** para cada mudança de veredito: "não há usucapião" → score NÃO rebaixa; "matrícula cancelada por coisa julgada" → rebaixa (grave); "hipoteca cancelada" → favorável; achado duplicado → não infla além da evidência.
- Fixtures `prod-*` (characterization, locais) re-sincronizadas via `REGEN_FIXTURES=1`.

## 6. Não-objetivos
- ❌ Crítica via LLM no caminho JSON (usamos determinística — mais barata, auditável, não carrega a cascata).
- ❌ UI das contradições (só persistência; exibição é outro passo).
- ❌ Remover doc de `documentosFaltantes` (só sinaliza — conservador).

## 7. Governança / validação
- Classe D (muda veredito), mas determinístico + coberto pela rede de regressão + postura conservadora. Rollback por commit.
- Validação: `tsc`, `lint`, `build`, `jest` (todas verdes; +golden +unit).

## 8. Critérios de aceite
1. `semanticGuards.ts` puro e testado (negação incl. armadilha "cancelado", crítica, contradições).
2. G1+G2 em `computeISFVerdict`; G3 + reconciliação no `route.ts`.
3. Golden novas provam cada mudança de veredito; 4 golden originais intactas.
4. `risk_level` persistido nunca contradiz a faixa do ISF.
5. Zero regressão (suíte verde).
