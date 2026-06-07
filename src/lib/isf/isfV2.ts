/**
 * ISF v2 — Motor de Cálculo do Índice de Segurança Fundiária
 *
 * Versão: 2.0
 * Escopo: Determinístico, server-side
 * Entrada: Achados já produzidos pela análise (findings.problemas)
 * Saída: ISF score + scores por eixo + nível de risco + fatores
 *
 * Pesos dos Eixos (configuráveis):
 *   Registral  = 25%
 *   Dominial   = 25%
 *   Litígio    = 20%
 *   Possessório = 15%
 *   Fraude     = 15%
 *
 * Regra de Cálculo:
 *   ISF = 100 - Σ(Eixo_i × Peso_i)
 *   Onde Eixo_i = min(Σ impacto dos achados no eixo, TETO_EIXO)
 *
 * Compatibilidade:
 *   - Convivência obrigatória com score legado (v1)
 *   - Não remove nem altera score atual
 */

// ─── CONSTANTES CONFIGURÁVEIS ───────────────────────────────────────────

/** Teto máximo por eixo (S_E não pode ultrapassar este valor) */
export const TETO_EIXO = 80;

/** Pesos de cada eixo no cálculo do ISF (devem somar 1.0) */
export const PESOS_EIXOS: Record<Eixo, number> = {
  REG: 0.25,
  DOM: 0.25,
  LIT: 0.20,
  POS: 0.15,
  FRA: 0.15,
};

/** Thresholds para classificação de risco */
export const RISK_THRESHOLDS: { faixa: FaixaRisco; min: number; max: number }[] = [
  { faixa: 'critico',     min: 0,  max: 29 },
  { faixa: 'alto_risco',  min: 30, max: 49 },
  { faixa: 'atencao',     min: 50, max: 69 },
  { faixa: 'seguro',      min: 70, max: 84 },
  { faixa: 'muito_seguro',min: 85, max: 100 },
];

/** Labels legíveis para cada faixa */
export const LABEL_FAIXA: Record<FaixaRisco, string> = {
  critico:      'Crítico',
  alto_risco:   'Alto Risco',
  atencao:      'Atenção',
  seguro:       'Seguro',
  muito_seguro: 'Muito Seguro',
};

/** Cores por faixa */
export const COR_FAIXA: Record<FaixaRisco, string> = {
  critico:      '#DC2626',
  alto_risco:   '#F97316',
  atencao:      '#F59E0B',
  seguro:       '#059669',
  muito_seguro: '#10B981',
};

/** Nomes legíveis dos eixos */
export const LABEL_EIXO: Record<Eixo, string> = {
  REG: 'Registral',
  DOM: 'Dominial',
  LIT: 'Litígio',
  POS: 'Possessório',
  FRA: 'Fraude',
};

// ─── TIPOS ──────────────────────────────────────────────────────────────

export type Eixo = 'REG' | 'DOM' | 'LIT' | 'POS' | 'FRA';

export type FaixaRisco = 'muito_seguro' | 'seguro' | 'atencao' | 'alto_risco' | 'critico';

export interface ProblemaEntrada {
  titulo?: string;
  criticidade?: string;
  baseDocumental?: string;
  descricao?: string;
  [key: string]: unknown;
}

export interface EixoScore {
  valor: number;        // S_E = soma dos impactos (limitado ao teto)
  contribuicao: number; // S_E_normalizado × peso_do_eixo (2 casas decimais)
  teto: number;         // máximo do eixo (sempre 80)
  peso: number;         // peso configurável do eixo
  achados: number;      // quantidade de achados no eixo
}

export interface ISFFactor {
  nome: string;
  eixo: Eixo;
  impacto: number;
  criticidade: string;
  descricao: string;
}

export interface ISFResult {
  isf_version: '2.0';
  isf_score: number;
  registral_score: number;
  dominial_score: number;
  litigio_score: number;
  possessorio_score: number;
  fraude_score: number;
  risk_level: FaixaRisco;
  risk_label: string;
  risk_color: string;
  factors: ISFFactor[];
  eixos: Record<Eixo, EixoScore>;
}

export interface ScoreComparison {
  legacy_score: number;
  isf_score: number;
  difference: number;
}

// ─── MAPEAMENTO DE CRITICIDADE PARA IMPACTO ────────────────────────────

/**
 * Mapeia criticidade textual para valor numérico de impacto.
 * Usado quando o achado não tem impacto explícito.
 */
const IMPACTO_POR_CRITICIDADE: Record<string, number> = {
  critica: -50,
  crítica: -50,
  critico: -50,
  crítico: -50,
  alta:    -30,
  alto:    -30,
  media:   -15,
  médio:   -15,
  medio:   -15,
  baixa:    -5,
  baixo:    -5,
};

/**
 * Mapeia palavras-chave para eixos.
 * Usado para classificar achados sem eixo explícito.
 */
