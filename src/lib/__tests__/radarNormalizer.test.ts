/**
 * Testes do Radar Normalizer — SPRINT 2 RADAR v2
 *
 * Cobre:
 * 1. Todos os 5 eixos
 * 2. Valores mínimos
 * 3. Valores máximos
 * 4. Threshold crítico (>= 70)
 * 5. Threshold alto risco (>= 50 e < 70)
 * 6. Threshold atenção (>= 25 e < 50)
 * 7. Threshold seguro (0-24)
 * 8. Threshold muito seguro (n/a — radar usa apenas 4 níveis)
 * 9. Ausência de ISF (null/undefined)
 * 10. Estrutura inválida
 */

import {
  normalizarRadarISF,
  classificarNivelRadar,
  pctBarraRadar,
  validarEstruturaISF,
  RADAR_CORES,
  RADAR_LABEL_NIVEL,
  RADAR_NIVEL_THRESHOLDS,
  type ISFEixosInput,
  type RadarEixoNormalizado,
} from '@/lib/isf/radarNormalizer';

// ─── DADOS DE TESTE ────────────────────────────────────────────────────

const DADOS_COMPLETOS: ISFEixosInput = {
  isf_score: 55,
  registral_score: 82,
  dominial_score: 71,
  litigio_score: 90,
  possessorio_score: 60,
  fraude_score: 45,
};

const DADOS_ZERADOS: ISFEixosInput = {
  isf_score: 100,
  registral_score: 0,
  dominial_score: 0,
  litigio_score: 0,
  possessorio_score: 0,
  fraude_score: 0,
};

const DADOS_MAXIMOS: ISFEixosInput = {
  isf_score: 0,
  registral_score: 100,
  dominial_score: 100,
  litigio_score: 100,
  possessorio_score: 100,
  fraude_score: 100,
};

// ─── TESTE 1: TODOS OS 5 EIXOS ─────────────────────────────────────────

describe('normalizarRadarISF — 5 eixos', () => {
  test('deve retornar exatamente 5 eixos', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS);
    expect(resultado).not.toBeNull();
    expect(resultado).toHaveLength(5);
  });

  test('deve conter Registral, Dominial, Litígio, Possessório, Fraude', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS)!;
    const labels = resultado.map(r => r.eixo);
    expect(labels).toContain('Registral');
    expect(labels).toContain('Dominial');
    expect(labels).toContain('Litígio');
    expect(labels).toContain('Possessório');
    expect(labels).toContain('Fraude');
  });

  test('cada eixo deve ter codigo, valor, nivel, cor, labelNivel', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS)!;
    for (const eixo of resultado) {
      expect(eixo).toHaveProperty('codigo');
      expect(eixo).toHaveProperty('valor');
      expect(eixo).toHaveProperty('nivel');
      expect(eixo).toHaveProperty('cor');
      expect(eixo).toHaveProperty('labelNivel');
      expect(['REG', 'DOM', 'LIT', 'POS', 'FRA']).toContain(eixo.codigo);
    }
  });
});

// ─── TESTE 2: VALORES MÍNIMOS ─────────────────────────────────────────

describe('normalizarRadarISF — valores mínimos', () => {
  test('deve retornar todos os eixos com valor 0 quando ISF é zerado', () => {
    const resultado = normalizarRadarISF(DADOS_ZERADOS)!;
    for (const eixo of resultado) {
      expect(eixo.valor).toBe(0);
    }
  });

  test('todos os eixos zerados devem ser "baixo"', () => {
    const resultado = normalizarRadarISF(DADOS_ZERADOS)!;
    for (const eixo of resultado) {
      expect(eixo.nivel).toBe('baixo');
      expect(eixo.labelNivel).toBe('Baixo');
      expect(eixo.cor).toBe(RADAR_CORES.baixo);
    }
  });
});

// ─── TESTE 3: VALORES MÁXIMOS ─────────────────────────────────────────

