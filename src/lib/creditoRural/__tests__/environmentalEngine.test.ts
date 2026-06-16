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
});