const KEYWORDS_POR_EIXO: Record<Eixo, string[]> = {
  REG: [
    'registro', 'registral', 'matrícula', 'matricula', 'cartório', 'cartorio',
    'certidão', 'certidao', 'penhora', 'bloqueio', 'averbação', 'averbacao',
    'registrada', 'registrado', 'intimação', 'intimacao', 'citação', 'citacao',
    'tabelionato', 'registro de imóveis', 'registro de imoveis', 'ri',
    'ônus', 'onus', 'hipoteca', 'cpr', 'alienação fiduciária', 'alienacao fiduciaria',
  ],
  DOM: [
    'cadeia dominial', 'dominial', 'cadeia', 'título', 'titulo', 'escritura',
    'transmissão', 'transmissao', 'aquisição', 'aquisição', 'aquisição',
    'usucapião', 'usucapiao', 'posse', 'domínio', 'dominio', 'proprietário',
    'proprietario', 'herança', 'heranca', 'inventário', 'inventario',
    'partilha', 'sucessão', 'sucessao', 'cônjuge', 'conjuge', 'meação', 'meacao',
    'compropriedade', 'condomínio', 'condominio',
  ],
  LIT: [
    'litígio', 'litigio', 'processo', 'judicial', 'ação', 'acao', 'tribunal',
    'justiça', 'justica', 'demanda', 'reintegração', 'reintegracao',
    'manutenção', 'manutencao', 'interdito', 'proibitório', 'proibitorio',
    'possessória', 'possessoria', 'ação possessória', 'acao possessoria',
    'embargo', 'liminar', 'tutela', 'antecipação', 'antecipacao',
    'recurso', 'apelação', 'apelacao', 'agravo', 'sentença', 'sentenca',
    'execução', 'execucao', 'cumprimento de sentença', 'cumprimento de sentenca',
  ],
  POS: [
    'possessório', 'possessorio', 'posse', 'detenção', 'detencao',
    'ocupação', 'ocupacao', 'invasão', 'invasao', 'esbulho',
    'turbação', 'turbacao', 'área ocupada', 'area ocupada',
    'ocupante', 'posseiro', 'posseira', 'morador', 'moradora',
    'função social', 'funcao social', 'imissão', 'imissao',
    'propriedade produtiva', 'improdutivo',
  ],
  FRA: [
    'fraude', 'falsificação', 'falsificacao', 'falsidade', 'adulteração',
    'adulteracao', 'documento falso', 'documento falsificado',
    'assinatura falsa', 'reconhecimento de firma', 'firma falsa',
    'grilagem', 'grilo', 'falso', 'falsa', 'simulação', 'simulacao',
    'conluio', 'estelionato', 'crime', 'criminal', 'falsidade ideológica',
    'falsidade ideologica', 'falsidade documental', 'falsidade material',
    'cpf falso', 'cnpj falso', 'documento apócrifo', 'documento apocrifo',
    'rasura', 'emenda', 'alteração suspeita', 'alteracao suspeita',
  ],
};

// ─── FUNÇÕES DO MOTOR ──────────────────────────────────────────────────

/**
 * Classifica um problema textual em um eixo ISF.
 * Usa correspondência de palavras-chave.
 */
export function classificarEixo(problema: ProblemaEntrada): Eixo {
  const texto = [
    problema.titulo || '',
    problema.descricao || '',
    problema.baseDocumental || '',
  ].join(' ').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[ç]/g, 'c');            // remove cedilha

  // Pontua cada eixo com base em matches de keywords
  const pontuacao: Record<Eixo, number> = { REG: 0, DOM: 0, LIT: 0, POS: 0, FRA: 0 };

  for (const [eixo, keywords] of Object.entries(KEYWORDS_POR_EIXO)) {
    for (const kw of keywords) {
      if (texto.includes(kw)) {
        pontuacao[eixo as Eixo] += 1;
      }
    }
  }

  // Retorna o eixo com maior pontuação
  let melhorEixo: Eixo = 'REG';
  let melhorPontuacao = 0;

  for (const [eixo, pts] of Object.entries(pontuacao)) {
    if (pts > melhorPontuacao) {
      melhorPontuacao = pts;
      melhorEixo = eixo as Eixo;
    }
  }

  return melhorEixo;
}

/**
 * Extrai o impacto numérico de um problema.
 * Se o problema tiver campo `impacto` explícito, usa ele.
 * Caso contrário, deriva da criticidade textual.
 */
export function extrairImpacto(problema: ProblemaEntrada): number {
  // Tenta usar impacto explícito
  if (typeof problema.impacto === 'number') {
    return problema.impacto;
  }

  // Tenta converter de string
  if (typeof problema.impacto === 'string') {
    const parsed = parseInt(problema.impacto, 10);
    if (!isNaN(parsed)) return parsed;
  }

  // Deriva da criticidade
  const criticidade = (problema.criticidade || '').toLowerCase().trim();
  return IMPACTO_POR_CRITICIDADE[criticidade] ?? -15; // médio como fallback
}

