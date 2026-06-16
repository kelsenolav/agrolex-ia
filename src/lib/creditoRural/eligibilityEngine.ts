import type {
  CreditEligibilityInput,
  CreditEligibilityScore,
  EligibilityFaixa,
  EligibilityAxis,
  CreditProgramMatch,
} from '@/types/creditoRural';
import {
  CREDIT_PROGRAMS,
  getValorReferenciaPorHectare,
  getFundoConstitucional,
  DOCUMENTOS_BASE,
} from './knowledgeBase';
import {
  TETOS_ENQUADRAMENTO,
  TETOS_FINANCIAMENTO,
  LTV_POR_LINHA,
  JUROS_ESTIMADO,
  PARAMETROS_VIGENCIA,
} from './config';

// ─── Pesos dos eixos ─────────────────────────────────────────────────────────

const PESO_REGULARIDADE = 0.30;
const PESO_CADASTRAL = 0.25;
const PESO_GARANTIA = 0.25;
const PESO_HISTORICO = 0.20;

// ─── Classificação por faixa ─────────────────────────────────────────────────

function classificarFaixa(score: number): EligibilityFaixa {
  if (score <= 30) return 'inelegivel';
  if (score <= 50) return 'restrito';
  if (score <= 70) return 'condicional';
  if (score <= 85) return 'elegivel';
  return 'premium';
}

// ─── Eixo 1: Regularidade Fundiária (30%) ────────────────────────────────────

function calcularRegularidadeFundiaria(input: CreditEligibilityInput): EligibilityAxis {
  let score = 100;
  const details: string[] = [];

  if (!input.matricula_limpa) {
    score -= 40;
    details.push('Matrícula com irregularidades detectadas');
  } else {
    details.push('Matrícula limpa — sem irregularidades');
  }

  if (input.penhoras_vigentes > 0) {
    score -= 30;
    details.push(`${input.penhoras_vigentes} penhora(s) vigente(s) — bloqueio grave para crédito`);
  }

  if (input.hipotecas_vigentes > 0) {
    const penalidade = Math.min(input.hipotecas_vigentes * 15, 30);
    score -= penalidade;
    details.push(`${input.hipotecas_vigentes} hipoteca(s) vigente(s) — reduz capacidade de garantia`);
  }

  if (input.onus_count > 0 && input.penhoras_vigentes === 0 && input.hipotecas_vigentes === 0) {
    score -= Math.min(input.onus_count * 5, 15);
    details.push(`${input.onus_count} ônus/gravame(s) registrado(s)`);
  }

  return { score: Math.max(0, Math.min(100, score)), weight: PESO_REGULARIDADE, label: 'Regularidade Fundiária', details };
}

// ─── Eixo 2: Conformidade Cadastral (25%) ────────────────────────────────────

function calcularConformidadeCadastral(input: CreditEligibilityInput): EligibilityAxis {
  let score = 0;
  const details: string[] = [];

  if (input.car_ativo) {
    score += 35;
    details.push('CAR ativo — requisito obrigatório atendido');
  } else {
    details.push('CAR inativo ou inexistente — OBRIGATÓRIO para qualquer linha de crédito rural');
  }

  if (input.ccir_vigente) {
    score += 30;
    details.push('CCIR vigente');
  } else {
    details.push('CCIR vencido ou inexistente — exigido pelo banco');
  }

  if (input.itr_regular) {
    score += 25;
    details.push('ITR regular (em dia)');
  } else {
    details.push('ITR irregular — débito pode bloquear acesso ao crédito');
  }

  if (input.dap_caf_valida) {
    score += 10;
    details.push('DAP/CAF válida — habilita acesso ao Pronaf');
  }

  return { score: Math.max(0, Math.min(100, score)), weight: PESO_CADASTRAL, label: 'Conformidade Cadastral', details };
}

// ─── Eixo 3: Capacidade de Garantia (25%) ────────────────────────────────────

