/**
 * Testes — isfExplainer.ts
 *
 * SPRINT 3 — EXPLICABILIDADE ISF v2
 *
 * 10 casos de teste obrigatórios:
 * 1. ISF indisponível
 * 2. ISF completo
 * 3. Top fatores ordenados
 * 4. Sem fatores
 * 5. Todos os 5 eixos
 * 6. Leituras por faixa
 * 7. Comparação equivalente
 * 8. ISF mais rigoroso
 * 9. ISF mais favorável
 * 10. Estrutura inválida
 */

import {
  gerarExplicabilidadeISF,
  gerarLeituraEixo,
  gerarLeituraComparacao,
  gerarFraseExecutiva,
} from '../isf/isfExplainer';

// ─── DADOS DE TESTE ──────────────────────────────────────────────────

const isfV2Completo: Record<string, unknown> = {
  isf_version: '2.0',
  isf_score: 47,
  registral_score: 65,
  dominial_score: 45,
  litigio_score: 80,
  possessorio_score: 0,
  fraude_score: 0,
  risk_level: 'alto_risco',
  risk_label: 'Alto Risco',
  risk_color: '#F97316',
  factors: [
    {
      nome: 'Fraude documental',
      eixo: 'FRA',
      impacto: 50,
      criticidade: 'critica',
      descricao: 'Falsificação de matrícula confirmada',
    },
    {
      nome: 'Quebra de cadeia dominial',
      eixo: 'DOM',
      impacto: 45,
      criticidade: 'alta',
      descricao: 'Lacuna de 12 anos na cadeia (1999–2011)',
    },
    {
      nome: 'Penhora registrada',
      eixo: 'REG',
      impacto: 35,
      criticidade: 'alta',
      descricao: 'Penhora no valor de R$ 500.000,00',
    },
    {
      nome: 'Ação de reintegração de posse',
      eixo: 'LIT',
      impacto: 30,
      criticidade: 'media',
      descricao: 'Processo em tramitação na 3ª Vara Cível',
    },
    {
      nome: 'Ocupação irregular',
      eixo: 'POS',
      impacto: 20,
      criticidade: 'media',
      descricao: 'Famílias ocupando área desde 2018',
    },
  ],
  eixos: {
    REG: { valor: 65, contribuicao: 16.25, teto: 80, peso: 0.25, achados: 1 },
    DOM: { valor: 45, contribuicao: 11.25, teto: 80, peso: 0.25, achados: 1 },
    LIT: { valor: 80, contribuicao: 16.0, teto: 80, peso: 0.2, achados: 1 },
    POS: { valor: 0, contribuicao: 0.0, teto: 80, peso: 0.15, achados: 0 },
    FRA: { valor: 0, contribuicao: 0.0, teto: 80, peso: 0.15, achados: 0 },
  },
};

const isfV2SemFatores: Record<string, unknown> = {
  isf_version: '2.0',
  isf_score: 92,
  registral_score: 10,
  dominial_score: 5,
  litigio_score: 0,
  possessorio_score: 0,
  fraude_score: 0,
  risk_level: 'muito_seguro',
  risk_label: 'Muito Seguro',
  risk_color: '#10B981',
  factors: [],
  eixos: {
    REG: { valor: 10, contribuicao: 2.5, teto: 80, peso: 0.25, achados: 1 },
    DOM: { valor: 5, contribuicao: 1.25, teto: 80, peso: 0.25, achados: 1 },
    LIT: { valor: 0, contribuicao: 0, teto: 80, peso: 0.2, achados: 0 },
    POS: { valor: 0, contribuicao: 0, teto: 80, peso: 0.15, achados: 0 },
    FRA: { valor: 0, contribuicao: 0, teto: 80, peso: 0.15, achados: 0 },
  },
};

const scoreComparisonEquivalente: Record<string, unknown> = {
  legacy_score: 50,
  isf_score: 47,
  difference: -3,
};

const scoreComparisonRigoroso: Record<string, unknown> = {
  legacy_score: 64,
  isf_score: 32,
  difference: -32,
};