/**
 * Calcula o score de um eixo específico.
 * S_E = min(Σ impactos dos achados no eixo, TETO_EIXO)
 * O resultado é sempre um valor entre 0 e TETO_EIXO.
 */
export function calcularEixo(
  problemas: ProblemaEntrada[],
  eixo: Eixo
): { valor: number; achados: number } {
  let somaImpactos = 0;
  let achados = 0;

  for (const problema of problemas) {
    const eixoClassificado = classificarEixo(problema);
    if (eixoClassificado === eixo) {
      const impacto = Math.abs(extrairImpacto(problema)); // impacto é sempre positivo (0-80)
      somaImpactos += impacto;
      achados++;
    }
  }

  return {
    valor: Math.min(somaImpactos, TETO_EIXO),
    achados,
  };
}

/**
 * Calcula o ISF v2 completo a partir dos achados.
 *
 * @param problemas - Lista de problemas/achados da análise (findings.problemas)
 * @returns ISFResult com todos os scores, nível de risco e fatores
 */
export function calcularISF(problemas: ProblemaEntrada[]): ISFResult {
  const problemasArray = Array.isArray(problemas) ? problemas : [];

  // 1. Calcular score de cada eixo
  const eixosCalc: Record<Eixo, { valor: number; achados: number }> = {
    REG: calcularEixo(problemasArray, 'REG'),
    DOM: calcularEixo(problemasArray, 'DOM'),
    LIT: calcularEixo(problemasArray, 'LIT'),
    POS: calcularEixo(problemasArray, 'POS'),
    FRA: calcularEixo(problemasArray, 'FRA'),
  };

  // 2. Calcular contribuição de cada eixo (S_E × peso)
  const eixos: Record<Eixo, EixoScore> = {} as Record<Eixo, EixoScore>;
  let totalDeduzido = 0;

  for (const eixo of Object.keys(PESOS_EIXOS) as Eixo[]) {
    const peso = PESOS_EIXOS[eixo];
    const { valor, achados } = eixosCalc[eixo];
    const contribuicao = Math.round((valor * peso) * 100) / 100; // 2 casas decimais
    eixos[eixo] = { valor, contribuicao, teto: TETO_EIXO, peso, achados };
    totalDeduzido += contribuicao;
  }

  // 3. Calcular ISF final
  totalDeduzido = Math.round(totalDeduzido * 100) / 100;
  const isfScore = Math.max(0, Math.min(100, Math.round(100 - totalDeduzido)));

  // 4. Determinar faixa de risco
  const riskLevel = classificarRisco(isfScore);

  // 5. Montar fatores de redução (ordenados do maior impacto para o menor)
  const factors: ISFFactor[] = [];
  for (const problema of problemasArray) {
    const eixo = classificarEixo(problema);
    const impacto = Math.abs(extrairImpacto(problema));
    factors.push({
      nome: problema.titulo || 'Achado não nomeado',
      eixo,
      impacto,
      criticidade: problema.criticidade || 'médio',
      descricao: problema.descricao || problema.baseDocumental || '',
    });
  }
  // Ordenar do maior impacto para o menor
  factors.sort((a, b) => b.impacto - a.impacto);

  return {
    isf_version: '2.0',
    isf_score: isfScore,
    registral_score: eixos.REG.valor,
    dominial_score: eixos.DOM.valor,
    litigio_score: eixos.LIT.valor,
    possessorio_score: eixos.POS.valor,
    fraude_score: eixos.FRA.valor,
    risk_level: riskLevel,
    risk_label: LABEL_FAIXA[riskLevel],
    risk_color: COR_FAIXA[riskLevel],
    factors,
    eixos,
  };
}

/**
 * Classifica o ISF score em uma faixa de risco.
 */
export function classificarRisco(score: number): FaixaRisco {
  for (const threshold of RISK_THRESHOLDS) {
    if (score >= threshold.min && score <= threshold.max) {
      return threshold.faixa;
    }
  }
  // Fallback (não deve ocorrer)
  if (score >= 85) return 'muito_seguro';
  if (score >= 70) return 'seguro';
  if (score >= 50) return 'atencao';
  if (score >= 30) return 'alto_risco';
  return 'critico';
}

/**
 * Calcula a comparação entre score legado (v1) e ISF v2.
 *
 * @param legacyScore - Score calculado pelo motor legado (calcularScoreAgroLex)
 * @param isfScore - Score calculado pelo ISF v2
 * @returns ScoreComparison com diferença
 */
export function calcularComparacao(
  legacyScore: number,
  isfScore: number
): ScoreComparison {
  return {
    legacy_score: legacyScore,
    isf_score: isfScore,
    difference: Math.round((isfScore - legacyScore) * 100) / 100,
  };
}

/**
 * Valida se os pesos dos eixos somam 1.0 (100%).
 * Útil para testes e configuração.
 */
export function validarPesos(): boolean {
  const soma = Object.values(PESOS_EIXOS).reduce((acc, p) => acc + p, 0);
  return Math.abs(soma - 1.0) < 0.001;
}