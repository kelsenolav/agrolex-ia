// ─── Types ───────────────────────────────────────────────────────────────────

export interface PropertyParams {
  name?: string;
  city?: string;
  state?: string;
  car_code?: string;
  ccir?: string;
  cpf_cnpj?: string;
  matricula_number?: string;
  registry_office?: string;
  sigef_code?: string;
}

export interface AnalysisFindings {
  resumo?: string;
  achados?: Array<{
    titulo?: string;
    criticidade?: string;
    eixo?: string;
    descricao?: string;
    [key: string]: unknown;
  }>;
  certidao_inteiro_teor_data?: string;
  certidao_negativa_onus_data?: string;
  certidao_acoes_reipersecutorias_data?: string;
  onus_detectados?: string[];
  acoes_reipersecutorias_encontradas?: number;
  ccir_exercicio?: string;
  area_registrada_ha?: number;
  area_sigef_ha?: number;
  numeros_processo?: string[];
  [key: string]: unknown;
}

export interface SIGEFResult {
  found: boolean;
  parcela_id?: string;
  area_ha?: number;
  status_certificacao?: string;
  data_certificacao?: string;
  municipio?: string;
  uf?: string;
  geojson_url?: string;
  sobreposicao_detectada?: boolean;
  erro?: string;
}

export interface CARResult {
  found: boolean;
  car_code?: string;
  status?: 'ativo' | 'pendente' | 'cancelado' | 'suspenso';
  area_total_ha?: number;
  area_reserva_legal_ha?: number;
  area_app_ha?: number;
  data_inscricao?: string;
  situacao_cadastral?: string;
  erro?: string;
}

export interface CNIRResult {
  found: boolean;
  ccir_exercicio?: string;
  situacao_ccir?: 'regular' | 'irregular' | 'nao_localizado';
  itr_situacao?: string;
  area_registrada_ha?: number;
  divergencia_area?: boolean;
  divergencia_percentual?: number;
  erro?: string;
}

export interface ProcessoTribunal {
  numero: string;
  tribunal: string;
  classe: string;
  assuntos: string[];
  partes_envolvidas: string[];
  data_ajuizamento: string;
  ultimo_movimento: string;
  risco_para_propriedade: 'alto' | 'medio' | 'baixo' | 'indeterminado';
}

export interface TribunaisResult {
  consultas_realizadas: string[];
  processos_encontrados: number;
  processos: ProcessoTribunal[];
  alerta_litigio: boolean;
  erro?: string;
}

export interface CertidoesResult {
  certidao_inteiro_teor: {
    valida: boolean;
    data_emissao?: string;
    dias_ate_vencimento?: number;
  };
  certidao_negativa_onus: {
    valida: boolean;
    onus_detectados: string[];
  };
  certidao_acoes_reipersecutorias: {
    valida: boolean;
    acoes_encontradas: number;
  };
}

export interface DesmatamentoAlertaDetectado {
  data: string;
  classe: string;
  municipio: string;
  uf: string;
  area_ha: number;
  fonte: 'DETER-AMZ' | 'DETER-Cerrado';
}

export interface DesmatamentoResult {
  // true quando ao menos uma consulta ao TerraBrasilis/DETER foi executada com
  // sucesso (mesmo que sem alertas) — distingue "verificado e limpo" de "não verificado"
  verificado: boolean;
  alertas: DesmatamentoAlertaDetectado[];
  periodo_meses: number;
  erro?: string;
}

