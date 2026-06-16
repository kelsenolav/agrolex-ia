import type { CedulaRawData, CedulaAnalysis, CedulaDefect } from '@/types/creditoRural';
import { PARAMETROS_DEFESA } from './config';

// ─── DL 167/67 — Requisitos formais da Cédula de Crédito Rural ──────────────

const REQUISITOS_FORMAIS_DL167 = [
  { campo: 'credor', descricao: 'Nome do credor (instituição financeira)', artigo: 'art. 14, I' },
  { campo: 'devedor', descricao: 'Nome do devedor (produtor rural)', artigo: 'art. 14, II' },
  { campo: 'valor_principal', descricao: 'Valor do crédito (por extenso e em algarismos)', artigo: 'art. 14, III' },
  { campo: 'bens_vinculados', descricao: 'Descrição dos bens vinculados em garantia', artigo: 'art. 14, IV' },
  { campo: 'data_vencimento', descricao: 'Data de vencimento', artigo: 'art. 14, V' },
  { campo: 'praca_pagamento', descricao: 'Praça de pagamento', artigo: 'art. 14, VI' },
];

// ─── Verificação de vícios formais ───────────────────────────────────────────

function verificarViciosFormais(cedula: CedulaRawData): CedulaDefect[] {
  const defects: CedulaDefect[] = [];

  for (const req of REQUISITOS_FORMAIS_DL167) {
    const valor = (cedula as unknown as Record<string, unknown>)[req.campo];
    const ausente = valor === undefined || valor === null || valor === '' || valor === 0;
    if (ausente) {
      defects.push({
        type: 'formal',
        severity: 'critico',
        titulo: `Campo obrigatório ausente: ${req.descricao}`,
        descricao: `A cédula não contém ${req.descricao.toLowerCase()}, requisito obrigatório para validade do título conforme DL 167/67, ${req.artigo}.`,
        base_legal: `DL 167/67, ${req.artigo}`,
        impacto: 'A ausência de requisito formal pode ensejar a nulidade do título executivo, impedindo a execução forçada.',
        tese_defensiva: `Arguir nulidade do título executivo por ausência de requisito formal obrigatório (DL 167/67, ${req.artigo}), com pedido de extinção da execução por falta de título líquido, certo e exigível (CPC, art. 803, I).`,
      });
    }
  }

  return defects;
}

// ─── Verificação de juros abusivos ───────────────────────────────────────────

const TAXA_MORA_LEGAL_ANUAL = PARAMETROS_DEFESA.taxa_mora_legal_anual; // DL 167/67, art. 5º: mora de 1% ao ANO

