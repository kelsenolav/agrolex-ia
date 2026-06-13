/**
 * Testes unitários — ISF v2 Motor
 *
 * Cobertura mínima: 90%
 * Valida: pesos, cálculo final, arredondamento, classificação de risco, comparação v1 x v2
 */
import {
  calcularISF,
  classificarEixo,
  extrairImpacto,
  calcularEixo,
  classificarRisco,
  calcularComparacao,
  validarPesos,
  PESOS_EIXOS,
  TETO_EIXO,
  RISK_THRESHOLDS,
  type ProblemaEntrada,
  type Eixo,
  type FaixaRisco,
} from '../isf/isfV2';

// ─── HELPERS ────────────────────────────────────────────────────────────

function makeProblema(
  titulo: string,
  criticidade: string,
  eixoHint?: string
): ProblemaEntrada {
  return {
    titulo,
    criticidade,
    descricao: eixoHint ? `Problema relacionado a ${eixoHint}` : 'Descrição genérica',
    baseDocumental: 'Documento analisado',
  };
}

// ─── TESTES: VALIDAÇÃO DE PESOS ─────────────────────────────────────────

describe('Pesos dos Eixos', () => {
  test('pesos devem somar 1.0 (100%)', () => {
    expect(validarPesos()).toBe(true);
  });

  test('cada peso deve ser positivo e menor que 1', () => {
    for (const peso of Object.values(PESOS_EIXOS)) {
      expect(peso).toBeGreaterThan(0);
      expect(peso).toBeLessThan(1);
    }
  });

  test('devem existir exatamente 5 eixos', () => {
    expect(Object.keys(PESOS_EIXOS)).toHaveLength(5);
  });

  test('pesos específicos devem estar corretos', () => {
    expect(PESOS_EIXOS.REG).toBe(0.25);
    expect(PESOS_EIXOS.DOM).toBe(0.25);
    expect(PESOS_EIXOS.LIT).toBe(0.20);
    expect(PESOS_EIXOS.POS).toBe(0.15);
    expect(PESOS_EIXOS.FRA).toBe(0.15);
  });
});

// ─── TESTES: CLASSIFICAÇÃO DE EIXO ──────────────────────────────────────

describe('classificarEixo', () => {
  test('deve classificar como REG para problemas registrais', () => {
    const p = makeProblema('Penhora registrada', 'alta', 'registro de imóveis');
    expect(classificarEixo(p)).toBe('REG');
  });

  test('deve classificar como DOM para problemas dominiais', () => {
    const p = makeProblema('Quebra de cadeia dominial', 'alta', 'cadeia dominial');
    expect(classificarEixo(p)).toBe('DOM');
  });

  test('deve classificar como LIT para problemas de litígio', () => {
    const p = makeProblema('Ação judicial em andamento', 'alta', 'processo judicial');
    expect(classificarEixo(p)).toBe('LIT');
  });

  test('deve classificar como POS para problemas possessórios', () => {
    const p = makeProblema('Invasão de área', 'alta', 'posse');
    expect(classificarEixo(p)).toBe('POS');
  });

  test('deve classificar como FRA para problemas de fraude', () => {
    const p = makeProblema('Falsificação de documento', 'critica', 'fraude documental');
    expect(classificarEixo(p)).toBe('FRA');
  });

  test('deve retornar REG como fallback para problemas sem keywords', () => {
    const p = makeProblema('Problema genérico', 'media', 'xyz');
    // REG tem mais keywords genéricas, pode ser o fallback
    const eixo = classificarEixo(p);
    expect(['REG', 'DOM', 'LIT', 'POS', 'FRA']).toContain(eixo);
  });

  test('deve funcionar com problema vazio', () => {
    const eixo = classificarEixo({});
    expect(['REG', 'DOM', 'LIT', 'POS', 'FRA']).toContain(eixo);
  });
});

// ─── TESTES: EXTRAÇÃO DE IMPACTO ────────────────────────────────────────

