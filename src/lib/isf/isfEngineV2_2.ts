/**
 * ISF v2.2 — Motor de Cálculo do Índice de Segurança Fundiária
 *
 * Versão: 2.2
 * Metodologia: 6 dimensões ponderadas (Kelsen Bruno Advocacia — OAB/TO 10.237)
 * Escopo: Determinístico, server-side
 * Entrada: Pontuações por dimensão (0–100) selecionadas pela IA ou manualmente
 * Saída: ISF score + scores por dimensão + nível de risco + alertas + laudo
 *
 * Dimensões e Pesos:
 *   D1 — Origem do título         = 30%
 *   D2 — Cadeia dominial           = 25%
 *   D3 — Integridade registral     = 20%
 *   D4 — Conformidade ambiental    = 10%
 *   D5 — Histórico litigioso       = 10%
 *   D6 — Contexto geopolítico      =  5%
 *
 * Regra de Cálculo:
 *   ISF = Σ(pontuação_dimensão × peso_dimensão)
 *   Onde todas as dimensões devem ser preenchidas (0–100).
 *
 * Faixas de Classificação:
 *   Seguro      = 85–100
 *   Regular     = 70–84
 *   Atenção     = 55–69
 *   Alto Risco  = 40–54
 *   Crítico     = 25–39
 *   Inválido    = 0–24
 *
 * Alertas Condicionais (por dimensão):
 *   D1 ≤ 30 → Vício originário — contamina toda a cadeia
 *   D2 ≤ 25 → Lacunas graves — risco de evicção total
 *   D3 ≤ 35 → Ônus/gravames críticos na matrícula
 *   D4 ≤ 15 → Sobreposição com área protegida ou CAR ausente
 *   D5 ≤ 20 → Ação/sentença desfavorável em curso
 *   D6 ≤ 15 → Território com alta pressão fundiária
 *
 * Convive com isfEngine.ts (v2.1) — versões independentes.
 */

// ─── CONSTANTES CONFIGURÁVEIS ───────────────────────────────────────────