function verificarJuros(cedula: CedulaRawData): { defects: CedulaDefect[]; analise: CedulaAnalysis['juros'] } {
  const defects: CedulaDefect[] = [];

  const analise: CedulaAnalysis['juros'] = {
    taxa_contratual: cedula.taxa_juros_contratual,
    taxa_legal_maxima: TAXA_MORA_LEGAL_ANUAL,
    excesso_detectado: false,
    valor_excesso_estimado: null,
    anatocismo_detectado: cedula.capitalizacao_juros,
  };

  // Mora acima do legal
  if (cedula.taxa_mora_contratual > TAXA_MORA_LEGAL_ANUAL) {
    analise.excesso_detectado = true;
    const excessoPercentual = cedula.taxa_mora_contratual - TAXA_MORA_LEGAL_ANUAL;
    analise.valor_excesso_estimado = cedula.valor_principal * (excessoPercentual / 100);

    defects.push({
      type: 'abusivo',
      severity: 'critico',
      titulo: `Juros de mora abusivos: ${cedula.taxa_mora_contratual}% a.a. (legal: ${TAXA_MORA_LEGAL_ANUAL}% a.a.)`,
      descricao: `A cédula estipula juros de mora de ${cedula.taxa_mora_contratual}% ao ano, enquanto o DL 167/67, art. 5-A, limita os juros de mora das cédulas de crédito rural a 1% ao ANO — não ao mês. A diferença de ${excessoPercentual.toFixed(2)}% a.a. constitui cobrança abusiva.`,
      base_legal: 'DL 167/67, art. 5-A; Súmula 596/STF; REsp 1.070.297/PR (STJ)',
      impacto: `Excesso estimado de R$ ${analise.valor_excesso_estimado?.toFixed(2)} sobre o principal. O valor cobrado a mais deve ser restituído ou compensado.`,
      tese_defensiva: 'Requerer a limitação dos juros de mora a 1% ao ano conforme DL 167/67, art. 5-A, com recálculo do saldo devedor e compensação dos valores cobrados a maior.',
    });
  }

  // Anatocismo (capitalização composta de juros)
  if (cedula.capitalizacao_juros) {
    defects.push({
      type: 'abusivo',
      severity: 'grave',
      titulo: 'Capitalização de juros (anatocismo) detectada',
      descricao: 'A cédula prevê capitalização de juros (juros sobre juros). Em cédulas de crédito rural, a capitalização de juros somente é admitida se expressamente pactuada e com periodicidade não inferior a um ano (Medida Provisória 2.170-36/2001).',
      base_legal: 'DL 167/67; MP 2.170-36/2001; Súmula 121/STF',
      impacto: 'O anatocismo ilegal eleva exponencialmente o saldo devedor, podendo dobrar o valor original em poucos anos.',
      tese_defensiva: 'Arguir a nulidade da cláusula de capitalização de juros com base na Súmula 121/STF e requerer recálculo do débito pelo método de juros simples, com restituição dos valores cobrados a maior.',
    });
  }

  return { defects, analise };
}

// ─── Verificação de prescrição ───────────────────────────────────────────────