describe('normalizarRadarISF — valores máximos', () => {
  test('deve retornar todos os eixos com valor 100 quando ISF é máximo', () => {
    const resultado = normalizarRadarISF(DADOS_MAXIMOS)!;
    for (const eixo of resultado) {
      expect(eixo.valor).toBe(100);
    }
  });

  test('todos os eixos com valor 100 devem ser "critico"', () => {
    const resultado = normalizarRadarISF(DADOS_MAXIMOS)!;
    for (const eixo of resultado) {
      expect(eixo.nivel).toBe('critico');
      expect(eixo.labelNivel).toBe('Crítico');
      expect(eixo.cor).toBe(RADAR_CORES.critico);
    }
  });
});

// ─── TESTE 4: THRESHOLD CRÍTICO (>= 70) ───────────────────────────────

describe('classificarNivelRadar — crítico', () => {
  test('valor 70 deve ser crítico', () => {
    expect(classificarNivelRadar(70)).toBe('critico');
  });

  test('valor 85 deve ser crítico', () => {
    expect(classificarNivelRadar(85)).toBe('critico');
  });

  test('valor 100 deve ser crítico', () => {
    expect(classificarNivelRadar(100)).toBe('critico');
  });
});

// ─── TESTE 5: THRESHOLD ALTO RISCO (>= 50 e < 70) ─────────────────────

describe('classificarNivelRadar — alto', () => {
  test('valor 50 deve ser alto', () => {
    expect(classificarNivelRadar(50)).toBe('alto');
  });

  test('valor 69 deve ser alto', () => {
    expect(classificarNivelRadar(69)).toBe('alto');
  });

  test('valor 50-69 deve ser alto', () => {
    for (let v = 50; v <= 69; v++) {
      expect(classificarNivelRadar(v)).toBe('alto');
    }
  });
});

// ─── TESTE 6: THRESHOLD ATENÇÃO (>= 25 e < 50) ────────────────────────

describe('classificarNivelRadar — médio (atenção)', () => {
  test('valor 25 deve ser médio', () => {
    expect(classificarNivelRadar(25)).toBe('medio');
  });

  test('valor 49 deve ser médio', () => {
    expect(classificarNivelRadar(49)).toBe('medio');
  });

  test('valor 25-49 deve ser médio', () => {
    for (let v = 25; v <= 49; v++) {
      expect(classificarNivelRadar(v)).toBe('medio');
    }
  });
});

// ─── TESTE 7: THRESHOLD SEGURO (0-24) ─────────────────────────────────

describe('classificarNivelRadar — baixo (seguro)', () => {
  test('valor 0 deve ser baixo', () => {
    expect(classificarNivelRadar(0)).toBe('baixo');
  });

  test('valor 24 deve ser baixo', () => {
    expect(classificarNivelRadar(24)).toBe('baixo');
  });

  test('valor 0-24 deve ser baixo', () => {
    for (let v = 0; v <= 24; v++) {
      expect(classificarNivelRadar(v)).toBe('baixo');
    }
  });
});

// ─── TESTE 8: THRESHOLD MUITO SEGURO (não aplicável — radar usa 4 níveis)

describe('classificarNivelRadar — cobertura completa', () => {
  test('todos os valores 0-100 devem ser classificados em 4 níveis', () => {
    for (let v = 0; v <= 100; v++) {
      const nivel = classificarNivelRadar(v);
      expect(['baixo', 'medio', 'alto', 'critico']).toContain(nivel);
    }
  });

  test('thresholds devem estar em ordem decrescente', () => {
    for (let i = 1; i < RADAR_NIVEL_THRESHOLDS.length; i++) {
      expect(RADAR_NIVEL_THRESHOLDS[i].min).toBeLessThan(RADAR_NIVEL_THRESHOLDS[i - 1].min);
    }
  });
});

// ─── TESTE 9: AUSÊNCIA DE ISF ─────────────────────────────────────────

