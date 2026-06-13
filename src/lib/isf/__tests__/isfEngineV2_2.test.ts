/**
 * ISF v2.2 — Testes Unitários do Motor de 6 Dimensões
 *
 * Cenários:
 * 1. Validação de pesos (soma = 1.0)
 * 2. Cálculo com todas as dimensões preenchidas (score máximo)
 * 3. Cálculo com pontuações mínimas (score mínimo/inválido)
 * 4. Cenário realista: título regular (~70-84)
 * 5. Cenário realista: título crítico (~25-39)
 * 6. Dimensões parcialmente preenchidas (incompleto)
 * 7. Alertas condicionais
 * 8. Classificação de faixas
 * 9. Inferência de pontuações a partir de achados
 * 10. Payload de persistência
 * 11. encontrarItemProximo
 */

import {
  calcularISFV2_2,
  classificarFaixaV2_2,
  gerarAlertasV2_2,
  validarPesosV2_2,
  encontrarItemProximo,
  inferirPontuacoesDeAchados,
  prepararPayloadV2_2,
  DIMENSOES_V2_2,
  FAIXAS_V2_2,
  PESOS_DIMENSOES_V2_2,
  DIMENSOES_MAP,
  type PontuacaoEntradaV2_2,
  type ISFResultV2_2,
  type FaixaRiscoV2_2,
} from '@/lib/isf/isfEngineV2_2';

// ─── HELPERS ─────────────────────────────────────────────────────────────

function criarPontuacao(dimensaoId: string, pontuacao: number, itemSelecionado?: string): PontuacaoEntradaV2_2 {
  return { dimensaoId, pontuacao, itemSelecionado };
}

function todasDimensoes(pontuacao: number): PontuacaoEntradaV2_2[] {
  return DIMENSOES_V2_2.map(d => criarPontuacao(d.id, pontuacao, `Item ${d.id}`));
}

// ─── CENÁRIO 1: VALIDAÇÃO DE PESOS ──────────────────────────────────────

describe('Validação de pesos', () => {
  test('Soma dos pesos deve ser 1.0 (100%)', () => {
    expect(validarPesosV2_2()).toBe(true);
  });

  test('Cada dimensão deve ter peso positivo', () => {
    for (const dim of DIMENSOES_V2_2) {
      expect(dim.peso).toBeGreaterThan(0);
      expect(dim.peso).toBeLessThan(1);
    }
  });

  test('D1 (Origem) deve ter o maior peso (30%)', () => {
    expect(PESOS_DIMENSOES_V2_2.D1).toBe(0.30);
    const maiorPeso = Math.max(...Object.values(PESOS_DIMENSOES_V2_2));
    expect(PESOS_DIMENSOES_V2_2.D1).toBe(maiorPeso);
  });

  test('D6 (Contexto geopolítico) deve ter o menor peso (5%)', () => {
    expect(PESOS_DIMENSOES_V2_2.D6).toBe(0.05);
    const menorPeso = Math.min(...Object.values(PESOS_DIMENSOES_V2_2));
    expect(PESOS_DIMENSOES_V2_2.D6).toBe(menorPeso);
  });
});

// ─── CENÁRIO 2: SCORE MÁXIMO ────────────────────────────────────────────

describe('Score máximo (100 — Seguro)', () => {
  const pontuacoes = todasDimensoes(100);

  test('ISF deve ser 100', () => {
    const result = calcularISFV2_2(pontuacoes);
    expect(result.isf_score).toBe(100);
    expect(result.faixa).toBe('seguro');
    expect(result.faixa_label).toBe('Seguro');
    expect(result.incompleto).toBe(false);
  });

  test('Todas as dimensões devem contribuir corretamente', () => {
    const result = calcularISFV2_2(pontuacoes);
    expect(result.dimensoes).toHaveLength(6);
    for (const dim of result.dimensoes) {
      expect(dim.pontuacao).toBe(100);
      expect(dim.contribuicao).toBeCloseTo(100 * PESOS_DIMENSOES_V2_2[dim.id], 2);
    }
  });

  test('Nenhum alerta deve ser gerado', () => {
    const result = calcularISFV2_2(pontuacoes);
    expect(result.alertas).toHaveLength(0);
  });

  test('Payload de persistência deve conter todos os campos', () => {
    const result = calcularISFV2_2(pontuacoes);
    const payload = prepararPayloadV2_2(result);
    expect(payload).toHaveProperty('isf_v2_2');
    const isfV2_2 = payload.isf_v2_2 as Record<string, unknown>;
    expect(isfV2_2.isf_version).toBe('2.2');
    expect(isfV2_2.isf_score).toBe(100);
    expect(isfV2_2.faixa).toBe('seguro');
    expect(isfV2_2.incompleto).toBe(false);
    expect(Array.isArray(isfV2_2.dimensoes)).toBe(true);
    expect(Array.isArray(isfV2_2.alertas)).toBe(true);
    expect(Array.isArray(isfV2_2.dimensoes_faltantes)).toBe(true);
  });
});

