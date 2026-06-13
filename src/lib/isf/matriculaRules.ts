/**
 * matriculaRules.ts
 * Engine de checks automáticos para o módulo matricula_individual.
 * Roda APÓS a resposta da IA, sem chamadas externas.
 */

export interface MatriculaFicha {
  numero_matricula: string;
  cartorio: string;
  comarca: string;
  uf: string;
  area_numerica: string;       // ex: "122,54 ha"
  area_extenso: string;        // ex: "cento e vinte e dois hectares..."
  area_divergente: boolean;
  proprietario_atual: string;
  cpf_cnpj_proprietario: string;
  conjuge: string;
  regime_bens: string;
  datum_geodesico: string;     // ex: "SAD-69" ou "SIRGAS 2000"
  ccir: string;
  ccir_exercicio: string;      // ex: "2003/2004/2005"
  data_certidao: string;       // ex: "14/04/2021"
  titulo_originario_apresentado: boolean;
  total_atos: number;
}

export interface AtoRegistral {
  ato: string;           // ex: "R-1-27180"
  tipo: string;          // ex: "Compra e Venda"
  instrumento?: string;  // ex: "Escritura de Permuta" — pode divergir do tipo
  data: string;
  partes?: string;
  risco: 'baixo' | 'medio' | 'alto' | 'critico';
  alerta?: string;       // inconsistência detectada
}

export interface SemaforoOperacao {
  operacao: string;
  status: 'livre' | 'condicionado' | 'inviavel' | 'bloqueado';
  motivo: string;
}

export interface ScorecardDocumento {
  documento: string;
  apresentado: boolean;
  critico: boolean;
  motivo_ausencia?: string;
}

export interface ProximoPasso {
  ordem: number;
  acao: string;
  foro_orgao?: string;
  numero_processo?: string;
  prazo_recomendado?: string;
  prioridade: 'alta' | 'media' | 'baixa';
}

export interface AnaliseConfianca {
  nivel: 'baixa' | 'media' | 'alta';
  documentos_apresentados: number;
  documentos_recomendados: number;
  percentual: number;
  descricao: string;
}

export interface MatriculaRulesResult {
  ficha: Partial<MatriculaFicha>;
  atos_registrais: AtoRegistral[];
  alertas_regra: Array<{ titulo: string; criticidade: string; descricao: string; eixo: string }>;
  semaforo_operacoes: SemaforoOperacao[];
  scorecard_documentos: ScorecardDocumento[];
  proximos_passos: ProximoPasso[];
  confianca: AnaliseConfianca;
}

// ── Helpers de extração de texto ──────────────────────────────────────────────

function extractMatch(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  return m ? (m[1] || m[0]).trim() : '';
}