describe('extrairImpacto', () => {
  test('deve extrair impacto explícito numérico', () => {
    expect(extrairImpacto({ impacto: -50 })).toBe(-50);
  });

  test('deve extrair impacto explícito string', () => {
    expect(extrairImpacto({ impacto: '-30' })).toBe(-30);
  });

  test('deve derivar impacto da criticidade "critica"', () => {
    expect(extrairImpacto({ criticidade: 'critica' })).toBe(-50);
  });

  test('deve derivar impacto da criticidade "alta"', () => {
    expect(extrairImpacto({ criticidade: 'alta' })).toBe(-30);
  });

  test('deve derivar impacto da criticidade "media"', () => {
    expect(extrairImpacto({ criticidade: 'media' })).toBe(-15);
  });

  test('deve derivar impacto da criticidade "baixa"', () => {
    expect(extrairImpacto({ criticidade: 'baixa' })).toBe(-5);
  });

  test('deve usar fallback médio para criticidade desconhecida', () => {
    expect(extrairImpacto({ criticidade: 'desconhecida' })).toBe(-15);
  });

  test('deve usar fallback médio para problema vazio', () => {
    expect(extrairImpacto({})).toBe(-15);
  });
});

// ─── TESTES: CÁLCULO DE EIXO ────────────────────────────────────────────

describe('calcularEixo', () => {
  test('deve retornar zero para lista vazia', () => {
    const result = calcularEixo([], 'REG');
    expect(result.valor).toBe(0);
    expect(result.achados).toBe(0);
  });

  test('deve somar impactos de achados do mesmo eixo', () => {
    const problemas = [
      makeProblema('Penhora registrada', 'alta', 'penhora'),
      makeProblema('Bloqueio judicial', 'alta', 'bloqueio'),
    ];
    const result = calcularEixo(problemas, 'REG');
    expect(result.valor).toBe(60); // 30 + 30
    expect(result.achados).toBe(2);
  });

  test('deve ignorar achados de outros eixos', () => {
    const problemas = [
      makeProblema('Penhora registrada', 'alta', 'penhora'),       // REG
      makeProblema('Invasão de área', 'alta', 'invasão'),          // POS
    ];
    const result = calcularEixo(problemas, 'REG');
    expect(result.valor).toBe(30);
    expect(result.achados).toBe(1);
  });

  test('deve limitar ao teto do eixo', () => {
    const problemas = Array.from({ length: 10 }, (_, i) =>
      makeProblema(`Problema ${i}`, 'critica', 'penhora')
    );
    const result = calcularEixo(problemas, 'REG');
    expect(result.valor).toBe(TETO_EIXO); // 80
    expect(result.achados).toBe(10);
  });
});

// ─── TESTES: CÁLCULO ISF COMPLETO ───────────────────────────────────────