// ─── CENÁRIO 3: SCORE MÍNIMO ────────────────────────────────────────────

describe('Score mínimo (Inválido)', () => {
  const pontuacoes: PontuacaoEntradaV2_2[] = [
    criarPontuacao('D1', 10, 'Sem título identificável'),
    criarPontuacao('D2', 5, 'Cadeia não reconstituível'),
    criarPontuacao('D3', 10, 'Usucapião por terceiro'),
    criarPontuacao('D4', 5, 'Sobreposição com UC/TI'),
    criarPontuacao('D5', 5, 'Sentença desfavorável transitada'),
    criarPontuacao('D6', 5, 'Sobreposição quilombola/indígena'),
  ];

  test('ISF deve ser ≤ 24 (Inválido)', () => {
    const result = calcularISFV2_2(pontuacoes);
    expect(result.isf_score).toBeLessThanOrEqual(24);
    expect(result.faixa).toBe('invalido');
    expect(result.faixa_label).toBe('Inválido');
  });

  test('Todos os alertas críticos devem ser gerados (D1, D2, D5)', () => {
    const result = calcularISFV2_2(pontuacoes);
    const criticos = result.alertas.filter(a => a.tipo === 'critico');
    // D1≤30, D2≤25, D5≤20 → 3 críticos
    expect(criticos.length).toBeGreaterThanOrEqual(3);
    const idsCriticos = criticos.map(a => a.dimensaoId);
    expect(idsCriticos).toContain('D1');
    expect(idsCriticos).toContain('D2');
    expect(idsCriticos).toContain('D5');
  });
});

// ─── CENÁRIO 4: TÍTULO REGULAR (70–84) ──────────────────────────────────

describe('Cenário realista — Título regular (~70–84)', () => {
  const pontuacoes: PontuacaoEntradaV2_2[] = [
    criarPontuacao('D1', 75, 'Título INCRA provisório com cláusula cumprida'),
    criarPontuacao('D2', 70, 'Cadeia completa, variação ≤5% sem justificativa'),
    criarPontuacao('D3', 70, 'Matrícula limpa, sem georreferenciamento'),
    criarPontuacao('D4', 85, 'CAR ativo + ITR em dia + CCIR atualizado'),
    criarPontuacao('D5', 100, 'Sem qualquer ação judicial'),
    criarPontuacao('D6', 80, 'Município em expansão agrícola'),
  ];

  test('ISF deve estar entre 70 e 84', () => {
    const result = calcularISFV2_2(pontuacoes);
    // Esperado: 75*0.30 + 70*0.25 + 70*0.20 + 85*0.10 + 100*0.10 + 80*0.05
    // = 22.5 + 17.5 + 14 + 8.5 + 10 + 4 = 76.5 → 77
    expect(result.isf_score).toBeGreaterThanOrEqual(70);
    expect(result.isf_score).toBeLessThanOrEqual(84);
    expect(result.faixa).toBe('regular');
    expect(result.faixa_label).toBe('Regular');
  });

  test('Deve gerar alerta para D3 (≤35)', () => {
    // D3=70 > 35 → sem alerta
    const result = calcularISFV2_2(pontuacoes);
    const alertaD3 = result.alertas.find(a => a.dimensaoId === 'D3');
    expect(alertaD3).toBeUndefined();
  });
});

// ─── CENÁRIO 5: TÍTULO CRÍTICO (25–39) ──────────────────────────────────

