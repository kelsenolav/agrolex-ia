import { computeISFVerdict, buildVerdictRecord, type ISFVerdictInput } from '../isfVerdict';

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

describe('buildVerdictRecord — trilha de auditoria', () => {
  it('registra input + output-chave + proveniência, reexecutável', () => {
    const input = baseInput({
      ocrIncomplete: true,
      ocrPages: { expected: 6, transcribed: 1 },
    });
    const verdict = computeISFVerdict(input);
    const rec = buildVerdictRecord(input, verdict);

    expect(rec.schema_version).toBe(1);
    expect(rec.input).toEqual(input);
    expect(rec.output.isf_score).toBe(verdict.result.isf_score);
    expect(rec.output.faixa).toBe(verdict.result.faixa);
    expect(rec.output.isf_score_bruto).toBe(verdict.result.isf_score_bruto);
    expect(rec.output.travas_aplicadas).toEqual(verdict.result.travas_aplicadas);
    expect(rec.dimensoes_source).toBe(verdict.dimensoesSource);
    expect(rec.insufficient_data).toBe(verdict.insufficientData);
  });

  it('o input gravado reproduz o output ao reexecutar computeISFVerdict (auditável)', () => {
    const input = baseInput({
      isfDimensoesFromAI: null,
      parsedProblemas: [{ titulo: 'Penhora fiscal', criticidade: 'alto', descricao: 'penhora em execução' }],
    });
    const rec = buildVerdictRecord(input, computeISFVerdict(input));
    const replay = computeISFVerdict(rec.input);
    expect(replay.result.isf_score).toBe(rec.output.isf_score);
    expect(replay.result.faixa).toBe(rec.output.faixa);
    expect(replay.result.travas_aplicadas).toEqual(rec.output.travas_aplicadas);
  });
});
