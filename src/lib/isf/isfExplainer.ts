/**
 * isfExplainer.ts — Normalização da Explicabilidade do ISF v2
 *
 * SPRINT 3 — EXPLICABILIDADE ISF v2
 *
 * Entrada: findings.isf_v2 + findings.score_comparison (opcional)
 * Saída: Estrutura normalizada pronta para renderização visual
 *
 * Regras:
 *   - Proibido criar dados fictícios
 *   - Proibido alterar score legado
 *   - Proibido alterar backend
 */

import type { Eixo, FaixaRisco } from './isfV2';
import { LABEL_EIXO, LABEL_FAIXA, COR_FAIXA } from './isfV2';

// ─── INTERFACES DE SAÍDA ───────────────────────────────────────────────

export interface TopFator {
  nome: string;
  eixo: string;
  impacto: number;
  criticidade: string;
  descricao: string;
}

export interface EixoExplicacao {
  eixo: string;
  valor: number;
  peso: number;
  contribuicao: number;
  achados: number;
  leitura: string;
}

export interface ComparacaoScore {
  legacyScore: number;
  isfScore: number;
  difference: number;
  leitura: string;
}

export interface ExplicabilidadeISF {
  disponivel: boolean;
  score?: number;
  classificacao?: string;
  resumo?: string;
  topFatores?: TopFator[];
  eixos?: EixoExplicacao[];
  comparacao?: ComparacaoScore;
}

// ─── CONSTANTES DE LEITURA ─────────────────────────────────────────────

/**
 * Leituras textuais para cada faixa de valor do eixo.
 * 0–24: sem impacto relevante
 * 25–49: atenção leve
 * 50–69: atenção moderada
 * 70–84: impacto elevado
 * 85–100: impacto crítico
 */
export function gerarLeituraEixo(valor: number): string {
  if (valor <= 24) return 'Eixo sem impacto relevante';
  if (valor <= 49) return 'Atenção leve — observar evolução';
  if (valor <= 69) return 'Atenção moderada — requer monitoramento';
  if (valor <= 84) return 'Impacto elevado — requer ação corretiva';
  return 'Impacto crítico — requer ação imediata';
}

/**
 * Gera leitura textual para a comparação entre score legado e ISF v2.
 */
export function gerarLeituraComparacao(
  legacyScore: number,
  isfScore: number,
  difference: number
): string {
  const absDiff = Math.abs(difference);

  if (absDiff <= 5) {
    return 'O ISF v2 apresenta resultado equivalente ao score legado, dentro da margem de calibração.';
  }

  if (isfScore < legacyScore) {
    return `O ISF v2 foi mais rigoroso nesta análise, resultando em ${absDiff} ponto(s) a menos que o score legado. Isso reflete a ponderação granular dos achados por eixo temático.`;
  }

  return `O ISF v2 foi mais favorável nesta análise, resultando em ${absDiff} ponto(s) a mais que o score legado. Isso reflete a ponderação granular dos achados por eixo temático.`;
}

/**
 * Gera frase executiva com base no score e classificação.
 */