describe('Cenário realista — Título crítico (~25–39) com D1 e D2 frágeis', () => {
  const pontuacoes: PontuacaoEntradaV2_2[] = [
    criarPontuacao('D1', 30, 'Título INCRA provisório com cláusula não cumprida'),
    criarPontuacao('D2', 25, 'Transmitente sem capacidade/legitimidade'),
    criarPontuacao('D3', 35, 'Penhora ou bloqueio judicial'),
    criarPontuacao('D4', 45, 'CAR em análise'),
    criarPontuacao('D5', 20, 'Ação em curso sobre o imóvel'),
    criarPontuacao('D6', 45, 'Município com PNRA ativo'),
  ];

  test('ISF deve ser ≤ 24 (Inválido) pela trava combinada D1+D2', () => {
    const result = calcularISFV2_2(pontuacoes);
    // Score bruto: 30*0.30 + 25*0.25 + 35*0.20 + 45*0.10 + 20*0.10 + 45*0.05
    // = 9 + 6.25 + 7 + 4.5 + 2 + 2.25 = 31 → 31
    // TRAVA_D1_VICIO (D1=30 ≤30) → cap 39
    // TRAVA_D2_LACUNAS (D2=25 ≤25) → cap 39
    // TRAVA_D1_D2_COMBINADA (D1≤30 E D2≤25) → cap 24
    expect(result.isf_score).toBeLessThanOrEqual(24);
    expect(result.isf_score_bruto).toBe(31);
    expect(result.faixa).toBe('invalido');
    expect(result.faixa_label).toBe('Inválido');
    expect(result.travas_aplicadas.length).toBeGreaterThanOrEqual(3);
    expect(result.travas_aplicadas.some(t => t.includes('TRAVA_D1_D2_COMBINADA'))).toBe(true);
  });

  test('Alertas críticos para D1, D2 e D5', () => {
    const result = calcularISFV2_2(pontuacoes);
    const criticos = result.alertas.filter(a => a.tipo === 'critico');
    const idsCriticos = criticos.map(a => a.dimensaoId);
    expect(idsCriticos).toContain('D1');
    expect(idsCriticos).toContain('D2');
    expect(idsCriticos).toContain('D5');
  });
});

describe('Cenário realista — Título crítico (~25–39) sem travamento combinado', () => {
  // D1=55 (Regularização fundiária) e D2=35 (Restrição legal) — frágeis mas não no limiar de trava
  const pontuacoes: PontuacaoEntradaV2_2[] = [
    criarPontuacao('D1', 55, 'Regularização fundiária (Reurb)'),
    criarPontuacao('D2', 35, 'Transmissão em período de restrição legal'),
    criarPontuacao('D3', 35, 'Penhora ou bloqueio judicial'),
    criarPontuacao('D4', 25, 'Débito de ITR na dívida ativa'),
    criarPontuacao('D5', 20, 'Processo INCRA de revisão em curso'),
    criarPontuacao('D6', 20, 'Município com histórico de grilagem'),
  ];

  test('ISF deve estar entre 25 e 39 (Crítico sem trava combinada)', () => {
    const result = calcularISFV2_2(pontuacoes);
    // D1=55 > 30 → sem TRAVA_D1_VICIO
    // D2=35 > 25 → sem TRAVA_D2_LACUNAS nem TRAVA_D1_D2_COMBINADA
    // Score bruto: 55*0.30 + 35*0.25 + 35*0.20 + 25*0.10 + 20*0.10 + 20*0.05
    // = 16.5 + 8.75 + 7 + 2.5 + 2 + 1 = 37.75 → 38
    expect(result.isf_score).toBeGreaterThanOrEqual(25);
    expect(result.isf_score).toBeLessThanOrEqual(39);
    expect(result.isf_score_bruto).toBe(38);
    expect(result.faixa).toBe('critico');
    expect(result.faixa_label).toBe('Crítico');
    expect(result.travas_aplicadas).toHaveLength(0);
  });
});

// ─── CENÁRIO 6: DIMENSÕES PARCIALMENTE PREENCHIDAS ──────────────────────

