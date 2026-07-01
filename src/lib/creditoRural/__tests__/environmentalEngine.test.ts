import { verificarConformidadeAmbiental, type EnvironmentalInput } from '../environmentalEngine';

function baseInput(over: Partial<EnvironmentalInput> = {}): EnvironmentalInput {
  return {
    uf: 'GO',
    area_total_ha: 100,
    embargo_ibama: false,
    ...over,
  };
}

describe('environmentalEngine', () => {
  it('embargo IBAMA → não conforme (bloqueio total)', () => {
    const r = verificarConformidadeAmbiental(baseInput({ embargo_ibama: true }));
    expect(r.status).toBe('nao_conforme');
    expect(r.impacto_credito.toUpperCase()).toContain('BLOQUEIO');
  });

  it('alertas PRODES recentes → não conforme', () => {
    const r = verificarConformidadeAmbiental(baseInput({
      alertas_prodes: [{ ano: new Date().getFullYear(), area_ha: 10, bioma: 'Cerrado', fonte: 'PRODES' }],
    }));
    expect(r.status).toBe('nao_conforme');
    expect(r.alertas_desmatamento.length).toBe(1);
  });

  it('sem dados → status sem_dados com recomendações de consulta oficial', () => {
    const r = verificarConformidadeAmbiental(baseInput());
    expect(r.status).toBe('sem_dados');
    expect(r.recomendacoes.length).toBeGreaterThan(0);
  });

  it('reserva legal não averbada → verificação necessária', () => {
    const r = verificarConformidadeAmbiental(baseInput({ reserva_legal_averbada: false }));
    expect(['verificacao_necessaria', 'nao_conforme']).toContain(r.status);
  });

  it('HONESTIDADE: fonte sempre autodeclarada e API não verificada', () => {
    const r = verificarConformidadeAmbiental(baseInput({ reserva_legal_averbada: true }));
    expect(r.fonte_dados).toBe('autodeclarado');
    expect(r.prodes_verificado_api).toBe(false);
    expect(r.disclaimer.toLowerCase()).toContain('autodeclarado');
  });

  it('sempre retorna resoluções aplicáveis', () => {
    const r = verificarConformidadeAmbiental(baseInput({ embargo_ibama: true }));
    expect(r.resolucoes_aplicaveis.length).toBeGreaterThan(0);
  });

  // ─── Verificação ao vivo (TerraBrasilis/SICAR) ───────────────────────────

  it('desmatamento verificado ao vivo e sem alertas → conforme (não cai em sem_dados)', () => {
    const r = verificarConformidadeAmbiental(baseInput({ desmatamento_verificado_api: true }));
    expect(r.status).not.toBe('sem_dados');
    expect(r.fonte_dados).toBe('parcial_api');
    expect(r.prodes_verificado_api).toBe(true);
  });

  it('CAR verificado ao vivo (status ativo, sem outros achados) → não fica em sem_dados', () => {
    const r = verificarConformidadeAmbiental(baseInput({ car_verificado_api: true, car_status: 'ativo' }));
    expect(r.status).not.toBe('sem_dados');
    expect(r.fonte_dados).toBe('parcial_api');
    expect(r.car_verificado_api).toBe(true);
  });

  it('CAR cancelado no SICAR → não conforme', () => {
    const r = verificarConformidadeAmbiental(baseInput({ car_verificado_api: true, car_status: 'cancelado' }));
    expect(r.status).toBe('nao_conforme');
  });

  it('CAR suspenso no SICAR → não conforme', () => {
    const r = verificarConformidadeAmbiental(baseInput({ car_verificado_api: true, car_status: 'suspenso' }));
    expect(r.status).toBe('nao_conforme');
  });

  it('CAR pendente → verificação necessária (não bloqueia totalmente)', () => {
    const r = verificarConformidadeAmbiental(baseInput({ car_verificado_api: true, car_status: 'pendente' }));
    expect(r.status).toBe('verificacao_necessaria');
  });

  it('HONESTIDADE: mesmo com fonte parcial_api, o disclaimer nunca afirma que o IBAMA foi verificado', () => {
    const r = verificarConformidadeAmbiental(baseInput({ desmatamento_verificado_api: true, car_verificado_api: true, car_status: 'ativo' }));
    expect(r.fonte_dados).toBe('parcial_api');
    expect(r.disclaimer.toUpperCase()).toContain('AUTODECLARADO');
    expect(r.disclaimer).toContain('IBAMA');
  });

  it('sem nenhuma flag de verificação ao vivo → continua autodeclarado (comportamento antigo preservado)', () => {
    const r = verificarConformidadeAmbiental(baseInput({ reserva_legal_averbada: true }));
    expect(r.fonte_dados).toBe('autodeclarado');
    expect(r.prodes_verificado_api).toBe(false);
    expect(r.car_verificado_api).toBe(false);
  });
});