/** Dimensões da metodologia v2.2 */
export const DIMENSOES_V2_2 = [
  {
    id: 'D1',
    nome: 'Origem do título',
    peso: 0.30,
    icon: '📜',
    descricao: 'Base originária do domínio. Vício na origem contamina toda a cadeia subsequente de forma irremediável.',
    itens: [
      { label: 'Sesmaria confirmada + usucapião judicial transitada em julgado', pts: 100 },
      { label: 'Título INCRA definitivo — Reforma Agrária (Lei 8.629/93, art. 18)', pts: 90 },
      { label: 'Título INCRA provisório com cláusula resolutiva comprovadamente cumprida', pts: 75 },
      { label: 'Compra e venda com cadeia dominial completa até terra devoluta documentada', pts: 70 },
      { label: 'Usucapião extrajudicial registrado (art. 216-A LRP)', pts: 65 },
      { label: 'Título estadual (ITERTINS/ITERMA) em área sem conflito com domínio da União', pts: 60 },
      { label: 'Regularização fundiária (Reurb/Terra Legal — Lei 13.465/2017)', pts: 55 },
      { label: 'Título INCRA provisório com cláusula resolutiva não cumprida', pts: 30 },
      { label: 'Sem título identificável — posse de fato apenas, sem reconhecimento formal', pts: 10 },
    ],
    alertaMin: 30,
    alertaMensagem: 'Vício originário não se sana por transmissões posteriores. Toda a cadeia está comprometida.',
    alertaTipo: 'critico',
  },
  {
    id: 'D2',
    nome: 'Cadeia dominial',
    peso: 0.25,
    icon: '🔗',
    descricao: 'Continuidade, consistência geográfica e temporal de todas as transmissões registradas no CRI.',
    itens: [
      { label: 'Cadeia completa até a origem, sem lacunas, área consistente em todos os registros', pts: 100 },
      { label: 'Cadeia completa, variação de área ≤5% com justificativa técnica (georreferenciamento)', pts: 85 },
      { label: 'Cadeia completa, variação de área ≤5% sem justificativa técnica formalizada', pts: 70 },
      { label: 'Uma lacuna de transmitente isolada, demais registros consistentes', pts: 50 },
      { label: 'Transmissão em período de restrição legal (litígio ou interdição averbados)', pts: 35 },
      { label: 'Transmitente sem capacidade ou legitimidade (espólio s/ inventário, PJ extinta)', pts: 25 },
      { label: 'Duas ou mais lacunas na cadeia dominial', pts: 15 },
      { label: 'Cadeia não reconstituível — registros anteriores inexistentes ou destruídos', pts: 5 },
    ],
    alertaMin: 25,
    alertaMensagem: 'Lacunas graves expõem o título a risco de evicção total pelo verdadeiro proprietário.',
    alertaTipo: 'critico',
  },
  {
    id: 'D3',
    nome: 'Integridade registral',
    peso: 0.20,
    icon: '🏛️',
    descricao: 'Estado atual da matrícula no CRI: ônus, gravames, georreferenciamento e averbações.',
    itens: [
      { label: 'Matrícula limpa + georreferenciamento INCRA certificado (Lei 10.267/2001)', pts: 100 },
      { label: 'Matrícula limpa + certificação SIGEF sem sobreposição confirmada', pts: 90 },
      { label: 'Matrícula limpa, sem georreferenciamento ou certificação SIGEF', pts: 70 },
      { label: 'Hipoteca ou alienação fiduciária registrada (dentro do prazo, com folga)', pts: 55 },
      { label: 'Inconsistência de área com CAR/SIGEF/INCRA superior a 5%', pts: 45 },
      { label: 'Penhora ou bloqueio judicial registrado na matrícula', pts: 35 },
      { label: 'Indisponibilidade registrada (BACENJUD/Receita Federal/CNJ)', pts: 30 },
      { label: 'Ação real ou pessoal reipersecutória averbada (art. 167, II, 12, LRP)', pts: 20 },
      { label: 'Averbação de usucapião por terceiro na própria matrícula', pts: 10 },
    ],
    alertaMin: 35,
    alertaMensagem: 'Matrícula com ônus ou gravames críticos. Verificar prioritariamente no CRI antes de qualquer ato.',
    alertaTipo: 'alerta',
  },
  {
    id: 'D4',
    nome: 'Conformidade ambiental e administrativa',
    peso: 0.10,
    icon: '🌿',
    descricao: 'CAR, CCIR, ITR, APP, reserva legal e sobreposições com áreas ambientalmente protegidas.',
    itens: [
      { label: 'CAR ativo sem pendências + PRA assinado + ITR em dia + CCIR atualizado', pts: 100 },
      { label: 'CAR ativo sem pendências + ITR em dia + CCIR atualizado (sem PRA)', pts: 85 },
      { label: 'CAR ativo com pequenas inconsistências + ITR em dia', pts: 65 },
      { label: 'CAR em análise ou com inconsistências relevantes pendentes de regularização', pts: 45 },
      { label: 'Sobreposição com APP ou Reserva Legal não averbada e não regularizada', pts: 35 },
      { label: 'Débito de ITR com inscrição na dívida ativa', pts: 25 },
      { label: 'CAR cancelado ou ausente no SICAR', pts: 15 },
      { label: 'Sobreposição com UC, Terra Indígena não demarcada ou área quilombola', pts: 5 },
    ],
    alertaMin: 15,
    alertaMensagem: 'Sobreposição com área protegida ou CAR ausente. Risco de embargo e bloqueio de transmissão.',
    alertaTipo: 'alerta',
  },
  {
    id: 'D5',
    nome: 'Histórico litigioso',
    peso: 0.10,
    icon: '⚖️',
    descricao: 'Ações judiciais, processos administrativos e representações vinculadas ao imóvel ou à matrícula.',
    itens: [
      { label: 'Sem qualquer ação judicial ou administrativa vinculada à matrícula', pts: 100 },
      { label: 'Ação anterior com resolução de mérito favorável ao titular (transitada)', pts: 85 },
      { label: 'Ação anterior extinta sem resolução de mérito, sem recidiva posterior', pts: 80 },
      { label: 'Processo administrativo INCRA encerrado sem reversão do título', pts: 70 },
      { label: 'Ação em curso sobre o imóvel (qualquer espécie, em qualquer instância)', pts: 30 },
      { label: 'Processo administrativo INCRA de revisão ou cancelamento do título em curso', pts: 20 },
      { label: 'Representação correicional em CGJ/TO, CNJ ou notícia de fato ao MP sobre o registro', pts: 15 },
      { label: 'Usucapião proposta por terceiro em curso, em qualquer instância', pts: 10 },
      { label: 'Sentença desfavorável transitada em julgado (mesmo que objeto de recurso pendente)', pts: 5 },
    ],
    alertaMin: 20,
    alertaMensagem: 'Ação ou sentença desfavorável em curso. Risco imediato e real de perda da titularidade.',
    alertaTipo: 'critico',
  },
  {
    id: 'D6',
    nome: 'Fatores contextuais e geopolíticos',
    peso: 0.05,
    icon: '🗺️',
    descricao: 'Dinâmica fundiária do território: conflitos regionais, pressão de posseiros, reforma agrária e grilagem.',
    itens: [
      { label: 'Município consolidado, baixo índice histórico de conflitos fundiários registrados', pts: 100 },
      { label: 'Município em expansão agrícola sem pressão fundiária relevante documentada', pts: 80 },
      { label: 'Município com pressão de posseiros, sem conflitos registrados no imóvel específico', pts: 60 },
      { label: 'Município com PNRA ativo ou histórico de assentamentos na região do imóvel', pts: 45 },
      { label: 'Imóvel vizinho a assentamento INCRA ou área de reforma agrária demarcada', pts: 35 },
      { label: 'Município com histórico documentado de grilagem ou fraude registral sistêmica', pts: 20 },
      { label: 'Imóvel em fronteira agrícola com pressão organizada de posseiros ou movimentos', pts: 15 },
      { label: 'Sobreposição com área reivindicada por comunidade quilombola ou indígena', pts: 5 },
    ],
    alertaMin: 15,
    alertaMensagem: 'Território com alta pressão fundiária. Risco de conflito possessório independente da qualidade formal do título.',
    alertaTipo: 'alerta',
  },
] as const;