function calcularCapacidadeGarantia(input: CreditEligibilityInput): EligibilityAxis {
  const details: string[] = [];

  if (input.area_total_ha <= 0) {
    details.push('Área total não informada — impossível calcular capacidade de garantia');
    return { score: 0, weight: PESO_GARANTIA, label: 'Capacidade de Garantia', details };
  }

  const areaLivre = Math.max(0, input.area_total_ha - input.area_gravada_ha);
  const ratioLivre = areaLivre / input.area_total_ha;
  let score = Math.round(ratioLivre * 100);

  details.push(`Área total: ${input.area_total_ha.toFixed(1)} ha`);
  details.push(`Área livre de gravames: ${areaLivre.toFixed(1)} ha (${(ratioLivre * 100).toFixed(0)}%)`);

  if (input.area_gravada_ha > 0) {
    details.push(`Área gravada: ${input.area_gravada_ha.toFixed(1)} ha`);
  }

  if (ratioLivre < 0.2) {
    score = Math.min(score, 20);
    details.push('Menos de 20% da área está livre — garantia insuficiente para a maioria das linhas');
  } else if (ratioLivre >= 0.8) {
    details.push('Mais de 80% da área está livre — excelente capacidade de garantia');
  }

  return { score: Math.max(0, Math.min(100, score)), weight: PESO_GARANTIA, label: 'Capacidade de Garantia', details };
}

// ─── Eixo 4: Histórico de Crédito (20%) ─────────────────────────────────────

function calcularHistoricoCredito(input: CreditEligibilityInput): EligibilityAxis {
  let score = 80;
  const details: string[] = [];

  if (input.cadin_serasa) {
    score = 0;
    details.push('Restrição em CADIN/SERASA — bloqueio total para crédito rural');
    return { score, weight: PESO_HISTORICO, label: 'Histórico de Crédito', details };
  }

  if (input.inadimplencia_credito_rural) {
    score = 10;
    details.push('Inadimplência em crédito rural anterior — acesso severamente restrito');
    return { score, weight: PESO_HISTORICO, label: 'Histórico de Crédito', details };
  }

  if (input.credito_rural_vigente) {
    score -= 10;
    details.push('Possui crédito rural vigente — pode limitar novas operações (verificar teto por CPF)');
  } else {
    score += 20;
    details.push('Sem crédito rural vigente — sem restrição por operações anteriores');
  }

  if (score >= 80) {
    details.push('Histórico de crédito favorável');
  }

  return { score: Math.max(0, Math.min(100, score)), weight: PESO_HISTORICO, label: 'Histórico de Crédito', details };
}

// ─── Matching de programas ───────────────────────────────────────────────────