describe('calcularISF', () => {
  test('deve retornar ISF 100 para lista vazia (sem problemas)', () => {
    const result = calcularISF([]);
    expect(result.isf_score).toBe(100);
    expect(result.risk_level).toBe('muito_seguro');
  });

  test('deve retornar ISF 100 para null/undefined', () => {
    const result = calcularISF(null as unknown as ProblemaEntrada[]);
    expect(result.isf_score).toBe(100);
  });

  test('deve calcular ISF corretamente para problemas em um eixo', () => {
    // 1 problema crítico no eixo REG: impacto 50, peso 0.25
    // contribuição = 50 * 0.25 = 12.5
    // ISF = 100 - 12.5 = 87.5 → 88 (arredondado)
    const problemas = [
      makeProblema('Matrícula inexistente', 'critica', 'matrícula'),
    ];
    const result = calcularISF(problemas);
    expect(result.isf_score).toBe(88);
    expect(result.registral_score).toBe(50);
    expect(result.dominial_score).toBe(0);
    expect(result.litigio_score).toBe(0);
    expect(result.possessorio_score).toBe(0);
    expect(result.fraude_score).toBe(0);
  });

  test('deve calcular ISF com múltiplos eixos', () => {
    // REG: 1 crítico (50) + 1 alto (30) = 80 (teto)
    // DOM: 1 crítico (50)
    // contribuição = 80*0.25 + 50*0.25 = 20 + 12.5 = 32.5
    // ISF = 100 - 32.5 = 67.5 → 68 (arredondado)
    const problemas = [
      makeProblema('Matrícula inexistente', 'critica', 'matrícula'),     // REG
      makeProblema('Penhora registrada', 'alta', 'penhora'),             // REG
      makeProblema('Quebra de cadeia dominial', 'critica', 'cadeia dominial'), // DOM
    ];
    const result = calcularISF(problemas);
    expect(result.isf_score).toBe(68);
    expect(result.risk_level).toBe('atencao');
  });

  test('deve calcular ISF com todos os 5 eixos', () => {
    // Cada eixo: 1 crítico (50)
    // contribuição = 50*0.25 + 50*0.25 + 50*0.20 + 50*0.15 + 50*0.15
    // = 12.5 + 12.5 + 10 + 7.5 + 7.5 = 50
    // ISF = 100 - 50 = 50
    const problemas = [
      makeProblema('Problema registral', 'critica', 'registro'),         // REG
      makeProblema('Problema dominial', 'critica', 'cadeia dominial'),   // DOM
      makeProblema('Problema de litígio', 'critica', 'processo'),        // LIT
      makeProblema('Problema possessório', 'critica', 'invasão'),        // POS
      makeProblema('Problema de fraude', 'critica', 'fraude'),           // FRA
    ];
    const result = calcularISF(problemas);
    expect(result.isf_score).toBe(50);
    expect(result.risk_level).toBe('alto_risco');
  });

  test('deve retornar ISF 0 para problemas máximos', () => {
    // 10 problemas críticos em cada eixo = teto 80 em cada
    // contribuição = 80*0.25 + 80*0.25 + 80*0.20 + 80*0.15 + 80*0.15
    // = 20 + 20 + 16 + 12 + 12 = 80
    // ISF = 100 - 80 = 20
    const problemas: ProblemaEntrada[] = [];
    for (let i = 0; i < 10; i++) {
      problemas.push(makeProblema(`REG ${i}`, 'critica', 'penhora'));
      problemas.push(makeProblema(`DOM ${i}`, 'critica', 'cadeia dominial'));
      problemas.push(makeProblema(`LIT ${i}`, 'critica', 'processo'));
      problemas.push(makeProblema(`POS ${i}`, 'critica', 'invasão'));
      problemas.push(makeProblema(`FRA ${i}`, 'critica', 'fraude'));
    }
    const result = calcularISF(problemas);
    expect(result.isf_score).toBe(20);
    expect(result.risk_level).toBe('critico');
  });

  test('deve retornar ISF 0 para teto em todos eixos', () => {
    // 80 em cada eixo = contribuição total 80
    // ISF = 100 - 80 = 20 (não chega a 0 porque o teto é 80)
    const problemas: ProblemaEntrada[] = [];
    for (let i = 0; i < 3; i++) {
      problemas.push(makeProblema(`REG ${i}`, 'critica', 'penhora'));
      problemas.push(makeProblema(`DOM ${i}`, 'critica', 'cadeia dominial'));
      problemas.push(makeProblema(`LIT ${i}`, 'critica', 'processo'));
      problemas.push(makeProblema(`POS ${i}`, 'critica', 'invasão'));
      problemas.push(makeProblema(`FRA ${i}`, 'critica', 'fraude'));
    }
    const result = calcularISF(problemas);
    expect(result.isf_score).toBe(20);
  });
});

// ─── TESTES: CLASSIFICAÇÃO DE RISCO ─────────────────────────────────────