function textLower(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function parseDateBR(dateStr: string): Date | null {
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Extração da ficha estruturada ─────────────────────────────────────────────

function extrairFicha(resumoTexto: string): Partial<MatriculaFicha> {
  const t = resumoTexto;

  const numero_matricula =
    extractMatch(t, /matr[íi]cula\s+n[°º.]?\s*([0-9.,/-]+)/i) ||
    extractMatch(t, /n[°º.]\s*([0-9.,/-]+)/i);

  const cartorio =
    extractMatch(t, /cart[óo]rio\s+de\s+registro\s+de\s+im[oó]veis[^,\n]*/i) ||
    extractMatch(t, /(?:1[oa]|2[oa]|primeiro|segundo)\s+oficio[^,\n]*/i);

  const comarca = extractMatch(t, /comarca\s+de\s+([^,\n.]+)/i);

  const uf = extractMatch(t, /\b([A-Z]{2})\b(?=[\s,.-])/);

  const area_numerica =
    extractMatch(t, /[áa]rea\s+(?:total\s+)?de\s*([\d.,]+\s*(?:ha|hectares?|m[²2]))/i) ||
    extractMatch(t, /([\d.,]+\s*(?:ha|hectares?))/i);

  const area_extenso = extractMatch(t, /(?:por extenso|em extenso)[:\s]*([^.;\n]{10,80})/i);

  const area_divergente =
    /diverge?[nê]?ncia\s+(?:de\s+)?[áa]rea|[áa]rea[^.]*(?:diverge?|difere?|inconsistente)/i.test(t) ||
    /n[ãu]o\s+coincide/i.test(t);

  const proprietario_atual =
    extractMatch(t, /propriet[áa]rio\s+atual[:\s]*([^\n,;]{3,60})/i) ||
    extractMatch(t, /em\s+nome\s+de\s+([^\n,;]{3,60})/i);

  const cpf_cnpj_proprietario =
    extractMatch(t, /CPF[:\s]*([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}[-.]?[0-9]{2})/i) ||
    extractMatch(t, /CNPJ[:\s]*([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/[0-9]{4}[-.]?[0-9]{2})/i);

  const conjuge =
    extractMatch(t, /c[ôo]njuge[:\s]*([^\n,;]{3,60})/i) ||
    extractMatch(t, /casad[oa]\s+com\s+([^\n,;]{3,60})/i);

  const regime_bens =
    extractMatch(t, /regime\s+de\s+bens[:\s]*([^\n,;.]{3,60})/i) ||
    extractMatch(t, /comunh[ãa]o\s+(?:parcial|universal|total)\s+de\s+bens/i);

  const datum_geodesico = /SIRGAS\s*2000/i.test(t)
    ? 'SIRGAS 2000'
    : /SAD[\s-]?69/i.test(t)
    ? 'SAD-69'
    : /SAD[\s-]?56/i.test(t)
    ? 'SAD-56'
    : '';

  const ccir =
    extractMatch(t, /CCIR[:\s#]*([0-9]{2}\.?[0-9]{3}\.?[0-9]{5}[-.]?[0-9]{1,2})/i) ||
    extractMatch(t, /CCIR[:\s]*([0-9]+)/i);

  const ccir_exercicio =
    extractMatch(t, /exerc[íi]cio[:\s]*([0-9]{4}(?:\/[0-9]{4})*)/i) ||
    extractMatch(t, /CCIR[^.]*([0-9]{4}\/[0-9]{4})/i);

  const data_certidao =
    extractMatch(t, /emitid[ao]\s+em\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
    extractMatch(t, /data\s+da?\s+certid[ãa]o[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
    extractMatch(t, /([0-9]{2}\/[0-9]{2}\/[0-9]{4})/);

  const titulo_originario_apresentado =
    !/t[íi]tulo\s+origin[áa]rio\s+n[ãa]o\s+apresentad/i.test(t) &&
    (/t[íi]tulo\s+origin[áa]rio/i.test(t) || /matricula[\s-]m[ãa]e/i.test(t));

  const atoMatches = t.match(/\b(?:R|AV)-\d+/gi) || [];
  const total_atos = atoMatches.length;

  return {
    numero_matricula,
    cartorio,
    comarca,
    uf,
    area_numerica,
    area_extenso,
    area_divergente,
    proprietario_atual,
    cpf_cnpj_proprietario,
    conjuge,
    regime_bens,
    datum_geodesico,
    ccir,
    ccir_exercicio,
    data_certidao,
    titulo_originario_apresentado,
    total_atos,
  };
}

// ── Detecção de checks de regra ───────────────────────────────────────────────

interface CheckFlags {
  area_divergente: boolean;
  datum_desatualizado: boolean;
  certidao_vencida: boolean;
  ccir_desatualizado: boolean;
  ato_instrumento_inconsistente: boolean;
  usucapiao_ativa: boolean;
  titulo_originario_ausente: boolean;
}

function detectarChecks(
  resumoTexto: string,
  problemas: Array<Record<string, unknown>>,
  ficha: Partial<MatriculaFicha>,
): CheckFlags {
  const t = resumoTexto;
  const tl = textLower(t);

  const area_divergente =
    ficha.area_divergente === true ||
    /area[^.]*diverge/i.test(tl) ||
    /divergencia[^.]*area/i.test(tl);

  const datum_desatualizado =
    ficha.datum_geodesico === 'SAD-69' ||
    ficha.datum_geodesico === 'SAD-56' ||
    /SAD[\s-]?69/i.test(t);

  let certidao_vencida = false;
  if (ficha.data_certidao) {
    const d = parseDateBR(ficha.data_certidao);
    if (d) certidao_vencida = daysSince(d) > 365;
  }

  let ccir_desatualizado = false;
  if (ficha.ccir_exercicio) {
    const anos = (ficha.ccir_exercicio.match(/\d{4}/g) || []).map(Number);
    const anoAtual = new Date().getFullYear();
    if (anos.length > 0 && Math.max(...anos) < anoAtual - 5) {
      ccir_desatualizado = true;
    }
  } else if (/ccir[^.]*desatualizado|ccir[^.]*vencido/i.test(tl)) {
    ccir_desatualizado = true;
  }

  const ato_instrumento_inconsistente =
    (/permuta/i.test(t) && /compra\s+e\s+venda/i.test(t)) ||
    (/doac[ãa]o/i.test(t) && /compra\s+e\s+venda/i.test(t));

  const usucapiao_ativa =
    /usucapi[ãa]o/i.test(t) ||
    problemas.some((p) =>
      /usucapi[ãa]o/i.test(String(p['titulo'] || '') + String(p['descricao'] || '')),
    );

  const titulo_originario_ausente =
    /t[íi]tulo\s+origin[áa]rio\s+n[ãa]o\s+apresentad/i.test(t) ||
    /exist[êe]ncia\s+de\s+cl[áa]usulas\s+resolutivas\s+n[ãa]o\s+verific[áa]vel/i.test(t);

  return {
    area_divergente,
    datum_desatualizado,
    certidao_vencida,
    ccir_desatualizado,
    ato_instrumento_inconsistente,
    usucapiao_ativa,
    titulo_originario_ausente,
  };
}

// ── Geração de alertas ────────────────────────────────────────────────────────

function gerarAlertas(flags: CheckFlags): MatriculaRulesResult['alertas_regra'] {
  const alertas: MatriculaRulesResult['alertas_regra'] = [];

  if (flags.area_divergente) {
    alertas.push({
      titulo: 'Divergência de Área Registrada',
      criticidade: 'Alto',
      descricao:
        'Há divergência entre a área numérica e a área por extenso, ou a área declarada difere do perímetro. Requer georreferenciamento ou retificação de área.',
      eixo: 'REG',
    });
  }

  if (flags.datum_desatualizado) {
    alertas.push({
      titulo: 'Datum Geodésico Obsoleto (SAD-69)',
      criticidade: 'Médio',
      descricao:
        'O memorial ou documentação indica datum SAD-69, obsoleto desde a adoção do SIRGAS 2000. Requer atualização do georreferenciamento para operações de transmissão ou financiamento.',
      eixo: 'REG',
    });
  }

  if (flags.certidao_vencida) {
    alertas.push({
      titulo: 'Certidão de Inteiro Teor Vencida (> 1 ano)',
      criticidade: 'Médio',
      descricao:
        'A certidão apresentada foi emitida há mais de 365 dias. Para fins de due diligence, compra, venda ou financiamento, recomenda-se certidão atualizada.',
      eixo: 'REG',
    });
  }

  if (flags.ccir_desatualizado) {
    alertas.push({
      titulo: 'CCIR com Exercício Desatualizado',
      criticidade: 'Médio',
      descricao:
        'O CCIR apresentado está desatualizado há mais de 5 anos. A ausência de CCIR atualizado pode impedir a lavratura de escrituras e o registro de transmissão.',
      eixo: 'REG',
    });
  }

  if (flags.ato_instrumento_inconsistente) {
    alertas.push({
      titulo: 'Inconsistência entre Tipo de Ato e Instrumento',
      criticidade: 'Alto',
      descricao:
        'O tipo do ato registral (ex: Compra e Venda) diverge da natureza do instrumento descrito (ex: Escritura de Permuta ou Doação). Isso constitui vício registral que pode gerar questionamento da validade do ato.',
      eixo: 'DOM',
    });
  }

  if (flags.usucapiao_ativa) {
    alertas.push({
      titulo: 'Ação de Usucapião Identificada',
      criticidade: 'Crítico',
      descricao:
        'Há menção a ação de usucapião ativa ou averbada. Este gravame bloqueia a transmissão e a oferta do imóvel em garantia real até a resolução judicial ou administrativa.',
      eixo: 'LIT',
    });
  }

  if (flags.titulo_originario_ausente) {
    alertas.push({
      titulo: 'Título Originário Não Apresentado',
      criticidade: 'Alto',
      descricao:
        'O título originário não foi apresentado. Não é possível verificar cláusulas resolutivas, inalienabilidade ou condicionantes de origem pública. Recomenda-se solicitar o título ao cartório ou órgão emissor.',
      eixo: 'DOM',
    });
  }

  return alertas;
}

// ── Semáforo de operações ─────────────────────────────────────────────────────

function gerarSemaforo(flags: CheckFlags): SemaforoOperacao[] {
  const semaforo: SemaforoOperacao[] = [];

  if (flags.usucapiao_ativa) {
    semaforo.push({
      operacao: 'Compra e Venda',
      status: 'bloqueado',
      motivo: 'Ação de usucapião ativa impede a transmissão voluntária do imóvel.',
    });
  } else if (flags.area_divergente || flags.datum_desatualizado || flags.titulo_originario_ausente) {
    semaforo.push({
      operacao: 'Compra e Venda',
      status: 'condicionado',
      motivo:
        [
          flags.area_divergente ? 'área divergente' : '',
          flags.datum_desatualizado ? 'datum obsoleto' : '',
          flags.titulo_originario_ausente ? 'título originário ausente' : '',
        ]
          .filter(Boolean)
          .join('; ') + '. Regularização prévia recomendada.',
    });
  } else {
    semaforo.push({
      operacao: 'Compra e Venda',
      status: 'livre',
      motivo: 'Sem impedimentos registrais identificados nos documentos analisados.',
    });
  }

  if (flags.usucapiao_ativa) {
    semaforo.push({
      operacao: 'Financiamento / Garantia Real',
      status: 'inviavel',
      motivo: 'Ação de usucapião ativa inviabiliza a constituição de garantia real (hipoteca ou alienação fiduciária).',
    });
  } else if (flags.area_divergente || flags.datum_desatualizado) {
    semaforo.push({
      operacao: 'Financiamento / Garantia Real',
      status: 'condicionado',
      motivo: 'Regularização de área e/ou atualização do datum geodésico exigida pelas instituições financeiras.',
    });
  } else {
    semaforo.push({
      operacao: 'Financiamento / Garantia Real',
      status: 'livre',
      motivo: 'Sem restrições identificadas.',
    });
  }

  if (flags.datum_desatualizado) {
    semaforo.push({
      operacao: 'Georreferenciamento SIGEF',
      status: 'condicionado',
      motivo: 'Datum SAD-69 requer conversão para SIRGAS 2000 antes da certificação pelo INCRA.',
    });
  } else {
    semaforo.push({
      operacao: 'Georreferenciamento SIGEF',
      status: 'livre',
      motivo: 'Sem impedimentos técnicos identificados.',
    });
  }

  if (flags.area_divergente) {
    semaforo.push({
      operacao: 'Desmembramento / Divisão',
      status: 'condicionado',
      motivo: 'A divergência de área deve ser resolvida antes de qualquer desmembramento ou divisão amigável.',
    });
  } else {
    semaforo.push({
      operacao: 'Desmembramento / Divisão',
      status: 'livre',
      motivo: 'Sem impedimentos identificados nos documentos analisados.',
    });
  }

  if (flags.area_divergente) {
    semaforo.push({
      operacao: 'Regularização Ambiental (CAR/SIGEF)',
      status: 'condicionado',
      motivo: 'Área incerta dificulta a delimitação correta de APP, Reserva Legal e poligonal do CAR.',
    });
  } else {
    semaforo.push({
      operacao: 'Regularização Ambiental (CAR/SIGEF)',
      status: 'livre',
      motivo: 'Sem impedimentos identificados.',
    });
  }

  return semaforo;
}

// ── Scorecard de documentos ───────────────────────────────────────────────────

function gerarScorecard(
  flags: CheckFlags,
  resumoTexto: string,
  documentosFaltantes: Array<Record<string, unknown>>,
): ScorecardDocumento[] {
  const t = textLower(resumoTexto);
  const faltantesTexto = documentosFaltantes
    .map((d) => textLower(String(d['documento'] || d)))
    .join(' ');

  function ausente(termos: string[]): boolean {
    return termos.some((term) => faltantesTexto.includes(textLower(term)));
  }

  return [
    {
      documento: 'Certidão de Inteiro Teor',
      apresentado: t.includes('certidao de inteiro teor') || t.includes('matricula') || t.includes('certidao'),
      critico: true,
      motivo_ausencia: 'Certidão é o documento base da análise.',
    },
    {
      documento: 'CCIR — Exercício Atual',
      apresentado: !flags.ccir_desatualizado && (t.includes('ccir') || t.includes('cadastro de imoveis rurais')),
      critico: true,
      motivo_ausencia: 'Exigido para lavratura de escrituras e registro de transmissão.',
    },
    {
      documento: 'CAR — Cadastro Ambiental Rural',
      apresentado: t.includes('car') && !ausente(['CAR', 'Cadastro Ambiental']),
      critico: false,
      motivo_ausencia: 'Necessário para regularização ambiental e transações rurais.',
    },
    {
      documento: 'ITR — Últimos 5 Anos',
      apresentado: t.includes('itr') && !ausente(['ITR', 'Imposto Territorial']),
      critico: false,
      motivo_ausencia: 'Imposto Territorial Rural pode indicar inadimplência fiscal.',
    },
    {
      documento: 'Certidão Judicial (usucapião)',
      apresentado: !flags.usucapiao_ativa,
      critico: flags.usucapiao_ativa,
      motivo_ausencia: flags.usucapiao_ativa
        ? 'Ação de usucapião identificada — certidão do processo é indispensável.'
        : undefined,
    },
    {
      documento: 'Memorial Descritivo Atualizado (SIRGAS 2000)',
      apresentado: !flags.datum_desatualizado && (t.includes('memorial descritivo') || t.includes('sirgas')),
      critico: flags.datum_desatualizado,
      motivo_ausencia: flags.datum_desatualizado
        ? 'Datum obsoleto (SAD-69) requer novo memorial em SIRGAS 2000.'
        : undefined,
    },
    {
      documento: 'Escritura Originária / Título de Origem',
      apresentado: !flags.titulo_originario_ausente,
      critico: true,
      motivo_ausencia: 'Ausência impede verificação de cláusulas resolutivas e cadeia dominial completa.',
    },
    {
      documento: 'Certidões Pessoais dos Proprietários',
      apresentado: t.includes('certidao pessoal') || t.includes('certidoes negativas'),
      critico: false,
      motivo_ausencia: 'Certidões negativas de débitos são recomendadas em toda transação imobiliária.',
    },
  ];
}

// ── Próximos passos ───────────────────────────────────────────────────────────

function gerarProximosPassos(flags: CheckFlags, ficha: Partial<MatriculaFicha>): ProximoPasso[] {
  const passos: ProximoPasso[] = [];
  let ordem = 1;

  if (flags.usucapiao_ativa) {
    passos.push({
      ordem: ordem++,
      acao: 'Obter certidão atualizada do processo de usucapião e verificar o estágio processual.',
      foro_orgao: ficha.comarca ? `Vara Cível de ${ficha.comarca}` : 'Vara Cível competente',
      prazo_recomendado: 'Imediato',
      prioridade: 'alta',
    });
    passos.push({
      ordem: ordem++,
      acao: 'Aguardar sentença com trânsito em julgado ou acordo antes de qualquer negociação ou oferta em garantia.',
      prazo_recomendado: 'Imediato',
      prioridade: 'alta',
    });
  }

  if (flags.titulo_originario_ausente) {
    passos.push({
      ordem: ordem++,
      acao: 'Solicitar o título originário ao cartório de registro ou ao órgão fundiário emissor (INCRA, etc.).',
      foro_orgao: ficha.cartorio || 'Cartório de Registro de Imóveis',
      prazo_recomendado: 'Até 30 dias',
      prioridade: 'alta',
    });
  }

  if (flags.area_divergente) {
    passos.push({
      ordem: ordem++,
      acao: 'Contratar levantamento topográfico para apuração da área real e retificação registral, se cabível.',
      prazo_recomendado: '30 a 60 dias',
      prioridade: 'alta',
    });
  }

  if (flags.datum_desatualizado) {
    passos.push({
      ordem: ordem++,
      acao: 'Atualizar o memorial descritivo para SIRGAS 2000 e proceder à certificação junto ao INCRA.',
      foro_orgao: 'INCRA / Cartório de Registro',
      prazo_recomendado: '60 dias',
      prioridade: 'media',
    });
  }

  if (flags.ato_instrumento_inconsistente) {
    passos.push({
      ordem: ordem++,
      acao: 'Requerer análise jurídica sobre a inconsistência entre o tipo do ato registral e o instrumento lavrado, avaliando a necessidade de retificação ou ratificação.',
      prazo_recomendado: '30 dias',
      prioridade: 'alta',
    });
  }

  if (flags.certidao_vencida) {
    passos.push({
      ordem: ordem++,
      acao: 'Solicitar nova certidão de inteiro teor da matrícula junto ao cartório de registro de imóveis.',
      foro_orgao: ficha.cartorio || 'Cartório de Registro de Imóveis',
      prazo_recomendado: 'Imediato',
      prioridade: 'media',
    });
  }

  if (flags.ccir_desatualizado) {
    passos.push({
      ordem: ordem++,
      acao: 'Regularizar o CCIR junto ao INCRA para o exercício do ano corrente.',
      foro_orgao: 'INCRA',
      prazo_recomendado: '30 dias',
      prioridade: 'media',
    });
  }

  if (passos.length === 0) {
    passos.push({
      ordem: 1,
      acao: 'Manter documentação atualizada e solicitar nova certidão de inteiro teor em caso de operação imobiliária.',
      prazo_recomendado: 'A critério do proprietário',
      prioridade: 'baixa',
    });
  }

  return passos;
}

// ── Confiança ─────────────────────────────────────────────────────────────────

function calcularConfianca(scorecard: ScorecardDocumento[]): AnaliseConfianca {
  const total = scorecard.length;
  const apresentados = scorecard.filter((s) => s.apresentado).length;
  const percentual = Math.round((apresentados / total) * 100);
  const nivel: AnaliseConfianca['nivel'] =
    percentual >= 75 ? 'alta' : percentual >= 50 ? 'media' : 'baixa';

  const descricao =
    `${apresentados} de ${total} documentos recomendados foram identificados ou considerados apresentados. ` +
    (nivel === 'alta'
      ? 'Análise com confiança alta — base documental sólida.'
      : nivel === 'media'
      ? 'Análise com confiança média — alguns documentos importantes ausentes.'
      : 'Análise com confiança baixa — base documental insuficiente. Solicite os documentos faltantes antes de concluir negociações.');

  return { nivel, documentos_apresentados: apresentados, documentos_recomendados: total, percentual, descricao };
}

// ── Função principal ──────────────────────────────────────────────────────────

export function runMatriculaRules(
  resumoTexto: string,
  problemas: Array<Record<string, unknown>>,
  documentosFaltantes: Array<Record<string, unknown>>,
): MatriculaRulesResult {
  const ficha = extrairFicha(resumoTexto);
  const flags = detectarChecks(resumoTexto, problemas, ficha);
  const alertas_regra = gerarAlertas(flags);
  const semaforo_operacoes = gerarSemaforo(flags);
  const scorecard_documentos = gerarScorecard(flags, resumoTexto, documentosFaltantes);
  const proximos_passos = gerarProximosPassos(flags, ficha);
  const confianca = calcularConfianca(scorecard_documentos);

  return {
    ficha,
    atos_registrais: [],
    alertas_regra,
    semaforo_operacoes,
    scorecard_documentos,
    proximos_passos,
    confianca,
  };
}
