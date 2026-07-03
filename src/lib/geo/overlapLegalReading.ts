/**
 * Leitura jurídica DETERMINÍSTICA por classe de sobreposição.
 *
 * Templates fixos, sem IA (postura do projeto: determinístico onde importa
 * juridicamente). Textos-base redigidos para revisão do responsável técnico
 * (advogado) antes de qualquer alteração de mérito.
 */

import type { OverlapClass, OverlapFinding } from './overlapEngine';

export interface LegalReading {
  titulo: string;
  fundamento: string;
  consequencia: string;
  recomendacao: string;
}

const READINGS: Record<OverlapClass, (f: OverlapFinding) => LegalReading> = {
  terra_indigena: (f) => ({
    titulo: 'Sobreposição com Terra Indígena',
    fundamento:
      'Terras tradicionalmente ocupadas por indígenas são bens da União (art. 231, CF/88 e art. 20, XI, CF/88); atos que tenham por objeto a ocupação, o domínio e a posse dessas terras são NULOS e não produzem efeitos jurídicos (art. 231, §6º, CF/88). O STF determinou a suspensão de cadastros de CAR sobrepostos a Terras Indígenas.',
    consequencia: `A área sobreposta (${f.area_sobreposta_ha} ha; ${f.percentual_imovel}% do imóvel) está sujeita a nulidade de pleno direito do título na porção atingida, cancelamento/suspensão do CAR e impossibilidade de regularização fundiária ou licenciamento sobre essa fração.`,
    recomendacao:
      'Verificar a fase demarcatória da TI junto à FUNAI (delimitada/declarada/homologada), levantar o memorial georreferenciado do imóvel (SIGEF) para confrontação técnica e avaliar retificação de área/desmembramento da porção não atingida antes de qualquer negociação.',
  }),
  unidade_conservacao: (f) => ({
    titulo: 'Sobreposição com Unidade de Conservação federal',
    fundamento:
      'Unidades de Conservação submetem a área ao regime da Lei 9.985/2000 (SNUC). Em UC de proteção integral, é vedado o uso direto dos recursos naturais (art. 7º, §1º); a permanência de propriedade privada em seu interior sujeita-se a desapropriação/indenização. Em UC de uso sustentável, aplicam-se restrições do plano de manejo e, no caso de APA, limitações administrativas específicas.',
    consequencia: `A fração sobreposta (${f.area_sobreposta_ha} ha; ${f.percentual_imovel}% do imóvel) sofre restrição de uso conforme a categoria da UC — de limitações de manejo até vedação total de exploração, com reflexo direto no valor e na financiabilidade do imóvel (garantia rural desvalorizada ou inaceitável para crédito).`,
    recomendacao:
      'Identificar a categoria e o plano de manejo da UC junto ao ICMBio, verificar se há zona de amortecimento incidente e considerar o passivo na precificação/estruturação de garantias.',
  }),
  embargo_ibama: (f) => ({
    titulo: 'Sobreposição com área embargada pelo IBAMA',
    fundamento:
      'O embargo ambiental (art. 101, Decreto 6.514/2008) impede o uso econômico da área e tem eficácia REAL: acompanha o imóvel e alcança terceiros adquirentes (obrigação propter rem — jurisprudência pacífica do STJ). As Resoluções CMN 5.193/2024 e 5.268/2025 vedam crédito rural a imóvel com embargo vigente.',
    consequencia: `A área embargada sobreposta (${f.area_sobreposta_ha} ha; ${f.percentual_imovel}% do imóvel) bloqueia o acesso a crédito rural para o empreendimento, impede a exploração econômica da fração e transfere responsabilidade ambiental ao adquirente, ainda que o dano seja anterior à aquisição.`,
    recomendacao:
      'Confirmar a vigência do embargo (TAD) e o auto de infração vinculado, avaliar conversão em termo de compromisso/PRA junto ao órgão e condicionar qualquer aquisição à regularização ou ao abatimento proporcional do preço.',
  }),
  car_vizinho: (f) => ({
    titulo: 'Sobreposição com CAR de imóvel vizinho',
    fundamento:
      'O CAR é cadastro autodeclaratório e não constitui prova de propriedade ou posse (art. 29, §2º, Lei 12.651/2012). Sobreposição entre CARs indica conflito de limites declarados — que pode decorrer de erro de medição, mas também de sobreposição real de títulos ou grilagem (fenômeno que alcança fração relevante das terras brasileiras).',
    consequencia: `A sobreposição declarada (${f.area_sobreposta_ha} ha; ${f.percentual_imovel}% do imóvel) gera estado de "pendência/sobreposição" na análise do CAR de ambos os imóveis, pode travar a emissão de licenças e sinaliza risco de litígio possessório/dominial na faixa em conflito.`,
    recomendacao:
      'Confrontar o memorial georreferenciado (SIGEF/matrícula) dos dois imóveis, notificar o confrontante para retificação do CAR e, persistindo o conflito, tratar como risco dominial na negociação (cláusula de área remanescente ou retenção de preço).',
  }),
};

export function legalReadingFor(finding: OverlapFinding): LegalReading {
  return READINGS[finding.classe](finding);
}

export const DISCLAIMER_SOBREPOSICAO =
  'Análise gerada por cruzamento geoespacial de bases públicas oficiais (FUNAI, ICMBio/INDE, IBAMA/PAMGIA, CAR/SICAR espelhado). Os limites declarados no CAR são autodeclaratórios e os espelhos públicos podem apresentar defasagem em relação aos sistemas de origem. Este relatório não substitui levantamento topográfico, certidão de inteiro teor nem parecer jurídico individualizado.';
