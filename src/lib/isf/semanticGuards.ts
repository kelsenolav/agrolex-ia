// Guardas semânticas determinísticas (sub-bloco 1.3). Puras e testáveis —
// entram na rede do Proof Engine. Postura: corrigir conservador (nunca deixar
// uma inconsistência INFLAR o laudo; desfazer rebaixamento indevido por negativa).

export type AchadoLike = {
  titulo?: string;
  descricao?: string;
  criticidade?: string;
  baseDocumental?: string;
  [key: string]: unknown;
};

export type ClassificacaoSemantica = 'problema' | 'ausencia' | 'favoravel';

// ── Guarda 1: negação / ausência ─────────────────────────────────────────────

// Problema GRAVE (presente) — veta qualquer supressão (conservador).
const PROBLEMA_GRAVE_REGEX =
  /penhora\s+(vigente|registrad|em\s+vigor|em\s+execu[çc][ãa]o)|arresto|sequestro|indisponibilidade|bloqueio\s+judicial|coisa\s+julgada|usucapi[ãa]o\s+(por\s+terceiro|de\s+terceiro|em\s+(curso|andamento)|averbad)|reivindicat[óo]ri|a[çc][ãa]o\s+real\s+reipersecut/i;

// Mão-dupla: MATRÍCULA/registro/título cancelado = grave (≠ ônus cancelado).
const MATRICULA_CANCELADA_REGEX = /(matr[íi]cula|registro|t[íi]tulo)[\s\S]{0,40}cancelad/i;

// Mão-dupla: ônus/gravame cancelado/baixado = favorável (ônus extinto).
const GRAVAME_FAVORAVEL_REGEX =
  /([ôo]nus|hipoteca|penhora|gravame|arresto|sequestro|indisponibilidade)[\s\S]{0,40}(cancelad|baixad|extint|liberad|quitad)/i;

// Litígio resolvido a favor do proprietário.
const FAVORAVEL_REGEX =
  /transitad[ao]\s+em\s+julgado\s+a\s+favor\s+d[oa]\s+propriet[áa]ri|julgad[ao]\s+improcedente|usucapi[ãa]o\s+d[oe]?\s+propriet[áa]ri|usucapi[ãa]o\s+pel[oa]\s+propriet[áa]ri|usucapi[ãa]o\s+j[áa]\s+registrad/i;

// Ausência inequívoca de problema.
// Nota: \b é ASCII-only em JS (não casa após letra acentuada). Para "não há"
// usamos lookahead de espaço/fim, não \b após "á".
const AUSENCIA_REGEX =
  /n[ãa]o\s+consta|nada\s+consta|n[ãa]o\s+h[áa](?=\s|$)|inexist[eê]ncia\s+de|inexiste|n[ãa]o\s+foi\s+identificad|sem\s+registro\s+de|sem\s+[ôo]nus|livre\s+de\s+[ôo]nus|livre\s+e\s+desembara[çc]ad|aus[êe]ncia\s+de|isent[oa]\s+de|n[ãa]o\s+averbad/i;

// Negação que GOVERNA um termo grave (precede em ~30 chars): "não há usucapião
// averbada", "sem penhora registrada". Distingue de "matrícula cancelada" (sem negação).
const NEGACAO_PROXIMA = /(n[ãa]o|sem\b|inexist|nada\s+consta|livre\s+de|aus[êe]ncia\s+de|isent)/i;

function graveNaoNegado(texto: string): boolean {
  for (const re of [PROBLEMA_GRAVE_REGEX, MATRICULA_CANCELADA_REGEX]) {
    const m = re.exec(texto);
    if (!m) continue;
    const janelaAntes = texto.slice(Math.max(0, m.index - 30), m.index);
    if (!NEGACAO_PROXIMA.test(janelaAntes)) return true; // grave e não negado
  }
  return false;
}