export interface ExternalCheckAlert {
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface ExternalCheckResult {
  timestamp: string;
  sources_consulted: string[];
  sources_success: string[];
  sources_failed: string[];
  sigef: SIGEFResult | null;
  car: CARResult | null;
  cnir: CNIRResult | null;
  tribunais: TribunaisResult | null;
  certidoes: CertidoesResult | null;
  new_alerts: ExternalCheckAlert[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: ${label} excedeu ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

function diffDays(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return -1;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── SIGEF ───────────────────────────────────────────────────────────────────

export async function consultarSIGEF(params: PropertyParams): Promise<SIGEFResult> {
  if (!params.sigef_code) {
    return { found: false, erro: 'Código SIGEF não informado na propriedade' };
  }

  try {
    const url = `https://sigef.incra.gov.br/geo/parcela/detalhe/${encodeURIComponent(params.sigef_code)}/`;
    const res = await withTimeout(
      fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'AgrolexI-Radar/1.0' },
      }),
      15000,
      'SIGEF'
    );

    if (!res.ok) {
      if (res.status === 404) {
        return { found: false, erro: `Parcela SIGEF ${params.sigef_code} não encontrada (404)` };
      }
      return { found: false, erro: `SIGEF retornou HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const html = await res.text();
      const areaMatch = html.match(/[Áá]rea[:\s]*<[^>]*>?\s*([\d.,]+)\s*ha/i);
      const statusMatch = html.match(/[Ss]itua[çc][ãa]o[:\s]*<[^>]*>?\s*([^<\n]+)/i);
      const certMatch = html.match(/[Cc]ertifica[çc][ãa]o[:\s]*<[^>]*>?\s*(\d{2}\/\d{2}\/\d{4})/i);
      const sobreposicaoMatch = /sobreposi[çc][ãa]o/i.test(html);
      return {
        found: true,
        parcela_id: params.sigef_code,
        area_ha: areaMatch ? parseFloat(areaMatch[1].replace('.', '').replace(',', '.')) : undefined,
        status_certificacao: statusMatch ? statusMatch[1].trim() : undefined,
        data_certificacao: certMatch ? certMatch[1] : undefined,
        municipio: params.city,
        uf: params.state,
        geojson_url: `https://sigef.incra.gov.br/geo/parcela/geojson/${encodeURIComponent(params.sigef_code)}/`,
        sobreposicao_detectada: sobreposicaoMatch,
      };
    }

    const data = await res.json();
    return {
      found: true,
      parcela_id: data.parcela_codigo || data.id || params.sigef_code,
      area_ha: data.area_ha ?? data.area,
      status_certificacao: data.status ?? data.situacao,
      data_certificacao: data.data_certificacao ?? data.data_aprovacao,
      municipio: data.municipio ?? params.city,
      uf: data.uf ?? params.state,
      geojson_url: `https://sigef.incra.gov.br/geo/parcela/geojson/${encodeURIComponent(params.sigef_code)}/`,
      sobreposicao_detectada: data.sobreposicao === true || data.tem_sobreposicao === true,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { found: false, erro: `Falha ao consultar SIGEF: ${msg}` };
  }
}

// ─── CAR / SICAR ─────────────────────────────────────────────────────────────

export async function consultarCAR(params: PropertyParams): Promise<CARResult> {
  if (!params.car_code) {
    return { found: false, erro: 'Código CAR não informado na propriedade' };
  }

  try {
    const url = `https://www.car.gov.br/publico/imoveis/index`;
    const res = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'AgrolexI-Radar/1.0',
        },
        body: `codigoImovel=${encodeURIComponent(params.car_code)}`,
      }),
      15000,
      'SICAR'
    );

    if (!res.ok) {
      return { found: false, car_code: params.car_code, erro: `SICAR retornou HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        found: false,
        car_code: params.car_code,
        erro: 'SICAR retornou resposta não-JSON — consulta pública pode estar indisponível',
      };
    }

    const data = await res.json();

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return { found: false, car_code: params.car_code, erro: 'Nenhum imóvel encontrado com este código CAR' };
    }

    const imovel = Array.isArray(data) ? data[0] : data;
    const statusMap: Record<string, CARResult['status']> = {
      AT: 'ativo',
      PE: 'pendente',
      CA: 'cancelado',
      SU: 'suspenso',
    };

    return {
      found: true,
      car_code: params.car_code,
      status: statusMap[imovel.situacao] ?? (imovel.situacao as CARResult['status']),
      area_total_ha: imovel.areaImovel ?? imovel.area_total,
      area_reserva_legal_ha: imovel.areaReservaLegal ?? imovel.area_reserva_legal,
      area_app_ha: imovel.areaApp ?? imovel.area_app,
      data_inscricao: imovel.dataInscricao ?? imovel.data_inscricao,
      situacao_cadastral: imovel.descSituacao ?? imovel.situacao_cadastral,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { found: false, car_code: params.car_code, erro: `Falha ao consultar SICAR: ${msg}` };
  }
}

// ─── TerraBrasilis / DETER (INPE) ────────────────────────────────────────────
// Serviço público WFS (OGC), sem autenticação. Endpoints e schema verificados
// ao vivo em 01/07/2026: https://terrabrasilis.dpi.inpe.br/geoserver/ows
// DETER cobre apenas Amazônia Legal e Cerrado (near-real-time); outros biomas
// só têm PRODES anual (não integrado aqui — ver AGENTS.md).

const DETER_WORKSPACES: Array<{ workspace: string; layer: string; fonte: DesmatamentoAlertaDetectado['fonte'] }> = [
  { workspace: 'deter-amz', layer: 'deter-amz:deter_amz', fonte: 'DETER-AMZ' },
  { workspace: 'deter-cerrado-nb', layer: 'deter-cerrado-nb:deter_cerrado', fonte: 'DETER-Cerrado' },
];

function escapeCql(value: string): string {
  return value.replace(/'/g, "''");
}

export async function consultarDesmatamentoTerraBrasilis(
  params: PropertyParams,
  mesesRetroativos = 24
): Promise<DesmatamentoResult> {
  const result: DesmatamentoResult = { verificado: false, alertas: [], periodo_meses: mesesRetroativos };

  if (!params.city || !params.state) {
    result.erro = 'Município/UF não informados na propriedade — consulta ao TerraBrasilis/DETER não é possível';
    return result;
  }

  const uf = params.state.toUpperCase();
  const cidade = escapeCql(params.city.trim());
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - mesesRetroativos);
  const dataCorteStr = dataCorte.toISOString().slice(0, 10);

  let algumaConsultaOk = false;
  const erros: string[] = [];

  await Promise.all(DETER_WORKSPACES.map(async ({ workspace, layer, fonte }) => {
    const cql = `uf='${uf}' AND municipality ILIKE '%${cidade}%' AND view_date >= '${dataCorteStr}'`;
    const url = `https://terrabrasilis.dpi.inpe.br/geoserver/${workspace}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${encodeURIComponent(layer)}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cql)}&sortBy=view_date+D&count=50`;

    try {
      const res = await withTimeout(
        fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'AgrolexI-CreditoRural/1.0' } }),
        15000,
        `TerraBrasilis ${fonte}`
      );
      if (!res.ok) { erros.push(`${fonte}: HTTP ${res.status}`); return; }

      const data = await res.json();
      algumaConsultaOk = true;
      const features: Array<Record<string, unknown>> = Array.isArray(data?.features) ? data.features : [];
      for (const f of features) {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const areaKm2 = typeof p.areamunkm === 'number' ? p.areamunkm : 0;
        result.alertas.push({
          data: (p.view_date as string) ?? '',
          classe: (p.classname as string) ?? 'desmatamento',
          municipio: (p.municipality as string) ?? params.city!,
          uf: (p.uf as string) ?? uf,
          area_ha: Math.round(areaKm2 * 100 * 100) / 100, // km² → ha
          fonte,
        });
      }
    } catch (err: unknown) {
      erros.push(`${fonte}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }));

  result.verificado = algumaConsultaOk;
  result.alertas.sort((a, b) => (a.data < b.data ? 1 : -1));
  if (!algumaConsultaOk) {
    result.erro = erros.length > 0 ? erros.join('; ') : 'Falha ao consultar TerraBrasilis/DETER';
  } else if (erros.length > 0) {
    result.erro = `Consulta parcial — ${erros.join('; ')}`;
  }

  return result;
}

// ─── CNIR ────────────────────────────────────────────────────────────────────
// CNIR requer autenticação gov.br — inferimos a situação a partir dos dados da análise

export async function consultarCNIR(
  params: PropertyParams,
  findings?: AnalysisFindings
): Promise<CNIRResult> {
  const result: CNIRResult = { found: false };

  if (!params.ccir && !findings?.ccir_exercicio) {
    result.erro = 'CCIR não informado — impossível verificar situação no CNIR';
    result.situacao_ccir = 'nao_localizado';
    return result;
  }

  const ccirExercicio = findings?.ccir_exercicio ?? params.ccir;
  result.found = true;
  result.ccir_exercicio = ccirExercicio;

  if (ccirExercicio) {
    const anoExercicio = parseInt(ccirExercicio, 10);
    const anoAtual = new Date().getFullYear();
    // CCIR é emitido anualmente; se o exercício é do ano anterior ou mais antigo, está irregular
    if (!isNaN(anoExercicio) && anoExercicio < anoAtual - 1) {
      result.situacao_ccir = 'irregular';
      result.itr_situacao = `CCIR exercício ${anoExercicio} — vencido (atual: ${anoAtual})`;
    } else if (!isNaN(anoExercicio) && anoExercicio >= anoAtual - 1) {
      result.situacao_ccir = 'regular';
      result.itr_situacao = `CCIR exercício ${anoExercicio} — vigente`;
    } else {
      result.situacao_ccir = 'nao_localizado';
      result.itr_situacao = 'Exercício CCIR não identificável';
    }
  }

  if (findings?.area_registrada_ha != null && findings?.area_sigef_ha != null) {
    const registrada = findings.area_registrada_ha;
    const sigef = findings.area_sigef_ha;
    if (registrada > 0 && sigef > 0) {
      const divergencia = Math.abs(registrada - sigef) / registrada;
      result.area_registrada_ha = registrada;
      result.divergencia_area = divergencia > 0.05;
      result.divergencia_percentual = Math.round(divergencia * 10000) / 100;
    }
  }

  return result;
}

// ─── Tribunais / DataJud ─────────────────────────────────────────────────────
// API Pública DataJud (CNJ): https://api-publica.datajud.cnj.jus.br/
// Campos disponíveis: numeroProcesso, classe, assuntos, movimentos, orgaoJulgador, tribunal, grau, dataAjuizamento
// NÃO expõe: partes, CPF, CNPJ (dados sigilosos)
// Estratégia: (1) consultar números de processo já conhecidos nos achados
//             (2) buscar classes processuais agrárias no estado da propriedade

const CLASSES_AGRARIAS: Record<string, number> = {
  'Usucapião': 10459,
  'Reintegração / Manutenção de Posse': 1707,
  'Imissão na Posse': 1698,
  'Desapropriação': 39,
  'Ação Reivindicatória': 10445,
  'Nulidade / Anulação de Escritura': 10532,
};

const UF_TO_TJ: Record<string, string> = {
  AC: 'tjac', AL: 'tjal', AM: 'tjam', AP: 'tjap', BA: 'tjba', CE: 'tjce',
  DF: 'tjdft', ES: 'tjes', GO: 'tjgo', MA: 'tjma', MG: 'tjmg', MS: 'tjms',
  MT: 'tjmt', PA: 'tjpa', PB: 'tjpb', PE: 'tjpe', PI: 'tjpi', PR: 'tjpr',
  RJ: 'tjrj', RN: 'tjrn', RO: 'tjro', RR: 'tjrr', RS: 'tjrs', SC: 'tjsc',
  SE: 'tjse', SP: 'tjsp', TO: 'tjto',
};

const UF_TO_TRF: Record<string, string> = {
  AC: 'trf1', AM: 'trf1', AP: 'trf1', BA: 'trf1', DF: 'trf1', GO: 'trf1',
  MA: 'trf1', MG: 'trf1', MT: 'trf1', PA: 'trf1', PI: 'trf1', RO: 'trf1',
  RR: 'trf1', TO: 'trf1',
  ES: 'trf2', RJ: 'trf2',
  MS: 'trf3', SP: 'trf3',
  PR: 'trf4', RS: 'trf4', SC: 'trf4',
  AL: 'trf5', CE: 'trf5', PB: 'trf5', PE: 'trf5', RN: 'trf5', SE: 'trf5',
};

function classificarRiscoProcesso(classe: string, assuntos: string[]): ProcessoTribunal['risco_para_propriedade'] {
  const textoCompleto = `${classe} ${assuntos.join(' ')}`.toLowerCase();
  if (/desapropria|reintegra|imissão|nulidade.*registro|anula.*matrícula/.test(textoCompleto)) return 'alto';
  if (/usucapião|reivindicat|demarca|divisão.*terra|posse/.test(textoCompleto)) return 'medio';
  if (/ambiental|reserva.*legal|app|desmatamento/.test(textoCompleto)) return 'medio';
  return 'indeterminado';
}

function extrairNumerosProcesso(findings?: AnalysisFindings): string[] {
  const nums = new Set<string>();
  if (findings?.numeros_processo) {
    for (const n of findings.numeros_processo) nums.add(n.replace(/[.\-\/]/g, ''));
  }
  const regex = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/g;
  const textoAchados = (findings?.achados ?? []).map(a => `${a.titulo ?? ''} ${a.descricao ?? ''}`).join(' ');
  const resumo = findings?.resumo ?? '';
  for (const match of `${textoAchados} ${resumo}`.matchAll(regex)) {
    nums.add(match[0].replace(/[.\-\/]/g, ''));
  }
  return Array.from(nums).slice(0, 10);
}

async function datajudSearch(
  tribunal: string,
  query: Record<string, unknown>,
  label: string
): Promise<{ hits: Array<Record<string, unknown>>; error?: string }> {
  const datajudKey = process.env.DATAJUD_API_KEY;
  if (!datajudKey) return { hits: [], error: 'DATAJUD_API_KEY não configurada' };

  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`;
  try {
    const res = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `APIKey ${datajudKey}`,
        },
        body: JSON.stringify(query),
      }),
      15000,
      label
    );
    if (!res.ok) return { hits: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    return { hits: data?.hits?.hits ?? [] };
  } catch (err: unknown) {
    return { hits: [], error: err instanceof Error ? err.message : String(err) };
  }
}