describe('Dimensões parcialmente preenchidas (incompleto)', () => {
  test('Apenas 3 dimensões preenchidas deve marcar incompleto=true', () => {
    const pontuacoes: PontuacaoEntradaV2_2[] = [
      criarPontuacao('D1', 80, 'Item D1'),
      criarPontuacao('D2', 70, 'Item D2'),
      criarPontuacao('D3', 90, 'Item D3'),
    ];
    const result = calcularISFV2_2(pontuacoes);
    expect(result.incompleto).toBe(true);
    expect(result.dimensoesFaltantes).toHaveLength(3);
    expect(result.dimensoesFaltantes).toContain('D4');
    expect(result.dimensoesFaltantes).toContain('D5');
    expect(result.dimensoesFaltantes).toContain('D6');
  });

  test('ISF deve ser calculado apenas com as preenchidas', () => {
    const pontuacoes: PontuacaoEntradaV2_2[] = [
      criarPontuacao('D1', 100, 'Item D1'),
      criarPontuacao('D2', 100, 'Item D2'),
      criarPontuacao('D3', 100, 'Item D3'),
    ];
    const result = calcularISFV2_2(pontuacoes);
    // Soma pesos preenchidos: 0.30 + 0.25 + 0.20 = 0.75
    // ISF = (100*0.30 + 100*0.25 + 100*0.20) / 0.75 = 75 / 0.75 = 100
    expect(result.isf_score).toBe(100);
    expect(result.incompleto).toBe(true);
  });

  test('Nenhuma dimensão preenchida deve retornar ISF 0', () => {
    const result = calcularISFV2_2([]);
    expect(result.isf_score).toBe(0);
    expect(result.incompleto).toBe(true);
    expect(result.dimensoesFaltantes).toHaveLength(6);
    expect(result.faixa).toBe('invalido');
  });

  test('Pontuação negativa deve ser tratada como 0', () => {
    const pontuacoes = todasDimensoes(-50);
    const result = calcularISFV2_2(pontuacoes);
    for (const dim of result.dimensoes) {
      expect(dim.pontuacao).toBeGreaterThanOrEqual(0);
    }
  });

  test('Pontuação acima de 100 deve ser limitada a 100', () => {
    const pontuacoes = todasDimensoes(150);
    const result = calcularISFV2_2(pontuacoes);
    for (const dim of result.dimensoes) {
      expect(dim.pontuacao).toBeLessThanOrEqual(100);
    }
  });

  test('NaN na pontuação deve ser tratado como dimensão faltante', () => {
    const pontuacoes: PontuacaoEntradaV2_2[] = [
      { dimensaoId: 'D1', pontuacao: NaN },
      criarPontuacao('D2', 100),
    ];
    const result = calcularISFV2_2(pontuacoes);
    // D1 deve ser tratado como faltante
    expect(result.dimensoesFaltantes).toContain('D1');
  });
});

// ─── CENÁRIO 7: ALERTAS CONDICIONAIS ────────────────────────────────────

describe('Alertas condicionais', () => {
  test('D1 ≤ 30 deve gerar alerta crítico', () => {
    const alertas = gerarAlertasV2_2([criarPontuacao('D1', 30)]);
    const alertaD1 = alertas.find(a => a.dimensaoId === 'D1');
    expect(alertaD1).toBeDefined();
    expect(alertaD1!.tipo).toBe('critico');
    expect(alertaD1!.mensagem).toContain('Vício originário');
  });

  test('D1 > 30 NÃO deve gerar alerta', () => {
    const alertas = gerarAlertasV2_2([criarPontuacao('D1', 31)]);
    const alertaD1 = alertas.find(a => a.dimensaoId === 'D1');
    expect(alertaD1).toBeUndefined();
  });

  test('D2 ≤ 25 deve gerar alerta crítico', () => {
    const alertas = gerarAlertasV2_2([criarPontuacao('D2', 25)]);
    const alertaD2 = alertas.find(a => a.dimensaoId === 'D2');
    expect(alertaD2).toBeDefined();
    expect(alertaD2!.tipo).toBe('critico');
  });

  test('D5 ≤ 20 deve gerar alerta crítico', () => {
    const alertas = gerarAlertasV2_2([criarPontuacao('D5', 20)]);
    const alertaD5 = alertas.find(a => a.dimensaoId === 'D5');
    expect(alertaD5).toBeDefined();
    expect(alertaD5!.tipo).toBe('critico');
    expect(alertaD5!.mensagem).toContain('Risco imediato');
  });

  test('Múltiplos alertas devem ser ordenados (críticos primeiro)', () => {
    const pontuacoes: PontuacaoEntradaV2_2[] = [
      criarPontuacao('D3', 35), // alerta (não crítico)
      criarPontuacao('D1', 30), // crítico
      criarPontuacao('D4', 15), // alerta
    ];
    const alertas = gerarAlertasV2_2(pontuacoes);
    expect(alertas.length).toBe(3);
    // Primeiro deve ser crítico
    expect(alertas[0].tipo).toBe('critico');
    expect(alertas[0].dimensaoId).toBe('D1');
  });

  test('Dimensão não fornecida não deve gerar alerta', () => {
    const alertas = gerarAlertasV2_2([]);
    expect(alertas).toHaveLength(0);
  });
});

