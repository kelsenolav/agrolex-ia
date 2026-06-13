/**
 * ISF v2 — Motor de Cálculo do Índice de Segurança Fundiária (isfEngine)
 *
 * Versão: 2.0
 * Escopo: Determinístico, server-side
 * Entrada: Achados já produzidos pela análise (findings.problemas)
 * Saída: ISF score + scores por eixo + nível de risco + fatores + flag de veto aplicado
 *
 * Pesos dos Eixos:
 *   Registral   = 25%
 *   Dominial    = 25%
 *   Litígio     = 20%
 *   Possessório = 15%
 *   Fraude      = 15%
 *
 * Regra de Cálculo:
 *   ISF = 100 - Σ(Eixo_i × Peso_i)
 *   Onde Eixo_i = min(Σ impacto dos achados no eixo, TETO_EIXO)
 *
 * Trava de Segurança CTO (Veto de Risco):
 *   Se houver qualquer achado com criticidade "crítica" ou marcado como isVetoRisco,
 *   o isf_score final deve ser limitado ao máximo de 30 pontos.
 */

// ─── CONSTANTES CONFIGURÁVEIS ───────────────────────────────────────────

export const TETO_EIXO = 80;

export const PESOS_EIXOS: Record<Eixo, number> = {
  REG: 0.25,
  DOM: 0.25,
  LIT: 0.20,
  POS: 0.15,
  FRA: 0.15,
};

export const RISK_THRESHOLDS: { faixa: FaixaRisco; min: number; max: number }[] = [
  { faixa: 'critico',      min: 0,  max: 39 },
  { faixa: 'alto_risco',   min: 40, max: 59 },
  { faixa: 'atencao',      min: 60, max: 79 },
  { faixa: 'seguro',       min: 80, max: 89 },
  { faixa: 'muito_seguro', min: 90, max: 100 },
];

export const LABEL_FAIXA: Record<FaixaRisco, string> = {
  critico:      'Crítico',
  alto_risco:   'Alto Risco',
  atencao:      'Atenção',
  seguro:       'Seguro',
  muito_seguro: 'Muito Seguro',
};

export const COR_FAIXA: Record<FaixaRisco, string> = {
  critico:      '#DC2626',
  alto_risco:   '#F97316',
  atencao:      '#F59E0B',
  seguro:       '#059669',
  muito_seguro: '#10B981',
};

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
  impacto?: number | string;
  isVetoRisco?: boolean;
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
  is_veto_applied: boolean;
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

// ─── MAPEAMENTO DE CRITICIDADE PARA IMPACTO ────────────────────────────

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
    'transmissão', 'transmissao', 'aquisição', 'usucapião', 'usucapiao',
    'posse', 'domínio', 'dominio', 'proprietário', 'proprietario', 'herança',
    'heranca', 'inventário', 'inventario', 'partilha', 'sucessão', 'sucessao',
    'cônjuge', 'conjuge', 'meação', 'meacao', 'compropriedade', 'condomínio',
    'condominio',
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

export function sanitizarProblema(problema: any): ProblemaEntrada {
  if (!problema || typeof problema !== 'object') {
    return {
      titulo: 'Achado inválido',
      criticidade: 'baixo',
      baseDocumental: '',
      descricao: 'Achado malformado ignorado ou sanitizado.',
      impacto: 0,
      isVetoRisco: false,
    };
  }

  const result: ProblemaEntrada = {
    titulo: typeof problema.titulo === 'string' ? problema.titulo : 'Achado sem título',
    criticidade: typeof problema.criticidade === 'string' ? problema.criticidade : 'baixo',
    baseDocumental: typeof problema.baseDocumental === 'string' ? problema.baseDocumental : '',
    descricao: typeof problema.descricao === 'string' ? problema.descricao : '',
    isVetoRisco: typeof problema.isVetoRisco === 'boolean' ? problema.isVetoRisco : false,
    impacto: 0,
  };

  if (problema.impacto !== undefined) {
    result.impacto = problema.impacto;
  } else if (typeof problema.criticidade === 'string') {
    delete result.impacto;
  }

  return result;
}