function parseHitToProcesso(hit: Record<string, unknown>, fallbackTribunal: string): ProcessoTribunal {
  const src = (hit._source ?? {}) as Record<string, unknown>;
  const classeObj = src.classe as Record<string, unknown> | undefined;
  const assuntosRaw = Array.isArray(src.assuntos) ? src.assuntos : [];
  const assuntos: string[] = assuntosRaw.map((a: Record<string, unknown>) => (a.nome as string) ?? '');
  const classeName = (classeObj?.nome as string) ?? '';
  const movimentos = Array.isArray(src.movimentos) ? src.movimentos : [];
  const ultimoMov = movimentos.length > 0
    ? (movimentos[movimentos.length - 1] as Record<string, unknown>)
    : null;

  return {
    numero: (src.numeroProcesso as string) ?? 'N/D',
    tribunal: (src.tribunal as string) ?? fallbackTribunal.toUpperCase(),
    classe: classeName,
    assuntos,
    partes_envolvidas: [],
    data_ajuizamento: (src.dataAjuizamento as string) ?? '',
    ultimo_movimento: ultimoMov
      ? `${(ultimoMov.nome as string) ?? ''} (${(ultimoMov.dataHora as string)?.slice(0, 10) ?? ''})`
      : (src.dataHoraUltimaAtualizacao as string) ?? '',
    risco_para_propriedade: classificarRiscoProcesso(classeName, assuntos),
  };
}

