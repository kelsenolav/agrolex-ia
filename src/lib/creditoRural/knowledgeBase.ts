import type { CreditProgram, DocumentoFaltante, CreditProgramId } from '@/types/creditoRural';
import { VALOR_HECTARE_REGIAO, VALOR_HECTARE_PADRAO } from './config';

// ─── Programas de Crédito Rural ──────────────────────────────────────────────

export const CREDIT_PROGRAMS: CreditProgram[] = [
  {
    id: 'pronaf',
    nome: 'PRONAF',
    nome_completo: 'Programa Nacional de Fortalecimento da Agricultura Familiar',
    descricao: 'Linha de crédito com as menores taxas do sistema, destinada exclusivamente a agricultores familiares, assentados, quilombolas e indígenas.',
    finalidades: ['custeio', 'investimento', 'comercializacao', 'industrializacao'],
    publico_alvo: 'Agricultores familiares enquadrados na Lei 11.326/2006 com DAP/CAF válida',
    requisitos: [
      'Possuir DAP ou CAF válida emitida por EMATER ou entidade credenciada',
      'Explorar parcela de terra na condição de proprietário, posseiro, arrendatário ou parceiro',
      'Residir no estabelecimento ou em local próximo',
      'Renda bruta familiar anual de até R$ 500.000,00',
      'Utilizar predominantemente mão de obra familiar',
      'Área de até 4 módulos fiscais',
    ],
    documentos: ['DAP/CAF válida', 'CPF/RG', 'Matrícula do imóvel ou contrato de arrendamento', 'CAR', 'CCIR', 'ITR (recibo)', 'Projeto técnico (para investimento)'],
    taxa_juros: '0,5% a 5% a.a. (varia por grupo e finalidade)',
    prazo_max: 'Custeio: até 2 anos | Investimento: até 10 anos',
    carencia: 'Custeio: até 14 meses | Investimento: até 5 anos',
    garantias: ['Penhor agrícola/pecuário', 'Alienação fiduciária', 'Hipoteca', 'Aval solidário (Pronaf Grupo B)'],
    operador: 'Banco do Brasil, Caixa, Bancos Cooperativos (Sicredi, Sicoob, Cresol), BNDES',
    base_legal: ['Lei 11.326/2006', 'MCR Cap. 10', 'Lei 4.829/1965'],
    observacoes: [
      'As menores taxas de juros do crédito rural',
      'Possibilidade de rebate/desconto no Pronaf Grupo B',
      'DAP/CAF é documento indispensável — sem ela, o acesso ao Pronaf é impossível',
    ],
  },
  {
    id: 'pronamp',
    nome: 'PRONAMP',
    nome_completo: 'Programa Nacional de Apoio ao Médio Produtor Rural',
    descricao: 'Linha intermediária entre Pronaf e crédito livre, com taxas controladas e destinada a médios produtores rurais.',
    finalidades: ['custeio', 'investimento'],
    publico_alvo: 'Produtores rurais com renda bruta anual de até R$ 2.400.000,00',
    requisitos: [
      'Renda bruta agropecuária anual de até R$ 2.400.000,00',
      'Renda de no mínimo 80% originada de atividade agropecuária',
      'Regularidade cadastral (CAR, CCIR, ITR)',
      'Não estar inadimplente no SNCR',
    ],
    documentos: ['CPF/CNPJ', 'Matrícula do imóvel', 'CAR', 'CCIR', 'ITR', 'Declaração de IR', 'Projeto técnico'],
    taxa_juros: '6% a 8% a.a.',
    prazo_max: 'Custeio: até 2 anos | Investimento: até 8 anos',
    carencia: 'Custeio: até 14 meses | Investimento: até 3 anos',
    garantias: ['Penhor agrícola/pecuário', 'Hipoteca', 'Alienação fiduciária'],
    operador: 'Banco do Brasil, Bradesco, Itaú, Santander, Bancos Cooperativos',
    base_legal: ['MCR Cap. 8', 'Resolução CMN 4.883/2020'],
    observacoes: [
      'O enquadramento é por renda bruta — não por área',
      'Taxas intermediárias entre Pronaf e mercado',
    ],
  },
  {
    id: 'fno',
    nome: 'FNO',
    nome_completo: 'Fundo Constitucional de Financiamento do Norte',
    descricao: 'Fundo constitucional destinado a empreendimentos na Região Norte, com taxas diferenciadas. Operacionalizado exclusivamente pelo Banco da Amazônia (BASA).',
    finalidades: ['custeio', 'investimento'],
    publico_alvo: 'Produtores rurais e empresas com atividade na Região Norte (AC, AM, AP, MA parcial, MT parcial, PA, RO, RR, TO)',
    requisitos: [
      'Desenvolver atividade produtiva na Região Norte',
      'Regularidade cadastral e ambiental',
      'Projeto técnico aprovado',
      'Adimplência com o BASA e com o FNO',
    ],
    documentos: ['CPF/CNPJ', 'Matrícula do imóvel', 'CAR', 'CCIR', 'ITR', 'Licença ambiental (se aplicável)', 'Projeto técnico', 'Certidões negativas'],
    taxa_juros: '5% a 8,5% a.a. (mini/pequeno) | 8% a 10,5% a.a. (médio/grande)',
    prazo_max: 'Até 20 anos para investimento fixo',
    carencia: 'Até 5 anos',
    garantias: ['Hipoteca', 'Penhor', 'Alienação fiduciária', 'Fundo Garantidor do FNO'],
    operador: 'Banco da Amazônia (BASA)',
    base_legal: ['CF/88 art. 159 I "c"', 'Lei 7.827/1989', 'MCR'],
    ufs_aplicaveis: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
    observacoes: [
      'Tocantins está na área do FNO',
      'Bônus de adimplência de até 25% sobre encargos financeiros',
      'Operacionalizado exclusivamente pelo Banco da Amazônia (BASA)',
    ],
  },
  {
    id: 'fco',
    nome: 'FCO',
    nome_completo: 'Fundo Constitucional de Financiamento do Centro-Oeste',
    descricao: 'Fundo constitucional para a Região Centro-Oeste, operacionalizado pelo Banco do Brasil.',
    finalidades: ['custeio', 'investimento'],
    publico_alvo: 'Produtores rurais e empresas com atividade no Centro-Oeste (DF, GO, MS, MT)',
    requisitos: [
      'Desenvolver atividade produtiva no Centro-Oeste',
      'Regularidade cadastral e ambiental',
      'Projeto técnico aprovado',
    ],
    documentos: ['CPF/CNPJ', 'Matrícula do imóvel', 'CAR', 'CCIR', 'ITR', 'Projeto técnico', 'Certidões negativas'],
    taxa_juros: '5,5% a 8,5% a.a. (mini/pequeno) | 7,5% a 10% a.a. (médio/grande)',
    prazo_max: 'Até 20 anos para investimento fixo',
    carencia: 'Até 5 anos',
    garantias: ['Hipoteca', 'Penhor', 'Alienação fiduciária'],
    operador: 'Banco do Brasil',
    base_legal: ['CF/88 art. 159 I "c"', 'Lei 7.827/1989'],
    ufs_aplicaveis: ['DF', 'GO', 'MS', 'MT'],
    observacoes: [
      'Bônus de adimplência de até 15%',
      'Condições especiais para projetos de irrigação e energias renováveis',
    ],
  },
  {
    id: 'fne',
    nome: 'FNE',
    nome_completo: 'Fundo Constitucional de Financiamento do Nordeste',
    descricao: 'Fundo constitucional para a Região Nordeste e norte de MG/ES, operacionalizado pelo Banco do Nordeste (BNB).',
    finalidades: ['custeio', 'investimento'],
    publico_alvo: 'Produtores rurais e empresas com atividade no Nordeste e norte de MG/ES',
    requisitos: [
      'Desenvolver atividade produtiva na área do FNE',
      'Regularidade cadastral e ambiental',
      'Projeto técnico aprovado',
    ],
    documentos: ['CPF/CNPJ', 'Matrícula do imóvel', 'CAR', 'CCIR', 'ITR', 'Projeto técnico', 'Certidões negativas'],
    taxa_juros: '5% a 8,5% a.a. (mini/pequeno) | 8% a 10% a.a. (médio/grande)',
    prazo_max: 'Até 20 anos para investimento fixo',
    carencia: 'Até 5 anos',
    garantias: ['Hipoteca', 'Penhor', 'Alienação fiduciária'],
    operador: 'Banco do Nordeste (BNB)',
    base_legal: ['CF/88 art. 159 I "c"', 'Lei 7.827/1989'],
    ufs_aplicaveis: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
    observacoes: [
      'Bônus de adimplência de até 25%',
      'Condições especiais para áreas do semiárido',
    ],
  },
  {
    id: 'livre',
    nome: 'Crédito Rural Livre',
    nome_completo: 'Crédito Rural sem Vinculação a Programa Específico',
    descricao: 'Operações de crédito rural com recursos livres, sujeitas a taxas de mercado mas ainda reguladas pelo MCR.',
    finalidades: ['custeio', 'investimento', 'comercializacao', 'industrializacao'],
    publico_alvo: 'Qualquer produtor rural, sem limite de renda',
    requisitos: [
      'Comprovar atividade produtiva rural',
      'Regularidade cadastral (CAR, CCIR, ITR)',
      'Capacidade de pagamento',
      'Garantias suficientes',
    ],
    documentos: ['CPF/CNPJ', 'Matrícula do imóvel', 'CAR', 'CCIR', 'ITR', 'Declaração de IR', 'Projeto técnico'],
    taxa_juros: 'Negociada — geralmente 10% a 14% a.a.',
    prazo_max: 'Conforme negociação com a instituição financeira',
    carencia: 'Conforme negociação',
    garantias: ['Hipoteca', 'Penhor', 'Alienação fiduciária', 'CPR', 'CDA/WA'],
    operador: 'Qualquer instituição do SNCR',
    base_legal: ['Lei 4.829/1965', 'MCR Cap. 6'],
    observacoes: [
      'Sem teto de renda — acessível a grandes produtores',
      'Taxas de mercado, mas sujeitas às regras do MCR',
      'Maior flexibilidade na negociação de garantias e prazos',
    ],
  },
];