function matchProgramas(input: CreditEligibilityInput, score: number): CreditProgramMatch[] {
  const matches: CreditProgramMatch[] = [];
  const valorHa = getValorReferenciaPorHectare(input.uf);
  const areaLivre = Math.max(0, input.area_total_ha - input.area_gravada_ha);

  // Pronaf
  const pronafElegivel = input.dap_caf_valida === true && input.tipo_produtor === 'familiar' && !input.cadin_serasa;
  matches.push({
    programa_id: 'pronaf',
    nome: 'PRONAF',
    elegivel: pronafElegivel,
    motivo: pronafElegivel
      ? 'Produtor familiar com DAP/CAF válida'
      : !input.dap_caf_valida ? 'Requer DAP/CAF válida' : input.tipo_produtor !== 'familiar' ? 'Apenas para agricultores familiares' : 'Restrição cadastral',
    taxa_juros_estimada: JUROS_ESTIMADO.pronaf,
    prazo_max_meses: 120,
    valor_max_estimado: pronafElegivel ? Math.min(areaLivre * valorHa * LTV_POR_LINHA.pronaf, TETOS_FINANCIAMENTO.pronaf_custeio_investimento) : null,
    requisitos_pendentes: pronafElegivel ? [] : (!input.dap_caf_valida ? ['Obter DAP/CAF'] : ['Enquadramento como agricultor familiar']),
  });

  // Pronamp
  const tetoPronamp = TETOS_ENQUADRAMENTO.pronamp_renda_bruta_max;
  const pronampElegivel = input.tipo_produtor !== 'familiar' && (input.renda_bruta_anual ?? 0) <= tetoPronamp && !input.cadin_serasa && !input.inadimplencia_credito_rural;
  matches.push({
    programa_id: 'pronamp',
    nome: 'PRONAMP',
    elegivel: pronampElegivel,
    motivo: pronampElegivel
      ? 'Médio produtor dentro do teto de renda'
      : (input.renda_bruta_anual ?? 0) > tetoPronamp ? `Renda bruta anual excede o teto do Pronamp (R$ ${tetoPronamp.toLocaleString('pt-BR')})` : 'Restrição cadastral ou inadimplência',
    taxa_juros_estimada: JUROS_ESTIMADO.pronamp,
    prazo_max_meses: 96,
    valor_max_estimado: pronampElegivel ? Math.min(areaLivre * valorHa * LTV_POR_LINHA.pronamp, TETOS_FINANCIAMENTO.pronamp_por_safra) : null,
    requisitos_pendentes: pronampElegivel ? [] : [(input.renda_bruta_anual ?? 0) > tetoPronamp ? 'Renda acima do teto' : 'Regularizar pendências'],
  });

  // Fundo constitucional
  const fundoId = getFundoConstitucional(input.uf);
  if (fundoId) {
    const fundo = CREDIT_PROGRAMS.find(p => p.id === fundoId);
    if (fundo) {
      const fundoElegivel = !input.cadin_serasa && !input.inadimplencia_credito_rural && input.car_ativo;
      matches.push({
        programa_id: fundoId,
        nome: fundo.nome,
        elegivel: fundoElegivel,
        motivo: fundoElegivel
          ? `Propriedade localizada na área do ${fundo.nome}`
          : 'Restrição cadastral, inadimplência ou CAR inativo',
        taxa_juros_estimada: fundo.taxa_juros,
        prazo_max_meses: 240,
        valor_max_estimado: fundoElegivel ? areaLivre * valorHa * LTV_POR_LINHA.fundo_constitucional : null,
        requisitos_pendentes: fundoElegivel ? [] : (!input.car_ativo ? ['Ativar CAR'] : ['Regularizar pendências']),
      });
    }
  }

  // Crédito livre
  const livreElegivel = !input.cadin_serasa && score >= 30;
  matches.push({
    programa_id: 'livre',
    nome: 'Crédito Rural Livre',
    elegivel: livreElegivel,
    motivo: livreElegivel
      ? 'Sem restrição cadastral — acesso a taxas de mercado'
      : 'Restrição em CADIN/SERASA impede acesso',
    taxa_juros_estimada: JUROS_ESTIMADO.livre,
    prazo_max_meses: 120,
    valor_max_estimado: livreElegivel ? areaLivre * valorHa * LTV_POR_LINHA.livre : null,
    requisitos_pendentes: livreElegivel ? [] : ['Regularizar CADIN/SERASA'],
  });

  return matches;
}

// ─── Documentos faltantes ────────────────────────────────────────────────────

function calcularDocumentosFaltantes(input: CreditEligibilityInput) {
  const faltantes = [];
  if (!input.car_ativo) {
    faltantes.push(DOCUMENTOS_BASE.find(d => d.documento.includes('CAR'))!);
  }
  if (!input.ccir_vigente) {
    faltantes.push(DOCUMENTOS_BASE.find(d => d.documento.includes('CCIR'))!);
  }
  if (!input.itr_regular) {
    faltantes.push(DOCUMENTOS_BASE.find(d => d.documento.includes('ITR'))!);
  }
  if (input.tipo_produtor === 'familiar' && !input.dap_caf_valida) {
    faltantes.push(DOCUMENTOS_BASE.find(d => d.documento.includes('DAP'))!);
  }
  return faltantes.filter(Boolean);
}

