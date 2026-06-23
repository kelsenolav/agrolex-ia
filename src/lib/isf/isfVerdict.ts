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

/**
 * Registro de auditoria do veredito (sub-bloco 1.4). Auto-contido: o `input`
 * reexecutado por computeISFVerdict reproduz o `output` — torna o "porquê" de
 * um ISF reconstruível e verificável meses depois. Persistido em
 * findings.isf_verdict (o `computed_at` é acrescentado no route.ts).
 */
export interface ISFVerdictRecord {
  schema_version: 1;
  input: ISFVerdictInput;
  output: {
    isf_score: number;
    faixa: string;
    isf_score_bruto: number;
    travas_aplicadas: string[];
  };
  dimensoes_source: 'ai_json' | 'inferred';
  insufficient_data: boolean;
}

export function buildVerdictRecord(input: ISFVerdictInput, verdict: ISFVerdict): ISFVerdictRecord {
  return {
    schema_version: 1,
    input,
    output: {
      isf_score: verdict.result.isf_score,
      faixa: verdict.result.faixa,
      isf_score_bruto: verdict.result.isf_score_bruto,
      travas_aplicadas: verdict.result.travas_aplicadas,
    },
    dimensoes_source: verdict.dimensoesSource,
    insufficient_data: verdict.insufficientData,
  };
}

/**
 * Veredito determinístico do ISF v2.2 — função pura extraída de
 * src/app/api/analyze/route.ts (cauda de julgamento, comportamento idêntico).
 *
 * Encadeia: portão de suficiência → origem das dimensões (IA explícita ou
 * inferência por keyword + sync de criticidade) → trava de litígio de
 * propriedade → calcularISFV2_2 → tetos externos (gravame/críticos/cadeia
 * não auditada) → guardrail risk_level Crítico → trava de dados insuficientes
 * (vence todas). Sem I/O, sem async, sem mutação da entrada.
 */
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
    const inferred = inferirPontuacoesDeAchados(problemas as never);
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
  if (detectarLitigioPropriedade(problemas as never)) {
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
  const gravame = detectarGravameGrave(problemas as never);
  if (gravame) tetosExternos.push(gravame);
  const tCriticos = travaPorCriticos(problemas as never);
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