describe('normalizarRadarISF — ausência de ISF', () => {
  test('deve retornar null quando isfV2 é null', () => {
    expect(normalizarRadarISF(null)).toBeNull();
  });

  test('deve retornar null quando isfV2 é undefined', () => {
    expect(normalizarRadarISF(undefined)).toBeNull();
  });

  test('deve retornar null quando isfV2 é objeto vazio', () => {
    expect(normalizarRadarISF({} as ISFEixosInput)).toBeNull();
  });

  test('deve retornar null quando faltam eixos', () => {
    const parcial = { isf_score: 50, registral_score: 50 } as ISFEixosInput;
    expect(normalizarRadarISF(parcial)).toBeNull();
  });
});

// ─── TESTE 10: ESTRUTURA INVÁLIDA ─────────────────────────────────────

describe('validarEstruturaISF — validação', () => {
  test('deve validar estrutura correta', () => {
    expect(validarEstruturaISF(DADOS_COMPLETOS)).toBe(true);
  });

  test('deve rejeitar null', () => {
    expect(validarEstruturaISF(null)).toBe(false);
  });

  test('deve rejeitar string', () => {
    expect(validarEstruturaISF('invalido')).toBe(false);
  });

  test('deve rejeitar objeto sem campos obrigatórios', () => {
    expect(validarEstruturaISF({ foo: 'bar' })).toBe(false);
  });

  test('deve rejeitar objeto com valores não-numéricos', () => {
    expect(validarEstruturaISF({
      registral_score: 'alta',
      dominial_score: 'alta',
      litigio_score: 'alta',
      possessorio_score: 'alta',
      fraude_score: 'alta',
    } as unknown as ISFEixosInput)).toBe(false);
  });
});

// ─── TESTE ADICIONAL: pctBarraRadar ────────────────────────────────────

describe('pctBarraRadar', () => {
  test('deve retornar o valor quando entre 0-100', () => {
    expect(pctBarraRadar(50)).toBe(50);
  });

  test('deve limitar a 0 quando negativo', () => {
    expect(pctBarraRadar(-10)).toBe(0);
  });

  test('deve limitar a 100 quando maior que 100', () => {
    expect(pctBarraRadar(150)).toBe(100);
  });

  test('deve funcionar com 0', () => {
    expect(pctBarraRadar(0)).toBe(0);
  });

  test('deve funcionar com 100', () => {
    expect(pctBarraRadar(100)).toBe(100);
  });
});

// ─── TESTE DE INTEGRAÇÃO: valores reais do ISF v2 ─────────────────────

describe('normalizarRadarISF — integração com dados reais', () => {
  test('deve mapear registral_score 82 para nível crítico', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS)!;
    const registral = resultado.find(r => r.codigo === 'REG')!;
    expect(registral.valor).toBe(82);
    expect(registral.nivel).toBe('critico');
    expect(registral.labelNivel).toBe('Crítico');
  });

  test('deve mapear dominial_score 71 para nível crítico', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS)!;
    const dominial = resultado.find(r => r.codigo === 'DOM')!;
    expect(dominial.valor).toBe(71);
    expect(dominial.nivel).toBe('critico');
  });

  test('deve mapear litigio_score 90 para nível crítico', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS)!;
    const litigio = resultado.find(r => r.codigo === 'LIT')!;
    expect(litigio.valor).toBe(90);
    expect(litigio.nivel).toBe('critico');
  });

  test('deve mapear possessorio_score 60 para nível alto', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS)!;
    const posse = resultado.find(r => r.codigo === 'POS')!;
    expect(posse.valor).toBe(60);
    expect(posse.nivel).toBe('alto');
  });

  test('deve mapear fraude_score 45 para nível médio', () => {
    const resultado = normalizarRadarISF(DADOS_COMPLETOS)!;
    const fraude = resultado.find(r => r.codigo === 'FRA')!;
    expect(fraude.valor).toBe(45);
    expect(fraude.nivel).toBe('medio');
  });
});