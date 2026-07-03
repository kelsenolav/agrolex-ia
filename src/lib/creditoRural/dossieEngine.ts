/**
 * Dossiê de Conformidade CMN 5.193 — motor de veredito PURO (sem I/O).
 *
 * Consolida as verificações (sobreposição geo, ambiental ao vivo, CAR) num
 * veredito determinístico por operação de crédito à luz das Res. CMN
 * 5.193/2024, 5.267/2025 e 5.268/2025, com plano de saneamento por
 * impedimento. Mesma postura do motor ISF: determinístico onde importa
 * juridicamente; fonte indisponível NUNCA vira "apto" silencioso.
 */

import type { OverlapFinding } from '@/lib/geo/overlapEngine';

export type DossieVerdict = 'apto' | 'apto_com_ressalvas' | 'impedido';
export type FonteStatus = 'consultada' | 'falhou' | 'indisponivel';

export interface DossieInput {
  /** Achados da análise de sobreposição (aposta 1). */
  sobreposicoes: OverlapFinding[];
  /** Status de cada fonte consultada (proveniência honesta). */
  fontes: Record<string, { status: FonteStatus; erro?: string }>;
  /** Situação cadastral do CAR do imóvel (da camada pública). */
  car_status?: 'AT' | 'PE' | 'SU' | 'CA' | string;
  /** Alertas DETER (município) nos últimos meses — verificado ao vivo. */
  alertas_deter: Array<{ data: string; area_ha: number; fonte: string }>;
  /** true quando a consulta DETER foi de fato executada. */
  deter_verificado: boolean;
  /** Embargo declarado pelo usuário (o georreferenciado entra via sobreposições). */
  embargo_autodeclarado?: boolean;
}

export interface DossieImpedimento {
  codigo: string;
  gravidade: 'impeditivo' | 'ressalva';
  descricao: string;
  base_normativa: string;
  saneamento: string;
}

export interface DossieResult {
  veredito: DossieVerdict;
  impedimentos: DossieImpedimento[];
  ressalvas: DossieImpedimento[];
  lacunas_de_verificacao: string[];
  resumo: string;
  disclaimer: string;
}

const BASE_5193 = 'Res. CMN 5.193/2024 (conformidade socioambiental no crédito rural)';
const BASE_5268 = 'Res. CMN 5.268/2025 (vedações ampliadas a todos os biomas desde 01/04/2026)';

function imp(codigo: string, descricao: string, base: string, saneamento: string): DossieImpedimento {
  return { codigo, gravidade: 'impeditivo', descricao, base_normativa: base, saneamento };
}
function res(codigo: string, descricao: string, base: string, saneamento: string): DossieImpedimento {
  return { codigo, gravidade: 'ressalva', descricao, base_normativa: base, saneamento };
}