export const DIMENSOES_MAP = Object.fromEntries(
  DIMENSOES_V2_2.map(d => [d.id, d])
) as Record<string, (typeof DIMENSOES_V2_2)[number]>;

export const PESOS_DIMENSOES_V2_2: Record<string, number> = Object.fromEntries(
  DIMENSOES_V2_2.map(d => [d.id, d.peso])
);

export const TOTAL_PESOS_V2_2 = Object.values(PESOS_DIMENSOES_V2_2).reduce((a, b) => a + b, 0);

/** Faixas de classificação da metodologia v2.2 */
export const FAIXAS_V2_2: { faixa: FaixaRiscoV2_2; min: number; max: number; label: string; bg: string; color: string; meter: string; desc: string }[] = [
  {
    faixa: 'seguro', min: 85, max: 100, label: 'Seguro', bg: '#D5F5E3', color: '#085041', meter: '#1D9E75',
    desc: 'Título sólido. Risco de contestação mínimo. Apto para garantia bancária, transação e investimento sem restrições adicionais.',
  },
  {
    faixa: 'regular', min: 70, max: 84, label: 'Regular', bg: '#EAF3DE', color: '#3B6D11', meter: '#639922',
    desc: 'Título razoável com pontos de atenção. Recomenda-se due diligence complementar antes de transação relevante ou oferecimento em garantia.',
  },
  {
    faixa: 'atencao', min: 55, max: 69, label: 'Atenção', bg: '#FEF9E7', color: '#854F0B', meter: '#EF9F27',
    desc: 'Vulnerabilidades identificadas. Não recomendável como garantia primária. Exige regularização prévia a qualquer negociação.',
  },
  {
    faixa: 'alto_risco', min: 40, max: 54, label: 'Alto Risco', bg: '#FAEEDA', color: '#633806', meter: '#BA7517',
    desc: 'Título contestável. Probabilidade real de demanda judicial ou administrativa. Regularização urgente ou estratégia defensiva necessária.',
  },
  {
    faixa: 'critico', min: 25, max: 39, label: 'Crítico', bg: '#FCEBEB', color: '#791F1F', meter: '#E24B4A',
    desc: 'Título gravemente comprometido. Não realizar qualquer operação patrimonial sem análise judicial completa e planejamento estratégico.',
  },
  {
    faixa: 'invalido', min: 0, max: 24, label: 'Inválido', bg: '#F7C1C1', color: '#501313', meter: '#A32D2D',
    desc: 'Título presumivelmente nulo ou fraudulento. Não negociar. Comunicar CGJ/TO, MP/TO e autoridades competentes imediatamente.',
  },
];

// ─── TIPOS ──────────────────────────────────────────────────────────────

export type FaixaRiscoV2_2 = 'seguro' | 'regular' | 'atencao' | 'alto_risco' | 'critico' | 'invalido';

export type AlertaTipo = 'critico' | 'alerta';

export interface DimensaoScore {
  id: string;
  nome: string;
  pontuacao: number;       // 0–100
  contribuicao: number;    // pontuação × peso
  peso: number;            // peso configurável da dimensão
  itemSelecionado: string; // label do item escolhido
}

export interface ISFAlert {
  dimensaoId: string;
  dimensaoNome: string;
  tipo: AlertaTipo;
  mensagem: string;
}

