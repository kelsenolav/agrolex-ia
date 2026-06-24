import {
  classificarAchadoSemantico,
  critiqueAchados,
  detectContradicoes,
} from '../semanticGuards';

describe('classificarAchadoSemantico — guard de negação/ausência', () => {
  it('ausência inequívoca → "ausencia"', () => {
    expect(classificarAchadoSemantico({ titulo: 'Ônus', descricao: 'Não consta nenhum ônus na matrícula' })).toBe('ausencia');
    expect(classificarAchadoSemantico({ titulo: 'Litígio', descricao: 'Não há registro de ação real' })).toBe('ausencia');
    expect(classificarAchadoSemantico({ descricao: 'Imóvel livre de ônus e desembaraçado' })).toBe('ausencia');
  });

  it('"não há usucapião" NÃO é problema (não rebaixa)', () => {
    expect(classificarAchadoSemantico({ titulo: 'Usucapião', descricao: 'Não há usucapião averbada ou em curso' })).toBe('ausencia');
  });

  it('litígio resolvido a favor do proprietário → "favoravel"', () => {
    expect(classificarAchadoSemantico({ descricao: 'Ação transitada em julgado a favor do proprietário' })).toBe('favoravel');
    expect(classificarAchadoSemantico({ descricao: 'Usucapião do proprietário já registrada (AV-3)' })).toBe('favoravel');
  });

  it('ARMADILHA "cancelado": hipoteca/penhora cancelada → favoravel', () => {
    expect(classificarAchadoSemantico({ titulo: 'Hipoteca', descricao: 'Hipoteca cedular cancelada (R-5)' })).toBe('favoravel');
    expect(classificarAchadoSemantico({ descricao: 'Penhora baixada por ordem judicial' })).toBe('favoravel');
  });

  it('ARMADILHA "cancelado": MATRÍCULA cancelada por coisa julgada → problema GRAVE (não suprime)', () => {
    expect(classificarAchadoSemantico({ titulo: 'Cancelamento', descricao: 'Matrícula cancelada por coisa julgada' })).toBe('problema');
    expect(classificarAchadoSemantico({ descricao: 'Registro cancelado por decisão transitada' })).toBe('problema');
  });

  it('problema real (presente) continua problema', () => {
    expect(classificarAchadoSemantico({ titulo: 'Penhora fiscal', descricao: 'Penhora registrada em execução fiscal' })).toBe('problema');
    expect(classificarAchadoSemantico({ descricao: 'Usucapião por terceiro em andamento' })).toBe('problema');
    expect(classificarAchadoSemantico({ descricao: 'Indisponibilidade de bens decretada' })).toBe('problema');
  });

  it('achado vazio → problema (conservador)', () => {
    expect(classificarAchadoSemantico({})).toBe('problema');
  });
});

describe('critiqueAchados — crítica determinística (B2)', () => {
  it('remove duplicados exatos', () => {
    const r = critiqueAchados([
      { titulo: 'Penhora', descricao: 'penhora fiscal' },
      { titulo: 'Penhora', descricao: 'penhora fiscal' },
    ]);
    expect(r.validados).toHaveLength(1);
    expect(r.removidos).toHaveLength(1);
    expect(r.removidos[0].motivo).toBe('duplicado');
  });

  it('remove recomendação-disfarçada-de-achado (título começa com verbo de recomendação)', () => {
    const r = critiqueAchados([
      { titulo: 'Recomenda-se obter CCIR atualizado', descricao: 'para regularização' },
      { titulo: 'Penhora fiscal', descricao: 'penhora vigente' },
    ]);
    expect(r.validados).toHaveLength(1);
    expect(r.validados[0].titulo).toBe('Penhora fiscal');
    expect(r.removidos[0].motivo).toBe('recomendacao_disfarcada');
  });

  it('mantém achado com base documental vaga (conservador — não remove)', () => {
    const r = critiqueAchados([{ titulo: 'Ônus', descricao: 'consta ônus', baseDocumental: 'matrícula' }]);
    expect(r.validados).toHaveLength(1);
    expect(r.removidos).toHaveLength(0);
  });
});

describe('detectContradicoes — B5 #1 e #2', () => {
  it('flagra divergência risk_level × faixa ISF', () => {
    const c = detectContradicoes({
      riskLevel: 'Alto', faixaRiskLevel: 'Baixo', isfScore: 75,
      documentosFaltantes: [], problemas: [],
    });
    expect(c.some((x) => x.tipo === 'risk_level_vs_isf')).toBe(true);
  });

  it('não flagra quando risk_level == faixa', () => {
    const c = detectContradicoes({
      riskLevel: 'Baixo', faixaRiskLevel: 'Baixo', isfScore: 75,
      documentosFaltantes: [], problemas: [],
    });
    expect(c.some((x) => x.tipo === 'risk_level_vs_isf')).toBe(false);
  });

  it('flagra doc-faltante × achado que cita como presente (CAR ativo vs CAR faltante)', () => {
    const c = detectContradicoes({
      riskLevel: 'Baixo', faixaRiskLevel: 'Baixo', isfScore: 80,
      documentosFaltantes: ['CAR (Cadastro Ambiental Rural)'],
      problemas: [{ titulo: 'Ambiental', descricao: 'CAR ativo e regular' }],
    });
    expect(c.some((x) => x.tipo === 'doc_faltante_vs_presente')).toBe(true);
  });
});