// ─── Documentação por finalidade ─────────────────────────────────────────────

export const DOCUMENTOS_BASE: DocumentoFaltante[] = [
  { documento: 'CPF e documento de identidade', obrigatorio: true, como_obter: 'Receita Federal (CPF) / Detran ou SSP (RG)', orgao_emissor: 'Receita Federal / SSP', prazo_estimado: 'Imediato (CPF) / 15 dias (RG)' },
  { documento: 'Matrícula atualizada do imóvel rural', obrigatorio: true, como_obter: 'Solicitar certidão de inteiro teor no Cartório de Registro de Imóveis da comarca', orgao_emissor: 'Cartório de Registro de Imóveis', prazo_estimado: '5 a 15 dias úteis' },
  { documento: 'CCIR (Certificado de Cadastro de Imóvel Rural)', obrigatorio: true, como_obter: 'Emitir pelo portal do INCRA (https://sncr.serpro.gov.br/ccir/emissao)', orgao_emissor: 'INCRA', prazo_estimado: 'Imediato (se cadastro atualizado)' },
  { documento: 'CAR (Cadastro Ambiental Rural)', obrigatorio: true, como_obter: 'Inscrição pelo SICAR (https://car.gov.br)', orgao_emissor: 'SICAR / Secretaria Estadual de Meio Ambiente', prazo_estimado: '1 a 30 dias (inscrição online)' },
  { documento: 'ITR — último recibo de pagamento', obrigatorio: true, como_obter: 'Portal e-CAC da Receita Federal ou declaração de isenção', orgao_emissor: 'Receita Federal', prazo_estimado: 'Imediato (se declaração em dia)' },
  { documento: 'Certidões negativas de débitos (CND federal, estadual, municipal)', obrigatorio: true, como_obter: 'Portais da Receita Federal, PGFN, Sefaz estadual e prefeitura', orgao_emissor: 'Receita Federal / PGFN / Sefaz / Prefeitura', prazo_estimado: 'Imediato a 5 dias' },
  { documento: 'Declaração de Imposto de Renda (IRPF/IRPJ)', obrigatorio: true, como_obter: 'Cópia da última DIRPF/DIRPJ ou declaração de isento', orgao_emissor: 'Receita Federal', prazo_estimado: 'Imediato' },
  { documento: 'Projeto técnico / orçamento (para investimento)', obrigatorio: false, como_obter: 'Contratar engenheiro agrônomo ou técnico agrícola credenciado', orgao_emissor: 'Profissional habilitado (CREA/CFTA)', prazo_estimado: '7 a 30 dias' },
  { documento: 'DAP ou CAF (para Pronaf)', obrigatorio: false, como_obter: 'Solicitar na EMATER, sindicato rural ou entidade credenciada pelo MDA', orgao_emissor: 'EMATER / Sindicato Rural / MDA', prazo_estimado: '5 a 20 dias' },
  { documento: 'Licença ambiental (para atividades sujeitas a licenciamento)', obrigatorio: false, como_obter: 'Secretaria Estadual de Meio Ambiente ou IBAMA (federal)', orgao_emissor: 'SEMA / IBAMA', prazo_estimado: '30 a 180 dias' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UF_REGIAO: Record<string, string> = {
  AC: 'norte', AM: 'norte', AP: 'norte', PA: 'norte', RO: 'norte', RR: 'norte', TO: 'norte',
  AL: 'nordeste', BA: 'nordeste', CE: 'nordeste', MA: 'nordeste', PB: 'nordeste', PE: 'nordeste', PI: 'nordeste', RN: 'nordeste', SE: 'nordeste',
  DF: 'centro_oeste', GO: 'centro_oeste', MS: 'centro_oeste', MT: 'centro_oeste',
  ES: 'sudeste', MG: 'sudeste', RJ: 'sudeste', SP: 'sudeste',
  PR: 'sul', RS: 'sul', SC: 'sul',
};

export function getRegiaoByUF(uf: string): string {
  return UF_REGIAO[uf.toUpperCase()] || 'desconhecida';
}

export function getFundoConstitucional(uf: string): CreditProgramId | null {
  const regiao = getRegiaoByUF(uf);
  if (regiao === 'norte') return 'fno';
  if (regiao === 'centro_oeste') return 'fco';
  if (regiao === 'nordeste') return 'fne';
  return null;
}

export function getProgramById(id: CreditProgramId): CreditProgram | undefined {
  return CREDIT_PROGRAMS.find(p => p.id === id);
}

export function getProgramsByRegiao(uf: string): CreditProgram[] {
  const fundoId = getFundoConstitucional(uf);
  const programas = CREDIT_PROGRAMS.filter(p =>
    !p.ufs_aplicaveis || p.ufs_aplicaveis.includes(uf.toUpperCase())
  );
  if (fundoId) {
    const fundo = getProgramById(fundoId);
    if (fundo && !programas.find(p => p.id === fundoId)) {
      programas.push(fundo);
    }
  }
  return programas;
}

export function getDocumentosParaPrograma(programaId: CreditProgramId): DocumentoFaltante[] {
  const programa = getProgramById(programaId);
  if (!programa) return DOCUMENTOS_BASE.filter(d => d.obrigatorio);
  return DOCUMENTOS_BASE.filter(d => {
    if (d.obrigatorio) return true;
    if (programaId === 'pronaf' && d.documento.includes('DAP')) return true;
    if (d.documento.includes('Projeto técnico')) return true;
    if (d.documento.includes('Licença ambiental')) return false;
    return false;
  });
}

// ─── Valor de referência por hectare (estimativa conservadora por região) ────
// Parâmetros centralizados e datados em config.ts (Plano Safra/CMN).

export function getValorReferenciaPorHectare(uf: string): number {
  const regiao = getRegiaoByUF(uf);
  return VALOR_HECTARE_REGIAO[regiao] || VALOR_HECTARE_PADRAO;
}