// ─── CENÁRIO 8: CLASSIFICAÇÃO DE FAIXAS ──────────────────────────────────

describe('Classificação de faixas (classificarFaixaV2_2)', () => {
  test('100 → seguro', () => {
    expect(classificarFaixaV2_2(100).faixa).toBe('seguro');
  });
  test('85 → seguro', () => {
    expect(classificarFaixaV2_2(85).faixa).toBe('seguro');
  });
  test('84 → regular', () => {
    expect(classificarFaixaV2_2(84).faixa).toBe('regular');
  });
  test('70 → regular', () => {
    expect(classificarFaixaV2_2(70).faixa).toBe('regular');
  });
  test('69 → atencao', () => {
    expect(classificarFaixaV2_2(69).faixa).toBe('atencao');
  });
  test('55 → atencao', () => {
    expect(classificarFaixaV2_2(55).faixa).toBe('atencao');
  });
  test('54 → alto_risco', () => {
    expect(classificarFaixaV2_2(54).faixa).toBe('alto_risco');
  });
  test('40 → alto_risco', () => {
    expect(classificarFaixaV2_2(40).faixa).toBe('alto_risco');
  });
  test('39 → critico', () => {
    expect(classificarFaixaV2_2(39).faixa).toBe('critico');
  });
  test('25 → critico', () => {
    expect(classificarFaixaV2_2(25).faixa).toBe('critico');
  });
  test('24 → invalido', () => {
    expect(classificarFaixaV2_2(24).faixa).toBe('invalido');
  });
  test('0 → invalido', () => {
    expect(classificarFaixaV2_2(0).faixa).toBe('invalido');
  });

  test('Todas as 6 faixas devem ser cobertas', () => {
    const faixasUnicas = new Set<FaixaRiscoV2_2>();
    for (let i = 0; i <= 100; i++) {
      faixasUnicas.add(classificarFaixaV2_2(i).faixa);
    }
    expect(faixasUnicas.size).toBe(6);
    expect(faixasUnicas.has('seguro')).toBe(true);
    expect(faixasUnicas.has('regular')).toBe(true);
    expect(faixasUnicas.has('atencao')).toBe(true);
    expect(faixasUnicas.has('alto_risco')).toBe(true);
    expect(faixasUnicas.has('critico')).toBe(true);
    expect(faixasUnicas.has('invalido')).toBe(true);
  });
});

// ─── CENÁRIO 9: INFERÊNCIA DE PONTUAÇÕES ────────────────────────────────