export async function consultarTribunais(
  params: PropertyParams,
  findings?: AnalysisFindings
): Promise<TribunaisResult> {
  const result: TribunaisResult = {
    consultas_realizadas: [],
    processos_encontrados: 0,
    processos: [],
    alerta_litigio: false,
  };

  const datajudKey = process.env.DATAJUD_API_KEY;
  if (!datajudKey) {
    result.erro = 'DATAJUD_API_KEY não configurada — consulta a tribunais desabilitada';
    return result;
  }

  const seenProcessos = new Set<string>();
  const searches: Promise<void>[] = [];

  // ── Estratégia 1: buscar processos por número (extraídos dos achados) ──
  const numerosConhecidos = extrairNumerosProcesso(findings);
  if (numerosConhecidos.length > 0) {
    const uf = (params.state ?? '').toUpperCase();
    const tribunais = new Set<string>();
    const tj = UF_TO_TJ[uf];
    const trf = UF_TO_TRF[uf];
    if (tj) tribunais.add(tj);
    if (trf) tribunais.add(trf);
    if (tribunais.size === 0) { tribunais.add('trf1'); tribunais.add('tjgo'); }

    for (const tribunal of tribunais) {
      const search = async () => {
        const label = `DataJud ${tribunal.toUpperCase()} — processos conhecidos`;
        result.consultas_realizadas.push(label);
        const query = {
          query: {
            bool: {
              should: numerosConhecidos.map(n => ({ match: { numeroProcesso: n } })),
              minimum_should_match: 1,
            },
          },
          size: 20,
          sort: [{ '@timestamp': { order: 'desc' as const } }],
        };
        const { hits, error } = await datajudSearch(tribunal, query, label);
        if (error) { result.erro = (result.erro ? result.erro + '; ' : '') + `${tribunal}: ${error}`; return; }
        for (const hit of hits) {
          const proc = parseHitToProcesso(hit, tribunal);
          if (!seenProcessos.has(proc.numero)) {
            seenProcessos.add(proc.numero);
            result.processos.push(proc);
          }
        }
      };
      searches.push(search());
    }
  }

  // ── Estratégia 2: buscar classes agrárias no TJ estadual ──
  const uf = (params.state ?? '').toUpperCase();
  const tjAlias = UF_TO_TJ[uf];
  if (tjAlias) {
    const classesCodes = Object.values(CLASSES_AGRARIAS);
    const search = async () => {
      const label = `DataJud ${tjAlias.toUpperCase()} — classes agrárias`;
      result.consultas_realizadas.push(label);
      const query = {
        query: {
          bool: {
            should: classesCodes.map(codigo => ({ match: { 'classe.codigo': codigo } })),
            minimum_should_match: 1,
          },
        },
        size: 10,
        sort: [{ '@timestamp': { order: 'desc' as const } }],
      };
      const { hits, error } = await datajudSearch(tjAlias, query, label);
      if (error) { result.erro = (result.erro ? result.erro + '; ' : '') + `${tjAlias}: ${error}`; return; }
      for (const hit of hits) {
        const proc = parseHitToProcesso(hit, tjAlias);
        if (!seenProcessos.has(proc.numero)) {
          seenProcessos.add(proc.numero);
          result.processos.push(proc);
        }
      }
    };
    searches.push(search());
  }

  await Promise.allSettled(searches);

  result.processos_encontrados = result.processos.length;
  result.alerta_litigio = result.processos.some(
    (p) => p.risco_para_propriedade === 'alto' || p.risco_para_propriedade === 'medio'
  );

  return result;
}