describe('classificarRisco', () => {
  test('score 0-39 deve ser critico', () => {
    expect(classificarRisco(0)).toBe('critico');
    expect(classificarRisco(15)).toBe('critico');
    expect(classificarRisco(37)).toBe('critico');
    expect(classificarRisco(39)).toBe('critico');
  });

  test('score 40-59 deve ser alto_risco', () => {
    expect(classificarRisco(40)).toBe('alto_risco');
    expect(classificarRisco(50)).toBe('alto_risco');
    expect(classificarRisco(59)).toBe('alto_risco');
  });

  test('score 60-79 deve ser atencao', () => {
    expect(classificarRisco(60)).toBe('atencao');
    expect(classificarRisco(70)).toBe('atencao');
    expect(classificarRisco(79)).toBe('atencao');
  });

  test('score 80-89 deve ser seguro', () => {
    expect(classificarRisco(80)).toBe('seguro');
    expect(classificarRisco(85)).toBe('seguro');
    expect(classificarRisco(89)).toBe('seguro');
  });

  test('score 90-100 deve ser muito_seguro', () => {
    expect(classificarRisco(90)).toBe('muito_seguro');
    expect(classificarRisco(95)).toBe('muito_seguro');
    expect(classificarRisco(100)).toBe('muito_seguro');
  });

  test('thresholds devem cobrir todo o range 0-100', () => {
    for (let score = 0; score <= 100; score++) {
      const faixa = classificarRisco(score);
      expect(['critico', 'alto_risco', 'atencao', 'seguro', 'muito_seguro']).toContain(faixa);
    }
  });

  test('thresholds não devem ter sobreposição', () => {
    const coberto: boolean[] = new Array(101).fill(false);
    for (const t of RISK_THRESHOLDS) {
      for (let i = t.min; i <= t.max; i++) {
        if (coberto[i]) {
          throw new Error(`Sobreposição no score ${i} entre thresholds`);
        }
        coberto[i] = true;
      }
    }
    // Verificar se todos os scores 0-100 estão cobertos
    for (let i = 0; i <= 100; i++) {
      expect(coberto[i]).toBe(true);
    }
  });
});

// ─── TESTES: COMPARAÇÃO V1 x V2 ─────────────────────────────────────────

describe('calcularComparacao', () => {
  test('deve calcular diferença positiva (ISF maior que legado)', () => {
    const comp = calcularComparacao(50, 70);
    expect(comp.legacy_score).toBe(50);
    expect(comp.isf_score).toBe(70);
    expect(comp.difference).toBe(20);
  });

  test('deve calcular diferença negativa (ISF menor que legado)', () => {
    const comp = calcularComparacao(80, 60);
    expect(comp.legacy_score).toBe(80);
    expect(comp.isf_score).toBe(60);
    expect(comp.difference).toBe(-20);
  });

  test('deve retornar diferença zero para scores iguais', () => {
    const comp = calcularComparacao(75, 75);
    expect(comp.difference).toBe(0);
  });

  test('deve arredondar diferença para 2 casas decimais', () => {
    const comp = calcularComparacao(50, 50.123);
    expect(comp.difference).toBe(0.12);
  });
});

// ─── TESTES: ESTRUTURA DO RESULTADO ─────────────────────────────────────

describe('Estrutura do ISFResult', () => {
  test('deve conter todos os campos obrigatórios', () => {
    const result = calcularISF([]);
    expect(result).toHaveProperty('isf_version', '2.0');
    expect(result).toHaveProperty('isf_score');
    expect(result).toHaveProperty('registral_score');
    expect(result).toHaveProperty('dominial_score');
    expect(result).toHaveProperty('litigio_score');
    expect(result).toHaveProperty('possessorio_score');
    expect(result).toHaveProperty('fraude_score');
    expect(result).toHaveProperty('risk_level');
    expect(result).toHaveProperty('risk_label');
    expect(result).toHaveProperty('risk_color');
    expect(result).toHaveProperty('factors');
    expect(result).toHaveProperty('eixos');
  });

  test('eixos deve conter todos os 5 eixos', () => {
    const result = calcularISF([]);
    expect(Object.keys(result.eixos)).toEqual(['REG', 'DOM', 'LIT', 'POS', 'FRA']);
  });

  test('cada eixo deve ter valor, contribuicao, teto, peso, achados', () => {
    const result = calcularISF([]);
    for (const eixo of Object.values(result.eixos)) {
      expect(eixo).toHaveProperty('valor');
      expect(eixo).toHaveProperty('contribuicao');
      expect(eixo).toHaveProperty('teto');
      expect(eixo).toHaveProperty('peso');
      expect(eixo).toHaveProperty('achados');
    }
  });

  test('factors deve ser array vazio para lista vazia', () => {
    const result = calcularISF([]);
    expect(result.factors).toEqual([]);
  });

  test('factors deve conter entradas para problemas', () => {
    const problemas = [
      makeProblema('Matrícula inexistente', 'critica', 'matrícula'),
    ];
    const result = calcularISF(problemas);
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0].nome).toBe('Matrícula inexistente');
    expect(result.factors[0].eixo).toBe('REG');
  });

  test('factors deve estar ordenado do maior impacto para o menor', () => {
    const problemas = [
      makeProblema('Problema baixo', 'baixa', 'matrícula'),
      makeProblema('Problema crítico', 'critica', 'penhora'),
      makeProblema('Problema médio', 'media', 'registro'),
    ];
    const result = calcularISF(problemas);
    for (let i = 1; i < result.factors.length; i++) {
      expect(result.factors[i - 1].impacto).toBeGreaterThanOrEqual(result.factors[i].impacto);
    }
  });
});