export interface ISFResultV2_2 {
  isf_version: '2.2';
  isf_score: number;               // 0–100
  /** Score bruto antes das travas de teto (para diagnóstico) */
  isf_score_bruto: number;
  faixa: FaixaRiscoV2_2;
  faixa_label: string;
  faixa_desc: string;
  faixa_bg: string;
  faixa_color: string;
  faixa_meter: string;
  dimensoes: DimensaoScore[];
  alertas: ISFAlert[];
  /** Dimensões que não foram preenchidas (se houver) */
  dimensoesFaltantes: string[];
  /** Se true, o cálculo está incompleto (alguma dimensão não preenchida) */
  incompleto: boolean;
  /** Travas de teto aplicadas (vazia se nenhuma) */
  travas_aplicadas: string[];
}

export interface PontuacaoEntradaV2_2 {
  /** ID da dimensão (D1–D6) */
  dimensaoId: string;
  /** Pontuação de 0–100 */
  pontuacao: number;
  /** Label do item selecionado (opcional, para auditoria) */
  itemSelecionado?: string;
}

// ─── FUNÇÕES DO MOTOR ──────────────────────────────────────────────────

/**
 * Valida se a soma dos pesos é 1.0 (100%).
 */
export function validarPesosV2_2(): boolean {
  const soma = Object.values(PESOS_DIMENSOES_V2_2).reduce((acc, p) => acc + p, 0);
  return Math.abs(soma - 1.0) < 0.001;
}

/**
 * Classifica o score ISF em uma faixa de risco.
 */
export function classificarFaixaV2_2(score: number): typeof FAIXAS_V2_2[number] {
  for (const faixa of FAIXAS_V2_2) {
    if (score >= faixa.min && score <= faixa.max) {
      return faixa;
    }
  }
  // Fallback (nunca deve acontecer com score 0–100)
  return FAIXAS_V2_2[FAIXAS_V2_2.length - 1]; // invalido
}

/**
 * Gera alertas condicionais baseados nas pontuações por dimensão.
 *
 * Regras:
 * - D1 (Origem) ≤ 30 → crítico
 * - D2 (Cadeia dominial) ≤ 25 → crítico
 * - D3 (Integridade registral) ≤ 35 → alerta
 * - D4 (Conformidade ambiental) ≤ 15 → alerta
 * - D5 (Histórico litigioso) ≤ 20 → crítico
 * - D6 (Contexto geopolítico) ≤ 15 → alerta
 */
export function gerarAlertasV2_2(
  pontuacoes: PontuacaoEntradaV2_2[]
): ISFAlert[] {
  const alertas: ISFAlert[] = [];
  const mapaPontuacoes = new Map(pontuacoes.map(p => [p.dimensaoId, p.pontuacao]));

  for (const dim of DIMENSOES_V2_2) {
    const pontuacao = mapaPontuacoes.get(dim.id);
    if (pontuacao !== undefined && pontuacao <= dim.alertaMin) {
      alertas.push({
        dimensaoId: dim.id,
        dimensaoNome: dim.nome,
        tipo: dim.alertaTipo as AlertaTipo,
        mensagem: dim.alertaMensagem,
      });
    }
  }

  // Ordenar: críticos primeiro, depois alertas
  alertas.sort((a, b) => {
    if (a.tipo === 'critico' && b.tipo !== 'critico') return -1;
    if (a.tipo !== 'critico' && b.tipo === 'critico') return 1;
    return 0;
  });

  return alertas;
}

/**
 * Calcula o ISF v2.2 a partir de pontuações por dimensão.
 *
 * Fórmula: ISF = Σ(pontuação × peso) / Σpesos_preenchidos
 *
 * Se alguma dimensão não for fornecida, o cálculo é feito apenas com
 * as dimensões preenchidas e o resultado é marcado como incompleto.
 *
 * @param pontuacoes - Array de pontuações por dimensão (D1–D6, 0–100)
 * @returns Resultado completo do ISF v2.2
 */