const scoreComparisonFavoravel: Record<string, unknown> = {
  legacy_score: 30,
  isf_score: 55,
  difference: 25,
};

// ─── TESTE 1: ISF INDISPONÍVEL ────────────────────────────────────────

describe('isfExplainer', () => {
  test('1. ISF indisponível deve retornar disponivel=false', () => {
    const result = gerarExplicabilidadeISF(null, null);
    expect(result.disponivel).toBe(false);
    expect(result.resumo).toBe(
      'Explicabilidade ISF v2 ainda não disponível para esta análise.'
    );
  });

  test('ISF undefined deve retornar disponivel=false', () => {
    const result = gerarExplicabilidadeISF(undefined, undefined);
    expect(result.disponivel).toBe(false);
  });

  // ─── TESTE 2: ISF COMPLETO ──────────────────────────────────────────

  test('2. ISF completo deve retornar dados normalizados', () => {
    const result = gerarExplicabilidadeISF(isfV2Completo, null);
    expect(result.disponivel).toBe(true);
    expect(result.score).toBe(47);
    expect(result.classificacao).toBe('Alto Risco');
    expect(result.resumo).toContain('ISF 47');
    expect(result.topFatores).toHaveLength(5);
    expect(result.eixos).toHaveLength(5);
  });

  // ─── TESTE 3: TOP FATORES ORDENADOS ─────────────────────────────────

  test('3. Top fatores devem estar ordenados por impacto decrescente', () => {
    const result = gerarExplicabilidadeISF(isfV2Completo, null);
    const fatores = result.topFatores!;
    for (let i = 0; i < fatores.length - 1; i++) {
      expect(fatores[i].impacto).toBeGreaterThanOrEqual(fatores[i + 1].impacto);
    }
    expect(fatores[0].nome).toBe('Fraude documental');
    expect(fatores[0].impacto).toBe(50);
  });

  // ─── TESTE 4: SEM FATORES ───────────────────────────────────────────

  test('4. Sem fatores deve exibir mensagem de nenhum fator', () => {
    const result = gerarExplicabilidadeISF(isfV2SemFatores, null);
    expect(result.topFatores).toHaveLength(0);
    expect(result.resumo).toContain('Nenhum fator relevante');
  });

  // ─── TESTE 5: TODOS OS 5 EIXOS ──────────────────────────────────────

  test('5. Deve retornar todos os 5 eixos com dados corretos', () => {
    const result = gerarExplicabilidadeISF(isfV2Completo, null);
    const eixos = result.eixos!;
    expect(eixos).toHaveLength(5);

    const eixoReg = eixos.find(e => e.eixo === 'Registral');
    expect(eixoReg).toBeDefined();
    expect(eixoReg!.valor).toBe(65);
    expect(eixoReg!.contribuicao).toBe(16.25);
    expect(eixoReg!.peso).toBe(0.25);

    const eixoPos = eixos.find(e => e.eixo === 'Possessório');
    expect(eixoPos).toBeDefined();
    expect(eixoPos!.valor).toBe(0);
    expect(eixoPos!.achados).toBe(0);
  });

  // ─── TESTE 6: LEITURAS POR FAIXA ────────────────────────────────────

  test('6. Leituras por faixa de valor do eixo', () => {
    expect(gerarLeituraEixo(0)).toBe('Eixo sem impacto relevante');
    expect(gerarLeituraEixo(10)).toBe('Eixo sem impacto relevante');
    expect(gerarLeituraEixo(24)).toBe('Eixo sem impacto relevante');
    expect(gerarLeituraEixo(25)).toBe('Atenção leve — observar evolução');
    expect(gerarLeituraEixo(49)).toBe('Atenção leve — observar evolução');
    expect(gerarLeituraEixo(50)).toBe('Atenção moderada — requer monitoramento');
    expect(gerarLeituraEixo(69)).toBe('Atenção moderada — requer monitoramento');
    expect(gerarLeituraEixo(70)).toBe('Impacto elevado — requer ação corretiva');
    expect(gerarLeituraEixo(84)).toBe('Impacto elevado — requer ação corretiva');
    expect(gerarLeituraEixo(85)).toBe('Impacto crítico — requer ação imediata');
    expect(gerarLeituraEixo(100)).toBe('Impacto crítico — requer ação imediata');
  });

  // ─── TESTE 7: COMPARAÇÃO EQUIVALENTE ────────────────────────────────

  test('7. Comparação com diferença entre -5 e +5 deve ser equivalente', () => {
    const result = gerarExplicabilidadeISF(isfV2Completo, scoreComparisonEquivalente);
    expect(result.comparacao).toBeDefined();
    expect(result.comparacao!.difference).toBe(-3);
    expect(result.comparacao!.leitura).toContain('resultado equivalente');
  });

  // ─── TESTE 8: ISF MAIS RIGOROSO ─────────────────────────────────────

  test('8. ISF v2 mais rigoroso que score legado', () => {
    const result = gerarExplicabilidadeISF(isfV2Completo, scoreComparisonRigoroso);
    expect(result.comparacao).toBeDefined();
    expect(result.comparacao!.legacyScore).toBe(64);
    expect(result.comparacao!.isfScore).toBe(32);
    expect(result.comparacao!.difference).toBe(-32);
    expect(result.comparacao!.leitura).toContain('mais rigoroso');
  });

  // ─── TESTE 9: ISF MAIS FAVORÁVEL ────────────────────────────────────

  test('9. ISF v2 mais favorável que score legado', () => {
    const result = gerarExplicabilidadeISF(isfV2Completo, scoreComparisonFavoravel);
    expect(result.comparacao).toBeDefined();
    expect(result.comparacao!.legacyScore).toBe(30);
    expect(result.comparacao!.isfScore).toBe(55);
    expect(result.comparacao!.difference).toBe(25);
    expect(result.comparacao!.leitura).toContain('mais favorável');
  });

  // ─── TESTE 10: ESTRUTURA INVÁLIDA ───────────────────────────────────

  test('10. Estrutura inválida deve retornar disponivel=false', () => {
    const invalido = { isf_score: 'invalido', risk_level: 123 };
    const result = gerarExplicabilidadeISF(invalido as unknown as Record<string, unknown>, null);
    expect(result.disponivel).toBe(false);

    const semEixos = { isf_score: 50, risk_level: 'seguro' };
    const result2 = gerarExplicabilidadeISF(semEixos as unknown as Record<string, unknown>, null);
    expect(result2.disponivel).toBe(false);
  });

  // ─── TESTES ADICIONAIS: FUNÇÕES AUXILIARES ─────────────────────────

  test('gerarLeituraComparacao com diferença <= 5', () => {
    const leitura = gerarLeituraComparacao(50, 47, -3);
    expect(leitura).toContain('equivalente');
  });

  test('gerarFraseExecutiva com fatores deve mencionar eixos', () => {
    const fatores = [
      { nome: 'Fraude', eixo: 'Fraude', impacto: 50, criticidade: 'critica', descricao: '' },
      { nome: 'Penhora', eixo: 'Registral', impacto: 35, criticidade: 'alta', descricao: '' },
    ];
    const frase = gerarFraseExecutiva(47, 'Alto Risco', fatores);
    expect(frase).toContain('ISF 47');
    expect(frase).toContain('Alto Risco');
    expect(frase).toContain('achados');
  });

  test('gerarFraseExecutiva sem fatores', () => {
    const frase = gerarFraseExecutiva(92, 'Muito Seguro', []);
    expect(frase).toContain('Nenhum fator relevante');
  });

  test('Comparação com difference = 0', () => {
    const leitura = gerarLeituraComparacao(50, 50, 0);
    expect(leitura).toContain('equivalente');
  });

  test('Score comparison ausente não deve gerar comparacao', () => {
    const result = gerarExplicabilidadeISF(isfV2Completo, null);
    expect(result.comparacao).toBeUndefined();
  });

  test('Score comparison com dados parciais não deve gerar comparacao', () => {
    const parcial = { legacy_score: 50 };
    const result = gerarExplicabilidadeISF(
      isfV2Completo,
      parcial as unknown as Record<string, unknown>
    );
    expect(result.comparacao).toBeUndefined();
  });
});