// ─── Certidões ───────────────────────────────────────────────────────────────
// Validade calculada a partir das datas das certidões nos achados da análise

const VALIDADE_CERTIDAO_DIAS = 30;

export async function consultarCertidoes(
  _params: PropertyParams,
  findings?: AnalysisFindings
): Promise<CertidoesResult> {
  const result: CertidoesResult = {
    certidao_inteiro_teor: { valida: false },
    certidao_negativa_onus: { valida: false, onus_detectados: [] },
    certidao_acoes_reipersecutorias: { valida: false, acoes_encontradas: 0 },
  };

  if (findings?.certidao_inteiro_teor_data) {
    const dias = diffDays(findings.certidao_inteiro_teor_data);
    if (dias >= 0) {
      const restante = VALIDADE_CERTIDAO_DIAS - dias;
      result.certidao_inteiro_teor = {
        valida: restante > 0,
        data_emissao: findings.certidao_inteiro_teor_data,
        dias_ate_vencimento: Math.max(restante, 0),
      };
    }
  }

  if (findings?.certidao_negativa_onus_data) {
    const dias = diffDays(findings.certidao_negativa_onus_data);
    const restante = dias >= 0 ? VALIDADE_CERTIDAO_DIAS - dias : -1;
    result.certidao_negativa_onus = {
      valida: restante > 0 && (!findings.onus_detectados || findings.onus_detectados.length === 0),
      onus_detectados: findings.onus_detectados ?? [],
    };
  }

  if (findings?.certidao_acoes_reipersecutorias_data) {
    const dias = diffDays(findings.certidao_acoes_reipersecutorias_data);
    const restante = dias >= 0 ? VALIDADE_CERTIDAO_DIAS - dias : -1;
    const acoes = findings.acoes_reipersecutorias_encontradas ?? 0;
    result.certidao_acoes_reipersecutorias = {
      valida: restante > 0 && acoes === 0,
      acoes_encontradas: acoes,
    };
  }

  return result;
}