export function computeDossieVerdict(input: DossieInput): DossieResult {
  const impedimentos: DossieImpedimento[] = [];
  const ressalvas: DossieImpedimento[] = [];
  const lacunas: string[] = [];

  // 1. Embargo IBAMA georreferenciado intersectando o imóvel → impeditivo
  const embargosGeo = input.sobreposicoes.filter((s) => s.classe === 'embargo_ibama');
  for (const e of embargosGeo) {
    impedimentos.push(imp(
      'EMBARGO_GEO',
      `Área embargada pelo IBAMA intersecta o imóvel (${e.nome}; ${e.area_sobreposta_ha} ha, ${e.percentual_imovel}% do imóvel).`,
      BASE_5268,
      'Regularizar o embargo junto ao IBAMA (conversão em termo de compromisso/PRA) e obter certidão de levantamento antes de protocolar a operação; sem isso a instituição financeira é obrigada a recusar.',
    ));
  }

  // 2. Embargo autodeclarado (sem confirmação geo) → impeditivo do mesmo jeito
  if (input.embargo_autodeclarado && embargosGeo.length === 0) {
    impedimentos.push(imp(
      'EMBARGO_DECLARADO',
      'Embargo IBAMA informado pelo proponente (não confirmado nas bases georreferenciadas — pode ser embargo recente ou não espacializado).',
      BASE_5268,
      'Obter no IBAMA o extrato do TAD e tratar a regularização antes da operação; confirmar o alcance espacial do embargo.',
    ));
  }

  // 3. Sobreposição com TI → impeditivo (nulidade constitucional na fração)
  for (const s of input.sobreposicoes.filter((x) => x.classe === 'terra_indigena')) {
    impedimentos.push(imp(
      'SOBREPOSICAO_TI',
      `Imóvel sobrepõe Terra Indígena (${s.nome}; ${s.area_sobreposta_ha} ha, ${s.percentual_imovel}%).`,
      'Art. 231, §6º, CF/88 + suspensão de CAR sobreposto a TI (STF)',
      'Confrontar memorial georreferenciado com a fase demarcatória na FUNAI; excluir a fração atingida da garantia/projeto ou retificar a área antes de qualquer operação.',
    ));
  }

  // 4. UC crítica → impeditivo; UC não-crítica → ressalva
  for (const s of input.sobreposicoes.filter((x) => x.classe === 'unidade_conservacao')) {
    if (s.severidade === 'critica') {
      impedimentos.push(imp(
        'SOBREPOSICAO_UC',
        `Imóvel sobrepõe Unidade de Conservação em grau crítico (${s.nome}; ${s.area_sobreposta_ha} ha, ${s.percentual_imovel}%).`,
        'Lei 9.985/2000 (SNUC) c/c ' + BASE_5193,
        'Identificar categoria e plano de manejo junto ao ICMBio; excluir a fração da área do empreendimento financiado ou obter anuência do órgão gestor.',
      ));
    } else {
      ressalvas.push(res(
        'UC_USO_SUSTENTAVEL',
        `Sobreposição com UC de uso sustentável (${s.nome}; ${s.percentual_imovel}%). Restrições do plano de manejo podem alcançar o projeto.`,
        'Lei 9.985/2000 (SNUC)',
        'Anexar ao dossiê o enquadramento da atividade no plano de manejo/zoneamento da UC.',
      ));
    }
  }

  // 5. CAR cancelado/suspenso → impeditivo; pendente → ressalva
  const carStatus = (input.car_status ?? '').toUpperCase();
  if (carStatus === 'CA' || carStatus === 'SU') {
    impedimentos.push(imp(
      'CAR_IRREGULAR',
      `CAR do imóvel consta como ${carStatus === 'CA' ? 'CANCELADO' : 'SUSPENSO'} na base pública.`,
      BASE_5193,
      'Regularizar a inscrição no SICAR (retificação/reativação) — CAR ativo ou pendente é pré-requisito documental da operação.',
    ));
  } else if (carStatus === 'PE') {
    ressalvas.push(res(
      'CAR_PENDENTE',
      'CAR do imóvel pendente de análise no SICAR.',
      BASE_5193,
      'Acompanhar a análise cadastral; a pendência não veda a operação, mas pode ser exigida diligência adicional pela instituição.',
    ));
  }

  // 6. DETER com alerta recente → ressalva (nível município/imóvel a confirmar)
  if (input.deter_verificado && input.alertas_deter.length > 0) {
    const total = input.alertas_deter.reduce((s, a) => s + a.area_ha, 0);
    ressalvas.push(res(
      'DETER_ALERTA',
      `${input.alertas_deter.length} alerta(s) DETER de desmatamento recente na região (${total.toFixed(1)} ha somados).`,
      BASE_5193,
      'Comprovar que eventual supressão no imóvel possui autorização vigente (ASV) ou que os alertas não incidem sobre o imóvel — anexar laudo/imagens.',
    ));
  }

  // 7. Sobreposição dominial relevante (vizinho >50%) → ressalva forte
  for (const s of input.sobreposicoes.filter((x) => x.classe === 'car_vizinho' && x.severidade === 'alta')) {
    ressalvas.push(res(
      'CONFLITO_DOMINIAL',
      `CAR vizinho sobrepõe ${s.percentual_imovel}% do imóvel (${s.nome}) — possível CAR duplicado ou conflito de limites.`,
      'Art. 29, §2º, Lei 12.651/2012 (CAR declaratório)',
      'Confrontar memoriais georreferenciados e retificar o CAR conflitante antes de constituir a garantia — instituições podem recusar garantia sobre área em conflito.',
    ));
  }

  // 8. Lacunas de verificação → NUNCA apto pleno
  for (const [fonte, st] of Object.entries(input.fontes)) {
    if (st.status !== 'consultada') {
      lacunas.push(`${fonte}: ${st.status}${st.erro ? ` (${st.erro})` : ''}`);
    }
  }
  if (!input.deter_verificado) lacunas.push('deter: não verificado');

  // Veredito
  let veredito: DossieVerdict;
  if (impedimentos.length > 0) veredito = 'impedido';
  else if (ressalvas.length > 0 || lacunas.length > 0) veredito = 'apto_com_ressalvas';
  else veredito = 'apto';

  const resumo =
    veredito === 'impedido'
      ? `Operação IMPEDIDA nas condições atuais: ${impedimentos.length} impedimento(s) à luz das Resoluções CMN. Ver plano de saneamento por item.`
      : veredito === 'apto_com_ressalvas'
        ? `Operação possível COM RESSALVAS: ${ressalvas.length} ressalva(s)${lacunas.length ? ` e ${lacunas.length} fonte(s) não verificada(s)` : ''}. Documentar os pontos antes do protocolo.`
        : 'Nenhum impedimento ou ressalva nas fontes consultadas. Operação apta do ponto de vista socioambiental (Res. CMN 5.193/5.268).';

  return {
    veredito,
    impedimentos,
    ressalvas,
    lacunas_de_verificacao: lacunas,
    resumo,
    disclaimer:
      'Dossiê gerado por verificação automática em bases públicas oficiais na data indicada, com regras determinísticas derivadas das Res. CMN 5.193/2024, 5.267/2025 e 5.268/2025. Fontes marcadas como indisponíveis/falhas NÃO foram verificadas. Não substitui a análise da instituição financeira nem parecer jurídico individualizado.',
  };
}