export function calcularISFV2_2(
  pontuacoes: PontuacaoEntradaV2_2[]
): ISFResultV2_2 {
  const entradasMap = new Map(pontuacoes.map(p => [p.dimensaoId, p]));
  const dimensoes: DimensaoScore[] = [];
  const dimensoesFaltantes: string[] = [];
  let somaPonderada = 0;
  let somaPesosPreenchidos = 0;

  for (const dim of DIMENSOES_V2_2) {
    const entrada = entradasMap.get(dim.id);

    if (entrada && typeof entrada.pontuacao === 'number' && !isNaN(entrada.pontuacao)) {
      const pontuacao = Math.max(0, Math.min(100, Math.round(entrada.pontuacao)));
      const contribuicao = Math.round((pontuacao * dim.peso) * 100) / 100;
      somaPonderada += contribuicao;
      somaPesosPreenchidos += dim.peso;

      dimensoes.push({
        id: dim.id,
        nome: dim.nome,
        pontuacao,
        contribuicao,
        peso: dim.peso,
        itemSelecionado: entrada.itemSelecionado || 'Não especificado',
      });
    } else {
      dimensoesFaltantes.push(dim.id);
      dimensoes.push({
        id: dim.id,
        nome: dim.nome,
        pontuacao: 0,
        contribuicao: 0,
        peso: dim.peso,
        itemSelecionado: 'Não analisada',
      });
    }
  }

  const incompleto = dimensoesFaltantes.length > 0;

  // ISF = média ponderada normalizada para escala 0–100
  let isfScore: number;
  if (somaPesosPreenchidos === 0) {
    isfScore = 0;
  } else {
    // Normalizar: somaPonderada / somaPesosPreenchidos
    isfScore = Math.round((somaPonderada / somaPesosPreenchidos) * 100) / 100;
    isfScore = Math.round(isfScore); // ISF final é inteiro
  }

  isfScore = Math.max(0, Math.min(100, isfScore));

  // Guardar score bruto antes das travas (para diagnóstico)
  const isfScoreBruto = isfScore;

  // ─── TRAVAS DE TETO ──────────────────────────────────────────────────
  const travas_aplicadas: string[] = [];

  // Trava 1 — D1 ausente (Origem do título não analisada)
  // Sem análise da origem, o título é presumivelmente frágil. Teto máximo = 39 (Crítico).
  if (dimensoesFaltantes.includes('D1')) {
    isfScore = Math.min(isfScore, 39);
    travas_aplicadas.push('TRAVA_D1_AUSENTE: Origem do título não analisada — teto máximo 39 (Crítico)');
  }

  // Trava 2 — D2 ausente (Cadeia dominial não analisada)
  // Sem análise da cadeia dominial, risco de evicção não pode ser descartado. Teto máximo = 54 (Alto Risco).
  if (dimensoesFaltantes.includes('D2')) {
    isfScore = Math.min(isfScore, 54);
    travas_aplicadas.push('TRAVA_D2_AUSENTE: Cadeia dominial não analisada — teto máximo 54 (Alto Risco)');
  }

  // Trava 3 — D1 frágil (≤30, vício originário)
  // Vício na origem contamina toda a cadeia. Teto máximo = 39 (Crítico) se D1 ≤ 30.
  const scoreD1 = entradasMap.get('D1');
  if (scoreD1 && typeof scoreD1.pontuacao === 'number' && !isNaN(scoreD1.pontuacao)) {
    const ptD1 = Math.max(0, Math.min(100, Math.round(scoreD1.pontuacao)));
    if (ptD1 <= 30) {
      isfScore = Math.min(isfScore, 39);
      travas_aplicadas.push(`TRAVA_D1_VICIO: D1 = ${ptD1} (vício originário ≤ 30) — teto máximo 39 (Crítico)`);
    }
  }

  // Trava 4 — D2 frágil (≤25, lacunas graves)
  // Duas ou mais lacunas ou cadeia não reconstituível. Teto máximo = 39 (Crítico) se D2 ≤ 25.
  const scoreD2 = entradasMap.get('D2');
  if (scoreD2 && typeof scoreD2.pontuacao === 'number' && !isNaN(scoreD2.pontuacao)) {
    const ptD2 = Math.max(0, Math.min(100, Math.round(scoreD2.pontuacao)));
    if (ptD2 <= 25) {
      isfScore = Math.min(isfScore, 39);
      travas_aplicadas.push(`TRAVA_D2_LACUNAS: D2 = ${ptD2} (lacunas graves ≤ 25) — teto máximo 39 (Crítico)`);
    }
  }

  // Trava 5 — D1 + D2 ambos frágeis ou ausentes
  // Combinação letal: sem origem E sem cadeia. Teto máximo = 24 (Inválido).
  const d1Analisada = !dimensoesFaltantes.includes('D1');
  const d2Analisada = !dimensoesFaltantes.includes('D2');
  const d1Fragil = d1Analisada && (() => { const e = entradasMap.get('D1')!; return Math.max(0, Math.min(100, Math.round(e.pontuacao))) <= 30; })();
  const d2Fragil = d2Analisada && (() => { const e = entradasMap.get('D2')!; return Math.max(0, Math.min(100, Math.round(e.pontuacao))) <= 25; })();
  const d1Critica = !d1Analisada || d1Fragil;
  const d2Critica = !d2Analisada || d2Fragil;

  if (d1Critica && d2Critica) {
    isfScore = Math.min(isfScore, 24);
    travas_aplicadas.push('TRAVA_D1_D2_COMBINADA: Origem E Cadeia dominial críticas/ausentes — teto máximo 24 (Inválido)');
  }

  // Trava 6 — D3 com ação real reipersecutória ou usucapião por terceiro (≤20)
  // Risco imediato de perda. Teto máximo = 39 (Crítico) se D3 ≤ 20.
  const scoreD3 = entradasMap.get('D3');
  if (scoreD3 && typeof scoreD3.pontuacao === 'number' && !isNaN(scoreD3.pontuacao)) {
    const ptD3 = Math.max(0, Math.min(100, Math.round(scoreD3.pontuacao)));
    if (ptD3 <= 20) {
      isfScore = Math.min(isfScore, 39);
      travas_aplicadas.push(`TRAVA_D3_GRAVAME: D3 = ${ptD3} (ação real reipersecutória ou usucapião ≤ 20) — teto máximo 39 (Crítico)`);
    }
  }

  const faixa = classificarFaixaV2_2(isfScore);
  const alertas = gerarAlertasV2_2(pontuacoes);

  return {
    isf_version: '2.2',
    isf_score: isfScore,
    isf_score_bruto: isfScoreBruto,
    faixa: faixa.faixa,
    faixa_label: faixa.label,
    faixa_desc: faixa.desc,
    faixa_bg: faixa.bg,
    faixa_color: faixa.color,
    faixa_meter: faixa.meter,
    dimensoes,
    alertas,
    dimensoesFaltantes,
    incompleto,
    travas_aplicadas,
  };
}

