// ─── Crédito Rural — Parâmetros configuráveis (Plano Safra / CMN) ────────────
//
// IMPORTANTE: taxas, tetos e valores de referência mudam a cada Plano Safra
// (anualmente, vigência jul→jun) e por Resolução CMN. Centralizamos aqui, com
// data de vigência explícita, para que a atualização seja um único ponto de
// manutenção — nunca espalhada pelo código dos motores.
//
// FONTE: Manual de Crédito Rural (MCR/BACEN), Resoluções CMN, Plano Safra MAPA.
// Ao atualizar, altere PARAMETROS_VIGENCIA e a data de revisão abaixo.

export const PARAMETROS_VIGENCIA = {
  plano_safra: '2025/2026',
  revisado_em: '2026-06-16',
  fonte: 'MCR/BACEN, Resoluções CMN, Plano Safra MAPA 2025/2026',
} as const;

// ─── Tetos de enquadramento por programa ─────────────────────────────────────

export const TETOS_ENQUADRAMENTO = {
  // Pronaf: renda bruta familiar anual máxima (Lei 11.326/2006 + atualizações MCR)
  pronaf_renda_bruta_max: 500_000,
  // Pronamp: renda bruta agropecuária anual máxima (Resolução CMN)
  pronamp_renda_bruta_max: 3_000_000,
} as const;

// ─── Limites de financiamento por operação (estimativas conservadoras) ───────
// Tetos por mutuário/safra — usados apenas como teto da ESTIMATIVA de valor.

export const TETOS_FINANCIAMENTO = {
  pronaf_custeio_investimento: 500_000,
  pronamp_por_safra: 1_700_000,
} as const;

// ─── Loan-to-Value (LTV) por linha — fração da área livre aceita como garantia ─

export const LTV_POR_LINHA = {
  pronaf: 0.8,
  pronamp: 0.7,
  fundo_constitucional: 0.65,
  livre: 0.6,
} as const;

// ─── Valor de referência da terra nua por hectare, por região (R$/ha) ────────
// Estimativa conservadora para cálculo de capacidade de garantia. NÃO substitui
// avaliação/laudo técnico do imóvel exigido pelo agente financeiro.

export const VALOR_HECTARE_REGIAO: Record<string, number> = {
  norte: 8_000,
  nordeste: 6_000,
  centro_oeste: 15_000,
  sudeste: 25_000,
  sul: 30_000,
};

export const VALOR_HECTARE_PADRAO = 10_000;

// ─── Faixas de juros estimadas por linha (a.a.) — apenas indicativo ──────────

export const JUROS_ESTIMADO = {
  pronaf: '0,5% a 5% a.a.',
  pronamp: '6% a 8% a.a.',
  livre: '10% a 14% a.a.',
} as const;

// ─── Defesa: parâmetros legais ───────────────────────────────────────────────

export const PARAMETROS_DEFESA = {
  // DL 167/67, art. 5º: juros de mora limitados a 1% ao ANO nas cédulas rurais
  taxa_mora_legal_anual: 1.0,
  // CC art. 206, §3º, VIII: prescrição trienal da pretensão de cobrança
  prescricao_anos: 3,
} as const;
