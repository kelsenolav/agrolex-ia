import type { EnvironmentalComplianceResult, ComplianceStatus } from '@/types/creditoRural';

// ─── Resoluções CMN aplicáveis ──────────────────────────────────────────────

const RESOLUCOES_AMBIENTAIS = [
  'Resolução CMN 5.193/2024 — verificação de desmatamento via PRODES/INPE para crédito rural',
  'Resolução CMN 5.267/2025 — vigência a partir de 01/04/2026 para Amazônia e Cerrado',
  'Resolução CMN 5.268/2025 — expansão para todos os biomas a partir de 01/04/2026',
  'Lei 12.651/2012 — Código Florestal (APP, RL, uso restrito)',
];

const BIOMAS_BRASIL = ['Amazônia', 'Cerrado', 'Mata Atlântica', 'Caatinga', 'Pampa', 'Pantanal'] as const;

// ─── Dados de entrada ───────────────────────────────────────────────────────

export interface EnvironmentalInput {
  car_numero?: string;
  uf: string;
  bioma?: string;
  area_total_ha: number;
  area_reserva_legal_ha?: number;
  area_app_ha?: number;
  embargo_ibama: boolean;
  alertas_prodes?: Array<{ ano: number; area_ha: number; bioma: string; fonte: string }>;
  desmatamento_recente?: boolean; // últimos 5 anos
  reserva_legal_averbada?: boolean;
  deficit_rl_ha?: number;
  deficit_app_ha?: number;
}

// ─── Motor de conformidade ambiental ────────────────────────────────────────

export function verificarConformidadeAmbiental(input: EnvironmentalInput): EnvironmentalComplianceResult {
  const alertas = input.alertas_prodes ?? [];
  const recomendacoes: string[] = [];
  let status: ComplianceStatus = 'conforme';
  let impacto = '';

  // 1. Embargo IBAMA — bloqueio total
  if (input.embargo_ibama) {
    status = 'nao_conforme';
    impacto = 'BLOQUEIO TOTAL: Embargo IBAMA vigente impede acesso a qualquer linha de crédito rural. A Resolução CMN 5.268/2025 veda a concessão de crédito rural para imóveis com embargo IBAMA desde 01/04/2026.';
    recomendacoes.push('Regularizar embargo IBAMA como prioridade absoluta antes de qualquer solicitação de crédito');
    recomendacoes.push('Consultar advogado ambiental para avaliar possibilidade de conversão de auto de infração em TAC');
  }

  // 2. Alertas PRODES/INPE
  const alertasRecentes = alertas.filter(a => a.ano >= new Date().getFullYear() - 5);
  if (alertasRecentes.length > 0) {
    if (status !== 'nao_conforme') status = 'nao_conforme';
    const areaTotal = alertasRecentes.reduce((s, a) => s + a.area_ha, 0);
    impacto += ` Detectado(s) ${alertasRecentes.length} alerta(s) de desmatamento nos últimos 5 anos (${areaTotal.toFixed(1)} ha). `;
    impacto += 'Crédito rural condicionado a verificação de conformidade ambiental (Res. CMN 5.193/2024).';
    recomendacoes.push('Apresentar documentação comprovando que desmatamento foi legal (autorização de supressão vigente)');
    recomendacoes.push('Realizar PRA (Programa de Regularização Ambiental) se aplicável');
  } else if (input.desmatamento_recente) {
    if (status === 'conforme') status = 'verificacao_necessaria';
    impacto += ' Possível desmatamento recente detectado — verificação PRODES necessária antes da concessão de crédito.';
    recomendacoes.push('Solicitar Relatório PRODES/DETER atualizado junto ao INPE');
  }

  // 3. Reserva Legal
  if (input.reserva_legal_averbada === false) {
    if (status === 'conforme') status = 'verificacao_necessaria';
    recomendacoes.push('Averbar Reserva Legal na matrícula do imóvel (exigência do Código Florestal, art. 18)');
  }

  if (input.deficit_rl_ha && input.deficit_rl_ha > 0) {
    if (status === 'conforme') status = 'verificacao_necessaria';
    recomendacoes.push(`Déficit de Reserva Legal: ${input.deficit_rl_ha.toFixed(1)} ha — aderir ao PRA ou compensar via CRA`);
  }

  if (input.deficit_app_ha && input.deficit_app_ha > 0) {
    recomendacoes.push(`Déficit de APP: ${input.deficit_app_ha.toFixed(1)} ha — recuperação obrigatória (Código Florestal, art. 7°)`);
  }

  // 4. Sem dados suficientes
  if (!input.embargo_ibama && alertas.length === 0 && input.desmatamento_recente === undefined && input.reserva_legal_averbada === undefined) {
    status = 'sem_dados';
    impacto = 'Dados ambientais insuficientes para emitir parecer. Recomenda-se consultar PRODES/INPE e IBAMA antes de solicitar crédito.';
    recomendacoes.push('Consultar PRODES/INPE (terrabrasilis.dpi.inpe.br) para verificar alertas de desmatamento');
    recomendacoes.push('Consultar IBAMA (servicos.ibama.gov.br) para verificar embargos');
    recomendacoes.push('Verificar situação do CAR no SICAR (car.gov.br)');
  }

  // 5. Conforme
  if (status === 'conforme') {
    impacto = 'Imóvel em conformidade ambiental para fins de crédito rural. Sem restrições ambientais detectadas.';
    recomendacoes.push('Manter monitoramento ambiental contínuo — nova consulta PRODES recomendada a cada safra');
  }

  return {
    status,
    // HONESTIDADE: hoje o sistema NÃO consulta PRODES/INPE ou IBAMA em tempo real.
    // Avalia apenas o que foi informado. Quando houver integração oficial, mudar
    // fonte_dados para 'api_oficial' e prodes_verificado_api para true.
    fonte_dados: 'autodeclarado',
    prodes_verificado_api: false,
    alertas_desmatamento: alertas,
    embargo_ibama: input.embargo_ibama,
    resolucoes_aplicaveis: RESOLUCOES_AMBIENTAIS,
    impacto_credito: impacto.trim(),
    recomendacoes,
    disclaimer:
      'IMPORTANTE: esta verificação é baseada em dados AUTODECLARADOS, não em consulta oficial em tempo real ao PRODES/INPE ou ao IBAMA. Confirme a situação real nas fontes oficiais (terrabrasilis.dpi.inpe.br, servicos.ibama.gov.br, car.gov.br) antes de solicitar crédito. Não constitui parecer ambiental nem aconselhamento jurídico.',
  };
}

export { BIOMAS_BRASIL };