// ─── Motor principal ─────────────────────────────────────────────────────────

export function calcularElegibilidadeCredito(input: CreditEligibilityInput): CreditEligibilityScore {
  const ax1 = calcularRegularidadeFundiaria(input);
  const ax2 = calcularConformidadeCadastral(input);
  const ax3 = calcularCapacidadeGarantia(input);
  const ax4 = calcularHistoricoCredito(input);

  let score = Math.round(
    ax1.score * ax1.weight +
    ax2.score * ax2.weight +
    ax3.score * ax3.weight +
    ax4.score * ax4.weight
  );

  const observacoes: string[] = [];

  // Barreira ambiental (pós-abril 2026)
  let barreiraAmbiental = false;
  if (input.embargo_ibama) {
    barreiraAmbiental = true;
    score = Math.min(score, 15);
    observacoes.push('BLOQUEIO: Embargo IBAMA vigente impede acesso a crédito rural (Res. CMN 5.268/2025)');
  } else if (input.prodes_clean === false) {
    barreiraAmbiental = true;
    score = Math.min(score, 25);
    observacoes.push('ALERTA: Desmatamento detectado pelo PRODES/INPE — crédito rural condicionado a verificação ambiental (Res. CMN 5.193/2024)');
  }

  // CADIN/SERASA = veto absoluto
  if (input.cadin_serasa) {
    score = Math.min(score, 5);
    observacoes.push('BLOQUEIO TOTAL: Restrição em CADIN/SERASA impede qualquer operação de crédito rural');
  }

  score = Math.max(0, Math.min(100, score));
  const faixa = classificarFaixa(score);
  const programas = matchProgramas(input, score);

  // Estimativa de valor
  const melhorPrograma = programas.find(p => p.elegivel && p.valor_max_estimado);
  const valorEstimado = melhorPrograma?.valor_max_estimado ?? null;

  if (faixa === 'premium') {
    observacoes.push('Excelente perfil para crédito rural — elegível às melhores linhas e taxas');
  } else if (faixa === 'elegivel') {
    observacoes.push('Bom perfil — elegível à maioria das linhas de crédito rural');
  } else if (faixa === 'condicional') {
    observacoes.push('Perfil condicionado — acesso restrito a algumas linhas. Regularizar pendências pode abrir novas opções');
  } else if (faixa === 'restrito') {
    observacoes.push('Perfil restrito — acesso limitado. Necessário regularizar situação cadastral e/ou fundiária');
  }

  return {
    score,
    faixa,
    axes: {
      regularidade_fundiaria: ax1,
      conformidade_cadastral: ax2,
      capacidade_garantia: ax3,
      historico_credito: ax4,
    },
    programas_elegiveis: programas,
    valor_estimado_credito: valorEstimado,
    documentos_faltantes: calcularDocumentosFaltantes(input),
    barreira_ambiental: barreiraAmbiental,
    observacoes,
    parametros_vigencia: `Plano Safra ${PARAMETROS_VIGENCIA.plano_safra} (revisado em ${PARAMETROS_VIGENCIA.revisado_em})`,
    origem_dados_matricula: input.origem_matricula === true,
    disclaimer:
      'Estimativa orientativa baseada em parâmetros gerais do crédito rural (MCR/CMN/Plano Safra) e nos dados informados. NÃO constitui pré-aprovação, garantia de concessão, oferta de crédito ou aconselhamento financeiro. Valores de garantia usam referência conservadora por hectare e não substituem avaliação do imóvel pelo agente financeiro. Decisões de crédito dependem de análise da instituição financeira e da documentação completa.',
  };
}
