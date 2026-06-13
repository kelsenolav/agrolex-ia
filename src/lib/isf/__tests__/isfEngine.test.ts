import {
  calcularISF,
  classificarEixo,
  extrairImpacto,
  calcularEixo,
  classificarRisco,
  validarPesos,
  PESOS_EIXOS,
  TETO_EIXO,
  RISK_THRESHOLDS,
  type ProblemaEntrada,
} from '../isfEngine';

function makeProblema(
  titulo: string,
  criticidade: string,
  eixoHint?: string,
  isVetoRisco?: boolean
): ProblemaEntrada {
  return {
    titulo,
    criticidade,
    descricao: eixoHint ? `Problema relacionado a ${eixoHint}` : 'Descrição genérica',
    baseDocumental: 'Documento analisado',
    isVetoRisco,
  };
}

describe('isfEngine.ts', () => {
  describe('Pesos e Configuração', () => {
    it('deve validar que os pesos somam 1.0', () => {
      expect(validarPesos()).toBe(true);
    });

    it('deve possuir os pesos corretos de cada eixo', () => {
      expect(PESOS_EIXOS.REG).toBe(0.25);
      expect(PESOS_EIXOS.DOM).toBe(0.25);
      expect(PESOS_EIXOS.LIT).toBe(0.20);
      expect(PESOS_EIXOS.POS).toBe(0.15);
      expect(PESOS_EIXOS.FRA).toBe(0.15);
    });
  });

  describe('Trava de Segurança (Veto de Risco)', () => {
    it('deve limitar o score ao máximo de 30 se houver achado com criticidade "critica"', () => {
      const problemas = [
        makeProblema('Fraude detectada', 'critica', 'fraude'), // Eixo FRA: -50 * 0.15 = -7.5
      ];
      // Sem veto: 100 - 7.5 = 92.5 -> 93
      // Com veto: deve limitar a 30
      const result = calcularISF(problemas);
      expect(result.isf_score).toBe(30);
      expect(result.is_veto_applied).toBe(true);
      expect(result.risk_level).toBe('critico');
    });

    it('deve limitar o score ao máximo de 30 se houver achado com isVetoRisco true', () => {
      const problemas = [
        {
          titulo: 'Divergência menor com veto',
          criticidade: 'baixa', // -5 * 0.25 = -1.25
          descricao: 'Divergência com flag de veto',
          isVetoRisco: true,
        },
      ];
      // Sem veto: 100 - 1.25 = 98.75 -> 99
      // Com veto: deve limitar a 30
      const result = calcularISF(problemas);
      expect(result.isf_score).toBe(30);
      expect(result.is_veto_applied).toBe(true);
    });

    it('não deve aplicar veto se não houver achados críticos ou com flag de veto', () => {
      const problemas = [
        makeProblema('Penhora simples', 'alta', 'registro'), // -30 * 0.25 = -7.5
      ];
      const result = calcularISF(problemas);
      expect(result.isf_score).toBe(93); // 100 - 7.5 = 92.5 -> 93
      expect(result.is_veto_applied).toBe(false);
    });

    it('não deve aumentar o score para 30 se o score calculado já for inferior a 30', () => {
      const problemas: ProblemaEntrada[] = [];
      const eixosList = ['registro', 'cadeia dominial', 'processo', 'invasão', 'fraude'];
      for (const eixo of eixosList) {
        problemas.push(makeProblema(`Problema grave 1 no ${eixo}`, 'critica', eixo));
        problemas.push(makeProblema(`Problema grave 2 no ${eixo}`, 'critica', eixo));
      }
      
      const result = calcularISF(problemas);
      expect(result.isf_score).toBe(20);
      expect(result.is_veto_applied).toBe(false);
    });
  });

  describe('Teto por Eixo e Normalização', () => {
    it('deve aplicar teto de 80 pontos por eixo', () => {
      // 3 problemas de impacto 30 no eixo REG = 90 -> limitado a 80
      const problemas = [
        makeProblema('Problema REG 1', 'alta', 'registro'),
        makeProblema('Problema REG 2', 'alta', 'registro'),
        makeProblema('Problema REG 3', 'alta', 'registro'),
      ];
      const result = calcularISF(problemas);
      expect(result.registral_score).toBe(80);
      // Contribuição = 80 * 0.25 = 20. Score = 100 - 20 = 80.
      expect(result.isf_score).toBe(80);
    });
  });

  describe('Classificação de Risco', () => {
    it('deve classificar corretamente as faixas de risco', () => {
      expect(classificarRisco(95)).toBe('muito_seguro');
      expect(classificarRisco(90)).toBe('muito_seguro');
      expect(classificarRisco(85)).toBe('seguro');
      expect(classificarRisco(80)).toBe('seguro');
      expect(classificarRisco(70)).toBe('atencao');
      expect(classificarRisco(60)).toBe('atencao');
      expect(classificarRisco(50)).toBe('alto_risco');
      expect(classificarRisco(40)).toBe('alto_risco');
      expect(classificarRisco(30)).toBe('critico');
      expect(classificarRisco(0)).toBe('critico');
    });
  });
});