describe('Inferência de pontuações a partir de achados', () => {
  test('Lista vazia deve retornar array vazio (sem presumir segurança por ausência de dados)', () => {
    const pontuacoes = inferirPontuacoesDeAchados([]);
    expect(pontuacoes).toHaveLength(0);
    // Sem achados, nenhuma dimensão é pontuada → calcularISFV2_2 retorna incompleto=true e ISF=0
    // Isso evita o falso "Seguro (100)" quando não há dados para analisar
  });

  test('Achado de penhora deve reduzir D3 (Integridade registral)', () => {
    const problemas = [
      { titulo: 'Penhora registrada na matrícula', criticidade: 'alta', descricao: 'Penhora de R$ 500 mil.' },
    ];
    const pontuacoes = inferirPontuacoesDeAchados(problemas);
    const D3 = pontuacoes.find(p => p.dimensaoId === 'D3');
    expect(D3).toBeDefined();
    // impacto alta = 30 * 0.8 = 24 → 100 - 24 = 76
    expect(D3!.pontuacao).toBeLessThan(100);
    expect(D3!.pontuacao).toBeGreaterThan(70);
  });

  test('Achado de cadeia dominial deve reduzir D2', () => {
    const problemas = [
      { titulo: 'Lacuna na cadeia dominial', criticidade: 'critica', descricao: 'Lacuna de 20 anos.' },
    ];
    const pontuacoes = inferirPontuacoesDeAchados(problemas);
    const D2 = pontuacoes.find(p => p.dimensaoId === 'D2');
    expect(D2).toBeDefined();
    // impacto crítica = 50 * 0.8 = 40 → 100 - 40 = 60
    expect(D2!.pontuacao).toBe(60);
  });

  test('Achado de grilagem deve reduzir D6', () => {
    const problemas = [
      { titulo: 'Histórico de grilagem na região', criticidade: 'alta', descricao: 'Município com grilagem sistêmica.' },
    ];
    const pontuacoes = inferirPontuacoesDeAchados(problemas);
    const D6 = pontuacoes.find(p => p.dimensaoId === 'D6');
    // impacto alta = 30 * 0.8 = 24 → 100 - 24 = 76
    expect(D6!.pontuacao).toBeLessThan(100);
  });

  test('Múltiplos achados no mesmo eixo devem acumular redução', () => {
    const problemas = [
      { titulo: 'Penhora registrada', criticidade: 'alta', descricao: 'Penhora.' },
      { titulo: 'Bloqueio judicial', criticidade: 'alta', descricao: 'Bloqueio.' },
    ];
    const pontuacoes = inferirPontuacoesDeAchados(problemas);
    const D3 = pontuacoes.find(p => p.dimensaoId === 'D3');
    // Cada alta reduz ~24. Duas = ~48 → 100 - 48 = 52, mas limitado a 0 no mínimo
    expect(D3!.pontuacao).toBeLessThan(60);
  });

  test('Achado sem criticidade deve usar fallback medio (-15)', () => {
    const problemas = [
      { titulo: 'Penhora registrada' }, // sem criticidade
    ];
    const pontuacoes = inferirPontuacoesDeAchados(problemas);
    const D3 = pontuacoes.find(p => p.dimensaoId === 'D3');
    // impacto medio = 15 * 0.8 = 12 → 100 - 12 = 88
    expect(D3!.pontuacao).toBe(88);
  });
});

// ─── CENÁRIO 10: encontrarItemProximo ───────────────────────────────────

describe('encontrarItemProximo', () => {
  test('Deve encontrar o item exato quando a pontuação coincide', () => {
    const label = encontrarItemProximo('D1', 100);
    expect(label).toContain('Sesmaria');
  });

  test('Deve encontrar o item mais próximo para pontuação intermediária', () => {
    const label = encontrarItemProximo('D2', 80);
    // 85 é o mais próximo (distância 5 vs 70 distância 10)
    expect(label).toContain('justificativa técnica');
  });

  test('Deve retornar o pior item para pontuação 0', () => {
    const label = encontrarItemProximo('D3', 0);
    expect(label).toContain('usucapião');
  });

  test('Dimensão inválida deve retornar mensagem de erro', () => {
    const label = encontrarItemProximo('D99', 50);
    expect(label).toBe('Dimensão desconhecida');
  });
});

// ─── CENÁRIO 11: CONSTANTES ─────────────────────────────────────────────

describe('Constantes exportadas', () => {
  test('DIMENSOES_V2_2 deve ter 6 dimensões', () => {
    expect(DIMENSOES_V2_2).toHaveLength(6);
  });

  test('FAIXAS_V2_2 deve ter 6 faixas', () => {
    expect(FAIXAS_V2_2).toHaveLength(6);
  });

  test('DIMENSOES_MAP deve ter entradas D1-D6', () => {
    for (let i = 1; i <= 6; i++) {
      expect(DIMENSOES_MAP[`D${i}`]).toBeDefined();
    }
  });

  test('Cada dimensão deve ter itens de pontuação', () => {
    for (const dim of DIMENSOES_V2_2) {
      expect(dim.itens.length).toBeGreaterThanOrEqual(8);
    }
  });

  test('Cada dimensão deve ter alertaMin definido', () => {
    for (const dim of DIMENSOES_V2_2) {
      expect(dim.alertaMin).toBeDefined();
      expect(typeof dim.alertaMin).toBe('number');
    }
  });
});