/**
 * Busca o item mais próximo de uma pontuação dentro dos itens de uma dimensão.
 * Útil para mapear uma pontuação numérica para um label descritivo.
 *
 * @param dimensaoId - ID da dimensão (D1–D6)
 * @param pontuacao - Pontuação alvo (0–100)
 * @returns Label do item mais próximo
 */
export function encontrarItemProximo(dimensaoId: string, pontuacao: number): string {
  const dim = DIMENSOES_MAP[dimensaoId];
  if (!dim) return 'Dimensão desconhecida';

  const itens = dim.itens as readonly { label: string; pts: number }[];
  let melhor = itens[0];
  let menorDistancia = Math.abs(melhor.pts - pontuacao);

  for (const item of itens) {
    const distancia = Math.abs(item.pts - pontuacao);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = item;
    }
  }

  return melhor.label;
}

/**
 * Converte um resultado ISF v2.2 para um formato compatível com
 * o payload de persistência existente (findings.isf_v2_2).
 */
export function prepararPayloadV2_2(isfResult: ISFResultV2_2): Record<string, unknown> {
  return {
    isf_v2_2: {
      isf_version: isfResult.isf_version,
      isf_score: isfResult.isf_score,
      isf_score_bruto: isfResult.isf_score_bruto,
      faixa: isfResult.faixa,
      faixa_label: isfResult.faixa_label,
      faixa_desc: isfResult.faixa_desc,
      faixa_bg: isfResult.faixa_bg,
      faixa_color: isfResult.faixa_color,
      faixa_meter: isfResult.faixa_meter,
      dimensoes: isfResult.dimensoes,
      alertas: isfResult.alertas,
      dimensoes_faltantes: isfResult.dimensoesFaltantes,
      incompleto: isfResult.incompleto,
      travas_aplicadas: isfResult.travas_aplicadas,
    },
  };
}

/**
 * Tenta inferir pontuações por dimensão a partir de achados textuais (problemas).
 *
 * Esta é uma função de compatibilidade que usa palavras-chave para mapear
 * achados da IA para dimensões da metodologia v2.2 (similar ao classificarEixo do v2.1).
 * A pontuação é derivada da criticidade do achado.
 *
 * @param problemas - Array de problemas/achados (formato compatível com ProblemaEntrada do v2.1)
 * @returns Objeto com pontuações inferidas por dimensão e mapa de criticidade inferida por título.
 *   O mapa criticidadeInferida permite backpropagar a criticidade deduzida para os problemas originais,
 *   sincronizando ISF score com a classificação de criticidade exibida na UI.
 */