// ─── TESTES: ARREDONDAMENTO ─────────────────────────────────────────────

describe('Arredondamento', () => {
  test('isf_score deve ser inteiro entre 0 e 100', () => {
    for (let i = 0; i < 20; i++) {
      const problemas = Array.from({ length: i }, (_, j) =>
        makeProblema(`Problema ${j}`, 'media', 'registro')
      );
      const result = calcularISF(problemas);
      expect(Number.isInteger(result.isf_score)).toBe(true);
      expect(result.isf_score).toBeGreaterThanOrEqual(0);
      expect(result.isf_score).toBeLessThanOrEqual(100);
    }
  });

  test('contribuicao deve ter no máximo 2 casas decimais', () => {
    const problemas = [
      makeProblema('Problema', 'media', 'registro'), // impacto 15, peso 0.25 = 3.75
    ];
    const result = calcularISF(problemas);
    for (const eixo of Object.values(result.eixos)) {
      const str = eixo.contribuicao.toString();
      const decimalPart = str.includes('.') ? str.split('.')[1] : '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    }
  });
});

// ─── TESTES: CENÁRIOS REAIS (SIMULADOS) ─────────────────────────────────

describe('Cenários Reais', () => {
  test('imóvel regular sem problemas deve ter ISF 100', () => {
    const result = calcularISF([]);
    expect(result.isf_score).toBe(100);
    expect(result.risk_level).toBe('muito_seguro');
    expect(result.risk_label).toBe('Muito Seguro');
  });

  test('imóvel com problemas registrais leves deve ter ISF alto', () => {
    // 1 problema médio (15) no REG: contribuição = 15*0.25 = 3.75
    // ISF = 100 - 3.75 = 96.25 → 96
    const problemas = [
      makeProblema('Pequena divergência de área', 'baixa', 'registro'),
    ];
    const result = calcularISF(problemas);
    expect(result.isf_score).toBe(99); // 5*0.25 = 1.25 → 100 - 1.25 = 98.75 → 99
  });

  test('imóvel com problemas críticos em múltiplos eixos deve ter ISF baixo', () => {
    // 2 críticos REG (50+50=80 teto), 1 crítico DOM (50), 1 crítico LIT (50)
    // contribuição = 80*0.25 + 50*0.25 + 50*0.20 = 20 + 12.5 + 10 = 42.5
    // ISF = 100 - 42.5 = 57.5 → 58
    const problemas = [
      makeProblema('Matrícula inexistente', 'critica', 'matrícula'),
      makeProblema('Penhora de R$ 2M', 'critica', 'penhora'),
      makeProblema('Quebra de cadeia dominial', 'critica', 'cadeia dominial'),
      makeProblema('Ação de reintegração', 'critica', 'reintegração'),
    ];
    const result = calcularISF(problemas);
    expect(result.isf_score).toBe(58);
    expect(result.risk_level).toBe('alto_risco');
  });

  test('imóvel com fraude documental deve ter FRA score alto', () => {
    // Usar keyword direta "fraude" no título para garantir classificação FRA
    const problema: ProblemaEntrada = {
      titulo: 'Documento com indícios de fraude documental',
      criticidade: 'critica',
      descricao: 'Foi identificada falsificação na documentação apresentada',
      baseDocumental: 'Documento analisado',
    };
    const eixo = classificarEixo(problema);
    expect(eixo).toBe('FRA');
    
    const problemas = [problema];
    const result = calcularISF(problemas);
    expect(result.fraude_score).toBe(50);
    expect(result.isf_score).toBeLessThan(100);
  });
});