export function gerarFraseExecutiva(
  score: number,
  classificacao: string,
  topFatores: TopFator[]
): string {
  if (topFatores.length === 0) {
    return `Este dossiê recebeu ISF ${score}, classificado como ${classificacao}. Nenhum fator relevante de redução foi identificado.`;
  }

  // Agrupa fatores por eixo para criar a frase
  const eixosPresentes = [...new Set(topFatores.map(f => f.eixo))];
  const eixosTexto = eixosPresentes.length <= 2
    ? eixosPresentes.join(' e ')
    : eixosPresentes.slice(0, -1).join(', ') + ' e ' + eixosPresentes[eixosPresentes.length - 1];

  return `Este dossiê recebeu ISF ${score}, classificado como ${classificacao}. A nota foi reduzida principalmente por achados ${eixosTexto.toLowerCase()}.`;
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────

/**
 * Normaliza os dados de ISF v2 e score_comparison para explicabilidade visual.
 *
 * @param isfV2 - Objeto findings.isf_v2 (pode ser null/undefined)
 * @param scoreComparison - Objeto findings.score_comparison (pode ser null/undefined)
 * @returns ExplicabilidadeISF normalizada
 */
export function gerarExplicabilidadeISF(
  isfV2: Record<string, unknown> | null | undefined,
  scoreComparison: Record<string, unknown> | null | undefined
): ExplicabilidadeISF {
  // Se ISF v2 não existir, retornar indisponível
  if (!isfV2 || typeof isfV2 !== 'object') {
    return {
      disponivel: false,
      resumo: 'Explicabilidade ISF v2 ainda não disponível para esta análise.',
    };
  }

  // Validar campos obrigatórios
  const isfScore = isfV2.isf_score as number | undefined;
  const riskLevel = isfV2.risk_level as FaixaRisco | undefined;
  const factors = isfV2.factors as Array<{
    nome?: string;
    eixo?: Eixo;
    impacto?: number;
    criticidade?: string;
    descricao?: string;
  }> | undefined;
  const eixos = isfV2.eixos as Record<Eixo, {
    valor?: number;
    peso?: number;
    contribuicao?: number;
    achados?: number;
  }> | undefined;

  // Se estrutura inválida, retornar indisponível
  if (typeof isfScore !== 'number' || !riskLevel || !eixos || typeof eixos !== 'object') {
    return {
      disponivel: false,
      resumo: 'Explicabilidade ISF v2 ainda não disponível para esta análise.',
    };
  }

  // 1. Classificação
  const classificacao = LABEL_FAIXA[riskLevel] || riskLevel;

  // 2. Top fatores (até 5, ordenados por impacto decrescente)
  const fatoresArray = Array.isArray(factors) ? factors : [];
  const topFatores: TopFator[] = fatoresArray
    .filter(f => f && typeof f === 'object')
    .map(f => ({
      nome: f.nome || 'Achado não nomeado',
      eixo: f.eixo ? (LABEL_EIXO[f.eixo] || f.eixo) : 'Indefinido',
      impacto: typeof f.impacto === 'number' ? f.impacto : 0,
      criticidade: f.criticidade || 'médio',
      descricao: f.descricao || '',
    }))
    .sort((a, b) => b.impacto - a.impacto)
    .slice(0, 5);

  // 3. Frase executiva
  const resumo = gerarFraseExecutiva(isfScore, classificacao, topFatores);

  // 4. Eixos
  const EIXOS_ORDEM: Eixo[] = ['REG', 'DOM', 'LIT', 'POS', 'FRA'];
  const eixosExplicacao: EixoExplicacao[] = EIXOS_ORDEM
    .filter(codigo => eixos[codigo] && typeof eixos[codigo] === 'object')
    .map(codigo => {
      const eixo = eixos[codigo];
      const valor = typeof eixo.valor === 'number' ? eixo.valor : 0;
      return {
        eixo: LABEL_EIXO[codigo] || codigo,
        valor,
        peso: typeof eixo.peso === 'number' ? eixo.peso : 0,
        contribuicao: typeof eixo.contribuicao === 'number' ? eixo.contribuicao : 0,
        achados: typeof eixo.achados === 'number' ? eixo.achados : 0,
        leitura: gerarLeituraEixo(valor),
      };
    });

  // 5. Comparação (opcional)
  let comparacao: ComparacaoScore | undefined;

  if (scoreComparison && typeof scoreComparison === 'object') {
    const legacyScore = scoreComparison.legacy_score as number | undefined;
    const compIsfScore = scoreComparison.isf_score as number | undefined;
    const difference = scoreComparison.difference as number | undefined;

    if (
      typeof legacyScore === 'number' &&
      typeof compIsfScore === 'number' &&
      typeof difference === 'number'
    ) {
      comparacao = {
        legacyScore,
        isfScore: compIsfScore,
        difference,
        leitura: gerarLeituraComparacao(legacyScore, compIsfScore, difference),
      };
    }
  }

  return {
    disponivel: true,
    score: isfScore,
    classificacao,
    resumo,
    topFatores,
    eixos: eixosExplicacao,
    comparacao,
  };
}