export function inferirPontuacoesDeAchados(
  problemas: { titulo?: string; criticidade?: string; descricao?: string; baseDocumental?: string; [key: string]: unknown }[]
): { pontuacoes: PontuacaoEntradaV2_2[]; criticidadeInferida: Map<string, string> } {
  // Mesma tabela de impacto do v2.1
  // Valores negativos: quanto mais negativo, MAIOR o risco (maior dedução)
  const IMPACTO_POR_CRITICIDADE: Record<string, number> = {
    critica: -50, crítica: -50, critico: -50, crítico: -50,
    alta: -30, alto: -30,
    media: -15, médio: -15, medio: -15,
    baixa: -5, baixo: -5,
  };
  // Mapa reverso: impacto → criticidade label
  const CRITICIDADE_POR_IMPACTO: Record<number, string> = {
    [-50]: 'Crítico',
    [-30]: 'Alto',
    [-15]: 'Médio',
    [-5]: 'Baixo',
  };
  function impactoParaCriticidade(impacto: number): string {
    // Ordenar impactos do mais severo para o menos severo
    const sorted = Object.keys(CRITICIDADE_POR_IMPACTO).map(Number).sort((a, b) => a - b);
    for (const threshold of sorted) {
      if (impacto <= threshold) return CRITICIDADE_POR_IMPACTO[threshold];
    }
    return 'Baixo';
  }

  // Mapeamento de palavras-chave para dimensões v2.2
  const KEYWORDS_V2_2: Record<string, string[]> = {
    D1: [
      'origem', 'título originário', 'titulo originario', 'sesmaria', 'incra',
      'reforma agrária', 'reforma agraria', 'regularização fundiária',
      'regularizacao fundiaria', 'reurb', 'terra legal', 'lei 13.465',
      'itertins', 'iterma', 'título estadual', 'titulo estadual',
      'cláusula resolutiva', 'clausula resolutiva', 'título definitivo',
      'titulo definitivo', 'título provisório', 'titulo provisorio',
      'posse de fato', 'sem título', 'sem titulo',
    ],
    D2: [
      'cadeia dominial', 'cadeia', 'transmissão', 'transmissao',
      'transmitente', 'lacuna', 'continuidade', 'sucessão', 'sucessao',
      'herança', 'heranca', 'inventário', 'inventario', 'partilha',
      'espólio', 'espolio', 'capacidade', 'legitimidade',
      'pj extinta', 'restrição legal', 'restricao legal',
      'interdição', 'interdicao',
    ],
    D3: [
      'registro', 'registral', 'matrícula', 'matricula', 'cartório', 'cartorio',
      'certidão', 'certidao', 'penhora', 'bloqueio', 'averbação', 'averbacao',
      'ônus', 'onus', 'hipoteca', 'alienação fiduciária', 'alienacao fiduciaria',
      'indisponibilidade', 'bacenjud', 'cnj', 'receita federal',
      'ação real', 'acao real', 'reipersecutória', 'reipersecutoria',
      'georreferenciamento', 'sigef', 'lei 10.267', 'certificação',
      'usucapião', 'usucapiao',
    ],
    D4: [
      'car', 'sicar', 'ambiental', 'ccir', 'itr', 'app',
      'reserva legal', 'pra', 'regularização ambiental',
      'regularizacao ambiental', 'sobreposição ambiental',
      'sobreposicao ambiental', 'dívida ativa', 'divida ativa',
      'unidade de conservação', 'unidade de conservacao', 'uc',
      'terra indígena', 'terra indigena', 'quilombola',
      'área protegida', 'area protegida', 'embargo',
    ],
    D5: [
      'litígio', 'litigio', 'processo', 'judicial', 'ação', 'acao',
      'tribunal', 'justiça', 'justica', 'demanda', 'reintegração',
      'reintegracao', 'manutenção', 'manutencao', 'interdito',
      'proibitório', 'proibitorio', 'possessória', 'possessoria',
      'embargo', 'liminar', 'tutela', 'antecipação', 'antecipacao',
      'recurso', 'apelação', 'apelacao', 'agravo', 'sentença', 'sentenca',
      'execução', 'execucao', 'correição', 'correicao', 'cgj',
      'representação', 'representacao', 'ministério público',
      'ministerio publico', 'mp',
    ],
    D6: [
      'contexto', 'geopolítico', 'geopolitico', 'conflito', 'fundiário',
      'fundiario', 'posseiro', 'posseiros', 'grilagem', 'grilo',
      'assentamento', 'pnra', 'fronteira', 'agrícola', 'agricola',
      'pressão', 'pressao', 'movimento', 'ocupação', 'ocupacao',
      'conflito regional', 'dinâmica fundiária', 'dinamica fundiaria',
    ],
  };

  // PADRÃO NEUTRO para dimensões sem achados: 40 (Alto Risco, não Atenção).
  // Sem evidência de qualidade, presume-se fragilidade — 40 é o limiar de Alto Risco (40-54).
  // Dimensões com achados partem de 75 (Regular) e são deduzidas pelo impacto integral dos problemas.
  const DEFAULT_NEUTRO = 40;

  const scores: Record<string, number> = {};
  const touched: Record<string, boolean> = {};
  // Mapa de título do problema → criticidade inferida (para backpropagation)
  const criticidadeInferida = new Map<string, string>();
  // Contagem de problemas com criticidade "crítica" detectada via keyword
  let totalCriticosKeywords = 0;
  // Rastrear quantos problemas bateram em cada dimensão (para penalização cumulativa)
  const hitsPorDimensao: Record<string, number> = {};

  for (const problema of problemas) {
    const texto = [
      problema.titulo || '',
      problema.descricao || '',
      problema.baseDocumental || '',
    ].join(' ').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ç]/g, 'c');

    const criticidade = (problema.criticidade || 'medio').toLowerCase().trim();
    // Usar o impacto original (negativo) para o mapa reverso, o valor absoluto para dedução
    const impactoOriginal = IMPACTO_POR_CRITICIDADE[criticidade] ?? -15;
    const impacto = Math.abs(impactoOriginal);

    // Inferir criticidade do problema baseado no impacto
    const labelCriticidade = impactoParaCriticidade(impactoOriginal);
    if (labelCriticidade === 'Crítico') totalCriticosKeywords++;

    // Determinar qual dimensão este problema afeta
    let melhorDim = '';
    let melhorPontuacao = 0;

    for (const [dimId, keywords] of Object.entries(KEYWORDS_V2_2)) {
      let pts = 0;
      for (const kw of keywords) {
        if (texto.includes(kw)) pts += 1;
      }
      if (pts > melhorPontuacao) {
        melhorPontuacao = pts;
        melhorDim = dimId;
      }
    }

    // Se encontrou uma dimensão, inicializa e deduzir impacto (integral, sem amortecimento)
    if (melhorDim) {
      if (scores[melhorDim] === undefined) scores[melhorDim] = 75;
      // Penalização cumulativa: cada achado adicional na mesma dimensão deduz 5 pts extras
      hitsPorDimensao[melhorDim] = (hitsPorDimensao[melhorDim] || 0) + 1;
      const multAchado = hitsPorDimensao[melhorDim] > 1 ? (hitsPorDimensao[melhorDim] - 1) * 5 : 0;
      scores[melhorDim] = Math.max(0, scores[melhorDim] - Math.round(impacto) - multAchado);
      touched[melhorDim] = true;

      // Registrar criticidade inferida para este problema
      const chaveTitulo = (problema.titulo || '').trim();
      if (chaveTitulo && labelCriticidade) {
        criticidadeInferida.set(chaveTitulo, labelCriticidade);
      }
    }
  }

  // ─── TRAVA GLOBAL POR QUANTIDADE DE CRÍTICOS ──────────────────────
  // Se ≥ 3 achados com criticidade "crítica" → teto = 39 (Crítico)
  // Se ≥ 5 achados com criticidade "crítica" → teto = 24 (Inválido)
  // Isso garante que múltiplos problemas graves rebaixem o score independentemente das dimensões.
  // (A trava será aplicada em calcularISFV2_2, mas registramos o impacto aqui via pontuações)
  if (totalCriticosKeywords >= 5) {
    // Forçar todas as dimensões para pontuação ≤ 24 (Inválido)
    for (const dim of DIMENSOES_V2_2) {
      if (!touched[dim.id]) {
        scores[dim.id] = Math.min(DEFAULT_NEUTRO, 24);
      } else if (scores[dim.id] > 24) {
        scores[dim.id] = 24;
      }
      touched[dim.id] = true;
    }
  } else if (totalCriticosKeywords >= 3) {
    // Forçar todas as dimensões para pontuação ≤ 39 (Crítico)
    for (const dim of DIMENSOES_V2_2) {
      if (!touched[dim.id]) {
        scores[dim.id] = Math.min(DEFAULT_NEUTRO, 39);
      } else if (scores[dim.id] > 39) {
        scores[dim.id] = 39;
      }
      touched[dim.id] = true;
    }
  }

  // Retorna TODAS as 6 dimensões (D1–D6).
  // Dimensões com achados → score deduzido a partir de 75 com impacto integral.
  // Dimensões sem achados → score neutro 40 (Alto Risco, sem presunção de segurança).
  const resultado: PontuacaoEntradaV2_2[] = [];
  for (const dim of DIMENSOES_V2_2) {
    resultado.push({
      dimensaoId: dim.id,
      pontuacao: touched[dim.id] ? Math.max(0, scores[dim.id]) : DEFAULT_NEUTRO,
      itemSelecionado: touched[dim.id]
        ? encontrarItemProximo(dim.id, scores[dim.id])
        : `[Inferido] ${encontrarItemProximo(dim.id, DEFAULT_NEUTRO)}`,
    });
  }

  return { pontuacoes: resultado, criticidadeInferida };
}