function verificarPrescricao(cedula: CedulaRawData): CedulaAnalysis['prescricao'] {
  const vencimento = new Date(cedula.data_vencimento);
  if (isNaN(vencimento.getTime())) {
    return { prescrita: false, data_prescricao: null, dias_restantes: null, base_legal: 'CC art. 206, §3°, VIII' };
  }

  const PRESCRICAO_ANOS = PARAMETROS_DEFESA.prescricao_anos;
  const dataPrescricao = new Date(vencimento);
  dataPrescricao.setFullYear(dataPrescricao.getFullYear() + PRESCRICAO_ANOS);

  const hoje = new Date();
  const diasRestantes = Math.floor((dataPrescricao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  return {
    prescrita: diasRestantes <= 0,
    data_prescricao: dataPrescricao.toISOString().split('T')[0],
    dias_restantes: Math.max(0, diasRestantes),
    base_legal: 'CC art. 206, §3°, VIII — prescrição trienal para pretensão de cobrança de dívidas líquidas constantes de instrumento público ou particular',
  };
}

// ─── Verificação de renegociação ─────────────────────────────────────────────

function verificarRenegociacao(cedula: CedulaRawData): CedulaAnalysis['renegociacao'] {
  const emissao = new Date(cedula.data_emissao);
  const vencimento = new Date(cedula.data_vencimento);
  const hoje = new Date();

  // Verifica se se enquadra nas leis de renegociação
  const leisAplicaveis: string[] = [];
  let elegivel = false;
  let motivo = '';

  // Lei 13.340/2016 — renegociação de dívidas do crédito rural
  if (emissao.getFullYear() <= 2016) {
    leisAplicaveis.push('Lei 13.340/2016');
    elegivel = true;
    motivo = 'Dívida originada antes de 2017 — elegível à renegociação pela Lei 13.340/2016';
  }

  // Lei 14.275/2021 — renegociação ampliada
  if (vencimento < hoje) {
    leisAplicaveis.push('Lei 14.275/2021');
    if (!elegivel) {
      elegivel = true;
      motivo = 'Dívida vencida — pode ser elegível à renegociação pela Lei 14.275/2021';
    }
  }

  // Resolução CMN — renegociação administrativa
  leisAplicaveis.push('Resolução CMN vigente (verificar MCR Cap. 2, Seção 6)');

  if (!elegivel) {
    motivo = 'Dívida não se enquadra nos critérios atuais de renegociação legal — verificar opções administrativas junto ao banco';
  }

  return { elegivel, leis_aplicaveis: leisAplicaveis, motivo };
}

// ─── Score de defesa ─────────────────────────────────────────────────────────

function calcularScoreDefesa(defects: CedulaDefect[], prescricao: CedulaAnalysis['prescricao']): number {
  let score = 10; // base

  if (prescricao.prescrita) score += 50;
  else if (prescricao.dias_restantes !== null && prescricao.dias_restantes < 180) score += 20;

  for (const d of defects) {
    if (d.type === 'formal' && d.severity === 'critico') score += 25;
    else if (d.type === 'abusivo' && d.severity === 'critico') score += 20;
    else if (d.type === 'abusivo' && d.severity === 'grave') score += 15;
    else if (d.severity === 'moderado') score += 8;
    else score += 4;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Motor principal ─────────────────────────────────────────────────────────

export function analisarCedulaCredito(cedula: CedulaRawData): CedulaAnalysis {
  const viciosFormais = verificarViciosFormais(cedula);
  const { defects: viciosJuros, analise: juros } = verificarJuros(cedula);
  const prescricao = verificarPrescricao(cedula);
  const renegociacao = verificarRenegociacao(cedula);

  const allDefects = [...viciosFormais, ...viciosJuros];

  if (prescricao.prescrita) {
    allDefects.push({
      type: 'prescritivo',
      severity: 'critico',
      titulo: 'Crédito prescrito',
      descricao: `A pretensão executória prescreveu em ${prescricao.data_prescricao}. O credor não pode mais executar judicialmente esta cédula.`,
      base_legal: prescricao.base_legal,
      impacto: 'Extinção da execução por prescrição — defesa com altíssima probabilidade de êxito.',
      tese_defensiva: 'Opor exceção de pré-executividade alegando prescrição da pretensão executória (CC art. 206, §3°, VIII), requerendo a extinção da execução (CPC art. 924, V).',
    });
  }

  const scoreDefesa = calcularScoreDefesa(allDefects, prescricao);

  let estrategia: CedulaAnalysis['estrategia_recomendada'] = 'renegociacao';
  if (prescricao.prescrita) estrategia = 'excecao_pre_executividade';
  else if (viciosFormais.length > 0) estrategia = 'embargos';
  else if (scoreDefesa >= 60) estrategia = 'embargos';
  else if (renegociacao.elegivel) estrategia = 'renegociacao';
  else if (scoreDefesa < 30) estrategia = 'quitacao';

  const estrategiaNomes: Record<string, string> = {
    embargos: 'Embargos à Execução',
    excecao_pre_executividade: 'Exceção de Pré-Executividade',
    renegociacao: 'Renegociação Administrativa/Judicial',
    quitacao: 'Quitação Negociada',
  };

  let resumo = `Análise identificou ${allDefects.length} irregularidade(s) na cédula de crédito rural. `;
  resumo += `Score de defesa: ${scoreDefesa}/100. `;
  resumo += `Estratégia recomendada: ${estrategiaNomes[estrategia]}. `;
  if (prescricao.prescrita) resumo += 'A dívida está PRESCRITA — tese de defesa com alta chance de êxito. ';
  if (juros.excesso_detectado) resumo += `Juros de mora abusivos detectados (${cedula.taxa_mora_contratual}% a.a. vs. 1% a.a. legal). `;
  if (juros.anatocismo_detectado) resumo += 'Capitalização de juros (anatocismo) detectada. ';

  return {
    defects: allDefects,
    prescricao,
    juros,
    renegociacao,
    score_defesa: scoreDefesa,
    estrategia_recomendada: estrategia,
    resumo: resumo.trim(),
    disclaimer:
      'Análise técnica preliminar e orientativa, gerada automaticamente a partir dos dados informados sobre a cédula. NÃO constitui parecer jurídico, peça processual nem aconselhamento jurídico, e NÃO substitui a avaliação de advogado(a) habilitado(a). As teses indicadas dependem de confirmação da documentação original, da jurisprudência aplicável ao caso concreto e do exame do título. O score de defesa é uma estimativa, não uma previsão de resultado.',
  };
}