// ─── Orquestrador ────────────────────────────────────────────────────────────

export async function runExternalChecks(
  propertyData: PropertyParams,
  analysisFindings?: AnalysisFindings
): Promise<ExternalCheckResult> {
  const sources = ['SIGEF', 'CAR', 'CNIR', 'Tribunais', 'Certidões'];
  const result: ExternalCheckResult = {
    timestamp: new Date().toISOString(),
    sources_consulted: [...sources],
    sources_success: [],
    sources_failed: [],
    sigef: null,
    car: null,
    cnir: null,
    tribunais: null,
    certidoes: null,
    new_alerts: [],
  };

  const [sigef, car, cnir, tribunais, certidoes] = await Promise.allSettled([
    consultarSIGEF(propertyData),
    consultarCAR(propertyData),
    consultarCNIR(propertyData, analysisFindings),
    consultarTribunais(propertyData, analysisFindings),
    consultarCertidoes(propertyData, analysisFindings),
  ]);

  if (sigef.status === 'fulfilled') {
    result.sigef = sigef.value;
    result.sources_success.push('SIGEF');
  } else {
    result.sources_failed.push('SIGEF');
  }

  if (car.status === 'fulfilled') {
    result.car = car.value;
    result.sources_success.push('CAR');
  } else {
    result.sources_failed.push('CAR');
  }

  if (cnir.status === 'fulfilled') {
    result.cnir = cnir.value;
    result.sources_success.push('CNIR');
  } else {
    result.sources_failed.push('CNIR');
  }

  if (tribunais.status === 'fulfilled') {
    result.tribunais = tribunais.value;
    result.sources_success.push('Tribunais');
  } else {
    result.sources_failed.push('Tribunais');
  }

  if (certidoes.status === 'fulfilled') {
    result.certidoes = certidoes.value;
    result.sources_success.push('Certidões');
  } else {
    result.sources_failed.push('Certidões');
  }

  // ─── Geração de alertas a partir dos resultados ────────────────────────────

  if (result.sigef?.sobreposicao_detectada) {
    result.new_alerts.push({
      alert_type: 'sobreposicao_sigef',
      severity: 'critical',
      title: 'Sobreposição detectada no SIGEF',
      description: `A parcela ${result.sigef.parcela_id ?? ''} apresenta sobreposição com outra parcela certificada no SIGEF/INCRA.`,
      metadata: { parcela_id: result.sigef.parcela_id, source: 'SIGEF' },
    });
  }

  if (result.car?.status === 'cancelado' || result.car?.status === 'suspenso') {
    result.new_alerts.push({
      alert_type: 'car_irregular',
      severity: 'critical',
      title: `CAR com status "${result.car.status}"`,
      description: `O Cadastro Ambiental Rural ${result.car.car_code ?? ''} consta como ${result.car.status} no SICAR.`,
      metadata: { car_code: result.car.car_code, status: result.car.status, source: 'SICAR' },
    });
  } else if (result.car?.status === 'pendente') {
    result.new_alerts.push({
      alert_type: 'car_pendente',
      severity: 'warning',
      title: 'CAR com status "pendente"',
      description: `O CAR ${result.car.car_code ?? ''} está pendente de validação no SICAR.`,
      metadata: { car_code: result.car.car_code, source: 'SICAR' },
    });
  }

  if (result.cnir?.situacao_ccir === 'irregular') {
    result.new_alerts.push({
      alert_type: 'ccir_irregular',
      severity: 'warning',
      title: 'CCIR com exercício vencido',
      description: `O CCIR exercício ${result.cnir.ccir_exercicio ?? 'N/D'} está vencido. A regularidade do CCIR é exigida para transmissão de imóvel rural (Lei 4.947/66, art. 22).`,
      metadata: { ccir_exercicio: result.cnir.ccir_exercicio, source: 'CNIR' },
    });
  }

  if (result.cnir?.divergencia_area && result.cnir.divergencia_percentual != null) {
    result.new_alerts.push({
      alert_type: 'divergencia_area',
      severity: result.cnir.divergencia_percentual > 10 ? 'critical' : 'warning',
      title: `Divergência de área: ${result.cnir.divergencia_percentual}%`,
      description: `A área registrada (${result.cnir.area_registrada_ha ?? '?'} ha) diverge da área certificada no SIGEF em ${result.cnir.divergencia_percentual}%.`,
      metadata: {
        area_registrada: result.cnir.area_registrada_ha,
        divergencia_pct: result.cnir.divergencia_percentual,
        source: 'CNIR',
      },
    });
  }

  if (result.tribunais?.alerta_litigio) {
    const altos = result.tribunais.processos.filter((p) => p.risco_para_propriedade === 'alto');
    result.new_alerts.push({
      alert_type: 'litigio_detectado',
      severity: altos.length > 0 ? 'critical' : 'warning',
      title: `${result.tribunais.processos_encontrados} processo(s) encontrado(s)`,
      description: `Foram localizados ${result.tribunais.processos_encontrados} processos judiciais envolvendo o proprietário/CPF, dos quais ${altos.length} apresentam risco alto para a propriedade.`,
      metadata: {
        total: result.tribunais.processos_encontrados,
        alto_risco: altos.length,
        source: 'DataJud',
      },
    });
  }

  if (result.certidoes) {
    const { certidao_inteiro_teor, certidao_negativa_onus, certidao_acoes_reipersecutorias } = result.certidoes;

    if (certidao_inteiro_teor.data_emissao && !certidao_inteiro_teor.valida) {
      result.new_alerts.push({
        alert_type: 'certidao_vencida',
        severity: 'warning',
        title: 'Certidão de inteiro teor vencida',
        description: `A certidão de inteiro teor emitida em ${certidao_inteiro_teor.data_emissao} excedeu a validade de ${VALIDADE_CERTIDAO_DIAS} dias.`,
        metadata: { tipo: 'inteiro_teor', data_emissao: certidao_inteiro_teor.data_emissao, source: 'Certidões' },
      });
    }

    if (certidao_negativa_onus.onus_detectados.length > 0) {
      result.new_alerts.push({
        alert_type: 'onus_detectado',
        severity: 'critical',
        title: `${certidao_negativa_onus.onus_detectados.length} ônus/gravame(s) detectado(s)`,
        description: `Ônus vigentes: ${certidao_negativa_onus.onus_detectados.join(', ')}.`,
        metadata: { onus: certidao_negativa_onus.onus_detectados, source: 'Certidões' },
      });
    }

    if (certidao_acoes_reipersecutorias.acoes_encontradas > 0) {
      result.new_alerts.push({
        alert_type: 'acao_reipersecutoria',
        severity: 'critical',
        title: `${certidao_acoes_reipersecutorias.acoes_encontradas} ação(ões) reipersecutória(s)`,
        description: `Existem ${certidao_acoes_reipersecutorias.acoes_encontradas} ação(ões) reipersecutória(s) incidentes sobre o imóvel, o que pode afetar a segurança da aquisição.`,
        metadata: { acoes: certidao_acoes_reipersecutorias.acoes_encontradas, source: 'Certidões' },
      });
    }
  }

  return result;
}