export function classificarAchadoSemantico(achado: AchadoLike): ClassificacaoSemantica {
  const texto = `${achado.titulo ?? ''} ${achado.descricao ?? ''} ${achado.baseDocumental ?? ''}`
    .toLowerCase()
    .trim();
  if (!texto) return 'problema';

  // 1) Problema grave/presente NÃO negado vence tudo (conservador — nunca suprimir).
  if (graveNaoNegado(texto)) return 'problema';

  // 2) Mão-dupla favorável: ônus/gravame extinto.
  if (GRAVAME_FAVORAVEL_REGEX.test(texto)) return 'favoravel';
  if (FAVORAVEL_REGEX.test(texto)) return 'favoravel';

  // 3) Ausência inequívoca.
  if (AUSENCIA_REGEX.test(texto)) return 'ausencia';

  // 4) Default conservador.
  return 'problema';
}

// ── Guarda 2: crítica determinística (fecha B2) ──────────────────────────────

const RECOMENDACAO_DISFARCADA_REGEX =
  /^\s*(recomenda-se|recomendamos|sugere-se|sugerimos|sugiro|aconselha-se|deve-se\s+(obter|verificar|solicitar|providenciar|apresentar)|necess[áa]rio\s+(obter|verificar|solicitar))/i;

function chaveNormalizada(p: AchadoLike): string {
  return `${(p.titulo ?? '').trim()}|${(p.descricao ?? '').trim()}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function critiqueAchados(problemas: AchadoLike[]): {
  validados: AchadoLike[];
  removidos: Array<{ achado: AchadoLike; motivo: string }>;
} {
  const validados: AchadoLike[] = [];
  const removidos: Array<{ achado: AchadoLike; motivo: string }> = [];
  const seen = new Set<string>();

  for (const p of problemas) {
    const titulo = (p.titulo ?? '').trim();
    // Recomendação-disfarçada-de-achado (título começa com verbo de recomendação).
    if (RECOMENDACAO_DISFARCADA_REGEX.test(titulo)) {
      removidos.push({ achado: p, motivo: 'recomendacao_disfarcada' });
      continue;
    }
    // Duplicado exato (título+descrição normalizados).
    const key = chaveNormalizada(p);
    if (key !== '|' && seen.has(key)) {
      removidos.push({ achado: p, motivo: 'duplicado' });
      continue;
    }
    seen.add(key);
    validados.push(p);
  }

  return { validados, removidos };
}

// ── Guarda 3: contradições + reconciliação (fecha B5 #1 e #2) ─────────────────

export interface Contradicao {
  tipo: 'risk_level_vs_isf' | 'doc_faltante_vs_presente';
  descricao: string;
}

const DOC_KEYWORDS = ['car', 'ccir', 'itr', 'sigef', 'georreferenciamento', 'matr[íi]cula', 'certid[ãa]o'];

export function detectContradicoes(args: {
  riskLevel: string;
  faixaRiskLevel: string; // faixaParaRiskLevel(isfScore), calculado pelo chamador
  isfScore: number;
  documentosFaltantes: string[];
  problemas: AchadoLike[];
}): Contradicao[] {
  const out: Contradicao[] = [];

  // (a) risk_level (IA) × faixa do ISF (determinística).
  if (args.riskLevel && args.faixaRiskLevel && args.riskLevel !== args.faixaRiskLevel) {
    out.push({
      tipo: 'risk_level_vs_isf',
      descricao: `risk_level da IA ("${args.riskLevel}") diverge da faixa do ISF ("${args.faixaRiskLevel}") — reconciliado para a faixa do ISF.`,
    });
  }

  // (b) doc-faltante × achado que cita o mesmo doc como presente/ativo.
  const achadosTexto = args.problemas
    .map((p) => `${p.titulo ?? ''} ${p.descricao ?? ''}`.toLowerCase())
    .join(' | ');
  for (const doc of args.documentosFaltantes) {
    const docLower = String(doc).toLowerCase();
    const kw = DOC_KEYWORDS.find((k) => new RegExp(k, 'i').test(docLower));
    if (!kw) continue;
    const presenteRegex = new RegExp(`${kw}\\s*(ativ|presente|regular|atualizad|v[áa]lid|consta\\b)`, 'i');
    if (presenteRegex.test(achadosTexto)) {
      out.push({
        tipo: 'doc_faltante_vs_presente',
        descricao: `"${doc}" consta em documentos faltantes, mas um achado o cita como presente/ativo — mantido como faltante (conservador); revisar manualmente.`,
      });
    }
  }

  return out;
}