export function classificarEixo(problema: ProblemaEntrada): Eixo {
  const safeP = sanitizarProblema(problema);
  const texto = [
    safeP.titulo || '',
    safeP.descricao || '',
    safeP.baseDocumental || '',
  ].join(' ').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ç]/g, 'c');

  const pontuacao: Record<Eixo, number> = { REG: 0, DOM: 0, LIT: 0, POS: 0, FRA: 0 };

  for (const [eixo, keywords] of Object.entries(KEYWORDS_POR_EIXO)) {
    for (const kw of keywords) {
      if (texto.includes(kw)) {
        pontuacao[eixo as Eixo] += 1;
      }
    }
  }

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

export function extrairImpacto(problema: ProblemaEntrada): number {
  const safeP = sanitizarProblema(problema);
  if (typeof safeP.impacto === 'number') {
    return safeP.impacto;
  }

  if (typeof safeP.impacto === 'string') {
    const parsed = parseInt(safeP.impacto, 10);
    if (!isNaN(parsed)) return parsed;
  }

  const criticidade = (safeP.criticidade || '').toLowerCase().trim();
  return IMPACTO_POR_CRITICIDADE[criticidade] ?? -15; // médio como fallback
}

export function calcularEixo(
  problemas: ProblemaEntrada[],
  eixo: Eixo
): { valor: number; achados: number } {
  let somaImpactos = 0;
  let achados = 0;

  for (const problema of problemas) {
    const eixoClassificado = classificarEixo(problema);
    if (eixoClassificado === eixo) {
      const impacto = Math.abs(extrairImpacto(problema));
      somaImpactos += impacto;
      achados++;
    }
  }

  return {
    valor: Math.min(somaImpactos, TETO_EIXO),
    achados,
  };
}

export function classificarRisco(score: number): FaixaRisco {
  for (const threshold of RISK_THRESHOLDS) {
    if (score >= threshold.min && score <= threshold.max) {
      return threshold.faixa;
    }
  }
  if (score >= 90) return 'muito_seguro';
  if (score >= 80) return 'seguro';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'alto_risco';
  return 'critico';
}

export function calcularISF(problemas: ProblemaEntrada[]): ISFResult {
  const problemasArray = (Array.isArray(problemas) ? problemas : [])
    .map(p => sanitizarProblema(p));

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
    const contribuicao = Math.round((valor * peso) * 100) / 100;
    eixos[eixo] = { valor, contribuicao, teto: TETO_EIXO, peso, achados };
    totalDeduzido += contribuicao;
  }

  // 3. Calcular ISF preliminar
  totalDeduzido = Math.round(totalDeduzido * 100) / 100;
  let isfScore = Math.max(0, Math.min(100, Math.round(100 - totalDeduzido)));

  // 4. Aplicar Trava de Segurança CTO (Veto de Risco)
  let isVetoApplied = false;
  const temVeto = problemasArray.some(p => {
    const criticidade = String(p.criticidade || '').toLowerCase().trim();
    return p.isVetoRisco === true ||
           criticidade === 'critica' ||
           criticidade === 'crítica' ||
           criticidade === 'critico' ||
           criticidade === 'crítico';
  });

  if (temVeto) {
    if (isfScore > 30) {
      isfScore = 30;
      isVetoApplied = true;
    }
  }

  // 5. Determinar faixa de risco
  const riskLevel = classificarRisco(isfScore);

  // 6. Montar fatores de redução
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
  factors.sort((a, b) => b.impacto - a.impacto);

  return {
    isf_version: '2.0',
    isf_score: isfScore,
    is_veto_applied: isVetoApplied,
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

export function validarPesos(): boolean {
  const soma = Object.values(PESOS_EIXOS).reduce((acc, p) => acc + p, 0);
  return Math.abs(soma - 1.0) < 0.001;
}

export { calcularISF as calcularISFv2 };

