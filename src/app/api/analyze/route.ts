import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { buildLegalAuditPrompt } from '@/lib/auditPromptBuilder';
import { MODULE_PRICES } from '@/lib/auditModules';
import { extractProblemsFromReport, extractMissingDocumentsFromReport, extractRecommendationsFromReport } from '@/lib/reportExtractors';
import { updateCaseFileWithBasicFacts, withEnsuredCaseFile, type CaseFileDocument } from '@/lib/caseFile';

export const maxDuration = 120;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${label}`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

type RiskLevel = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
type RiskLevelSource = 'ai_section' | 'ai_text' | 'fallback';
type RecoverableErrorType = 'ai_timeout' | 'ai_unavailable' | 'ai_incomplete_response';

interface DerivedRiskLevel {
  level: RiskLevel;
  source: RiskLevelSource;
}

const RECOVERABLE_ERROR_TYPES: RecoverableErrorType[] = ['ai_timeout', 'ai_unavailable', 'ai_incomplete_response'];

function isRecoverableErrorType(value: unknown): value is RecoverableErrorType {
  return typeof value === 'string' && RECOVERABLE_ERROR_TYPES.includes(value as RecoverableErrorType);
}

function getRecoverableRetryReason(findings: Record<string, any>): RecoverableErrorType | null {
  const candidates = [
    findings.technical_error_type,
    findings.retry_reason,
    findings.retry_state?.reason,
    findings.case_file?.retry_state?.reason
  ];

  for (const candidate of candidates) {
    if (isRecoverableErrorType(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getRetryCount(findings: Record<string, any>): number {
  const values = [
    findings.retry_state?.retry_count,
    findings.case_file?.retry_state?.retry_count
  ];

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return 0;
}

function buildRetryState(findings: Record<string, any>, reason: RecoverableErrorType, now: string) {
  return {
    available: true,
    reason,
    retry_count: getRetryCount(findings) + 1,
    last_error_at: now,
    last_error_type: reason
  };
}

/**
 * Extrai a seção de "CLASSIFICAÇÃO DE RISCO" do parecer
 * Retorna um trecho de até 1000 caracteres a partir do início da seção
 */
function extractRiskClassificationSection(resumo: string): string | null {
  // Normalizar para busca: minúsculas + remover acentos
  const normalized = resumo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Possíveis títulos de seção (ordem: mais específicos primeiro)
  const sectionTitles = [
    /\d+\.\s*classificacao\s+de\s+risco/,
    /classificacao\s+de\s+risco\s*[:)\-\n]/,  // com separador após
    /classificacao\s+de\s+risco\b/,           // como palavra completa
    /grau\s+de\s+risco\s*[:)\-\n]/,
    /grau\s+de\s+risco\b/,
    /risco\s+final\s*[:)\-\n]/,
    /risco\s+final\b/
  ];
  
  for (const titleRegex of sectionTitles) {
    const match = normalized.match(titleRegex);
    if (match) {
      // Começar do match e pegar até 1000 caracteres
      const startIdx = match.index || 0;
      const section = resumo.substring(startIdx, startIdx + 1000);
      return section;
    }
  }
  
  return null;
}

/**
 * Procura um nível de risco em um trecho de texto normalizado
 * Prioridade: Crítico > Alto > Médio > Baixo
 * Usa busca simples (indexOf) para máxima compatibilidade
 */
function findRiskLevelInText(normalizedText: string): RiskLevel | null {
  // Ordem de prioridade: Crítico > Alto > Médio > Baixo
  const patterns = [
    { level: 'Crítico' as RiskLevel, keywords: ['critico', 'crítico'] },
    { level: 'Alto' as RiskLevel, keywords: ['alto'] },
    { level: 'Médio' as RiskLevel, keywords: ['medio', 'médio'] },
    { level: 'Baixo' as RiskLevel, keywords: ['baixo'] }
  ];
  
  for (const { level, keywords } of patterns) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        return level;
      }
    }
  }
  
  return null;
}

/**
 * Deriva o risk level com prioridade: seção explícita > busca genérica > fallback
 * Retorna tanto o nível quanto a fonte (ai_section | ai_text | fallback)
 */
function deriveRiskLevelFromResumo(resumo: string): DerivedRiskLevel {
  const normalizedFull = resumo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // ESTRATÉGIA 1: Procurar seção explícita de classificação de risco
  const classificationSection = extractRiskClassificationSection(resumo);
  if (classificationSection) {
    const normalizedSection = classificationSection
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    const sectionRiskLevel = findRiskLevelInText(normalizedSection);
    if (sectionRiskLevel) {
      return {
        level: sectionRiskLevel,
        source: 'ai_section'
      };
    }
  }

  // ESTRATÉGIA 2: Busca genérica em todo o texto (fallback)
  const genericRiskLevel = findRiskLevelInText(normalizedFull);
  if (genericRiskLevel) {
    return {
      level: genericRiskLevel,
      source: 'ai_text'
    };
  }

  // ESTRATÉGIA 3: Fallback padrão
  return {
    level: 'Alto',
    source: 'fallback'
  };
}

function normalizeForQualityCheck(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function countWords(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function validateFastChainOfTitleResponse(resumo: string): string | null {
  const normalized = normalizeForQualityCheck(resumo);
  const requiredSections = [
    'identificacao',
    'documentos analisados',
    'cadeia dominial',
    'achados',
    'classificacao de risco',
    'recomendacoes'
  ];

  const missingSection = requiredSections.find((section) => !normalized.includes(section));
  if (missingSection) {
    return `Resposta incompleta: seção obrigatória ausente (${missingSection}).`;
  }

  const insufficientDocumentSignals = [
    'documentos insuficientes',
    'documentacao insuficiente',
    'documentacao apresentada e insuficiente',
    'nao ha dados suficientes',
    'nao foi possivel identificar',
    'nao e possivel concluir apenas com os documentos apresentados',
    'documentos apresentados nao permitem'
  ];

  const wordCount = countWords(resumo);
  const hasInsufficientDocumentSignal = insufficientDocumentSignals.some((signal) => normalized.includes(signal));
  if (wordCount < 600 && !hasInsufficientDocumentSignal) {
    return `Resposta incompleta: parecer com ${wordCount} palavras, abaixo do mínimo esperado.`;
  }

  const englishIndicators = [
    'public deed',
    'ownership',
    'chain of title',
    'risk classification',
    'missing documents',
    'recommendations',
    'registry events',
    'title deed'
  ];
  const englishHits = englishIndicators.filter((indicator) => normalized.includes(indicator));
  if (englishHits.length >= 2 || normalized.includes('public deed')) {
    return `Resposta inadequada: indícios de idioma estrangeiro (${englishHits.join(', ') || 'public deed'}).`;
  }

  return null;
}

// Parsers locais de arquivos geoespaciais
const parseKmlCoordinates = (kmlText: string): [number, number][] => {
  const coordsList: [number, number][] = [];
  const match = kmlText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (match && match[1]) {
    const rawCoords = match[1].trim();
    const points = rawCoords.split(/\s+/);
    for (const p of points) {
      if (!p) continue;
      const parts = p.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          coordsList.push([lat, lng]);
        }
      }
    }
  }
  return coordsList;
};

const parseGpxCoordinates = (gpxText: string): [number, number][] => {
  const coordsList: [number, number][] = [];
  const regex = /<(?:trkpt|wpt|rtept)\s+[^>]*lat=["'](-?\d+\.\d+)["']\s+[^>]*lon=["'](-?\d+\.\d+)["']/g;
  let match;
  while ((match = regex.exec(gpxText)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      coordsList.push([lat, lon]);
    }
  }
  if (coordsList.length === 0) {
    const regexAlt = /<(?:trkpt|wpt|rtept)\s+[^>]*lon=["'](-?\d+\.\d+)["']\s+[^>]*lat=["'](-?\d+\.\d+)["']/g;
    while ((match = regexAlt.exec(gpxText)) !== null) {
      const lon = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        coordsList.push([lat, lon]);
      }
    }
  }
  return coordsList;
};

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Cabeçalho de autorização ausente' }, { status: 401 });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 });
    }

    const body = await req.json();
    const { analysisId, forceRetry } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId não informado' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Consultar a análise
    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from('analyses')
      .select('id, user_id, status, property_id, findings')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 });
    }

    // Validação de ownership
    if (analysis.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado: a análise não pertence ao usuário' }, { status: 403 });
    }

    // Validação de status atual
    const currentStatus = (analysis.status || '').toLowerCase().trim();

    const findings = analysis.findings || {};
    if (currentStatus === 'processing') {
      return NextResponse.json({ error: 'Esta análise já está em processamento.' }, { status: 409 });
    }

    const retryReason = getRecoverableRetryReason(findings);
    const isRetryExhausted = findings.retry_exhausted === true;
    const isRecoverableRetry =
      currentStatus === 'error' &&
      (
        findings.retry_available === true ||
        Boolean(retryReason) ||
        (forceRetry === true && isRetryExhausted)
      );

    if (currentStatus !== 'ready_for_processing' && !isRecoverableRetry) {
      return NextResponse.json({ error: 'Status atual inválido para iniciar processamento' }, { status: 400 });
    }

    // Validação de propriedade e findings
    if (!analysis.property_id) {
      return NextResponse.json({ error: 'Propriedade não associada a esta análise' }, { status: 400 });
    }

    const selectedModules = findings.selected_modules;
    if (!selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
      return NextResponse.json({ error: 'Nenhum módulo selecionado para auditoria' }, { status: 400 });
    }

    const { data: propertyData } = await supabaseAdmin
      .from('properties')
      .select('name, state, city, area, cpf_cnpj, car_number')
      .eq('id', analysis.property_id)
      .maybeSingle();

    // Buscar os documentos vinculados
    const { data: documents, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('property_id', analysis.property_id);

    if (docError) {
      return NextResponse.json({ error: 'Erro ao obter documentos da propriedade: ' + docError.message }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'Nenhum documento anexado para a análise da propriedade' }, { status: 400 });
    }

    const caseFileDocuments: CaseFileDocument[] = documents.map((doc: any) => ({
      name: doc.file_path?.split('/').pop() || doc.file_path || 'Documento',
      type: doc.document_type || null,
      storage_path: doc.file_path || null,
      size: null,
      uploaded_at: doc.created_at || null
    }));

    const findingsWithCaseFile = withEnsuredCaseFile(findings, {
      property: {
        name: propertyData?.name || null,
        state: propertyData?.state || null,
        city: propertyData?.city || null,
        car_number: propertyData?.car_number || null,
        declared_area_ha: propertyData?.area ?? null,
        owner_document: propertyData?.cpf_cnpj || null
      },
      documents: caseFileDocuments
    });

    const processingStartedAt = new Date().toISOString();
    const retryStartState = isRecoverableRetry
      ? buildRetryState(findingsWithCaseFile, retryReason || 'ai_timeout', processingStartedAt)
      : null;

    // 1. Atualizar para "processing" e iniciar log
    const updatedFindings = {
      ...findingsWithCaseFile,
      retry_available: false,
      retry_reason: null,
      ...(retryStartState ? { retry_state: retryStartState } : {}),
      case_file: {
        ...findingsWithCaseFile.case_file,
        ...(retryStartState ? { retry_state: retryStartState } : {})
      },
      current_step: "Processamento de IA iniciado.",
      processing_started_at: processingStartedAt
    };

    const { error: startUpdateError } = await supabaseAdmin
      .from('analyses')
      .update({
        status: 'processing',
        findings: updatedFindings
      })
      .eq('id', analysisId);

    if (startUpdateError) {
      return NextResponse.json({ error: 'Erro ao transicionar para processando: ' + startUpdateError.message }, { status: 500 });
    }

    // Bloco de processamento principal síncrono
    try {
      const startedAt = Date.now();
      let geminiMs = 0;
      let geminiParts: any[] = [];
      let polygonCoords: [number, number][] = [];

      for (const doc of documents) {
        // Baixar documentos com timeout de 10s por arquivo
        const downloadPromise = supabaseAdmin.storage.from('documents').download(doc.file_path);
        const { data: fileData, error: downloadError } = await withTimeout(
          downloadPromise,
          10000,
          `download_${doc.file_path}`
        );

        if (downloadError || !fileData) {
          throw new Error(`Falha ou tempo limite excedido no download do arquivo: ${doc.file_path}`);
        }

        const isKml = doc.file_path.toLowerCase().endsWith('.kml') || doc.document_type === 'KML' || doc.document_type?.includes('KML');
        const isGpx = doc.file_path.toLowerCase().endsWith('.gpx') || doc.document_type === 'GPX' || doc.document_type?.includes('GPX');

        if (isKml || isGpx) {
          try {
            const textContent = await fileData.text();
            const coords = isKml ? parseKmlCoordinates(textContent) : parseGpxCoordinates(textContent);
            if (coords.length > 0) {
              polygonCoords = coords;
            }
          } catch (e) {
            console.error("[Geo Parser] Erro ao ler arquivo KML/GPX:", e);
          }
        }
        
        if (doc.file_path.toLowerCase().endsWith('.pdf') || doc.document_type?.toLowerCase().includes('matrícula') || doc.document_type === 'Certidão Inteiro Teor' || doc.document_type === 'Matrícula') {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          
          geminiParts.push({
            inlineData: {
              data: base64Data,
              mimeType: "application/pdf"
            }
          });
          geminiParts.push({
            text: `\n[Nota: O arquivo PDF visualizado acima representa: ${doc.document_type}]\n`
          });
        }
      }

      if (geminiParts.length === 0 && polygonCoords.length === 0) {
        throw new Error('Documentos ilegíveis ou insuficientes para análise fundiária');
      }

      const amountPaid = selectedModules.reduce((acc: number, mod: string) => acc + (MODULE_PRICES[mod] || 0), 0);

      // Normalização em memória para montagem do prompt
      const normalizedModules = Array.from(new Set(selectedModules.map((m: string) => {
        if (m === "titulos_incra") return "origem_publica";
        if (m === "registros") return "cadeia_dominial";
        if (m === "nulidades" || m === "forense") return "nulidades_fraudes";
        if (m === "cruzamento") return "cruzamento_total";
        return m;
      })));
      const isFastChainOfTitleOnly = normalizedModules.length === 1 && normalizedModules[0] === "cadeia_dominial";
      
      const instructions = buildLegalAuditPrompt(normalizedModules, documents);

      // Para matrículas densas, adicionar instrução de concisão ao prompt
      const pdfPartsCountForPrompt = geminiParts.filter(p => p.inlineData?.mimeType === 'application/pdf').length;
      if (pdfPartsCountForPrompt >= 2) {
        const denseSuffix = `\n\nATENÇÃO: Os documentos anexados são densos e extensos. Produza o parecer de forma objetiva e concisa, focando nos pontos juridicamente relevantes. Evite transcrições longas de atos repetitivos. Agrupe eventos por período. Limite a resposta a no máximo 2.000 palavras. Priorize qualidade sobre volume.`;
        geminiParts.unshift({ text: instructions + denseSuffix });
      } else {
        geminiParts.unshift({ text: instructions });
      }

      let markdownResponse = "";
      if (geminiParts.length > 1) {
      // Chamada Gemini com timeout explícito global (adaptativo para documentos densos)
        await supabaseAdmin
          .from('analyses')
          .update({ findings: { ...updatedFindings, current_step: "Sintetizando Parecer Técnico Forense com Inteligência Artificial..." } })
          .eq('id', analysisId);

        const genAI = new GoogleGenerativeAI(geminiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
        const model = genAI.getGenerativeModel({
          model: modelName,
          ...(isFastChainOfTitleOnly ? { generationConfig: { maxOutputTokens: 4096 } } : {})
        });

        const genStartAt = Date.now();

        // Detectar documentos densos: múltiplos PDFs ou muitos parts (>6 indica matrícula densa)
        const pdfPartsCount = geminiParts.filter(p => p.inlineData?.mimeType === 'application/pdf').length;
        const isDenseDocument = pdfPartsCount >= 3 || geminiParts.length > 12;

        const aiPromise = model.generateContent(geminiParts).then(async (result) => {
          const response = await result.response;
          return response.text();
        });

        // Timeout adaptativo: 110s para documentos densos, 90s para documentos simples
        const aiTimeoutMs = isDenseDocument ? 110000 : 90000;
        markdownResponse = await withTimeout(aiPromise, aiTimeoutMs, "gemini_generation");
        geminiMs = Date.now() - genStartAt;

        if (markdownResponse.startsWith('\`\`\`markdown')) {
          markdownResponse = markdownResponse.replace(/^\`\`\`markdown\n?/, '').replace(/\n?\`\`\`$/, '');
        } else if (markdownResponse.startsWith('\`\`\`')) {
          markdownResponse = markdownResponse.replace(/^\`\`\`\n?/, '').replace(/\n?\`\`\`$/, '');
        }
      } else {
        markdownResponse = `### PARECER TÉCNICO GEOESPACIAL (APENAS GEOMETRIA KML/GPX)\n\nFoi efetuado o upload de arquivo de geometria de limites físicos e georreferenciamento em formato digital nativo. Não foram inseridas matrículas textuais em PDF para análise textual.\n\n* **Limite Físico Importado:** ${polygonCoords.length} pontos de curva detectados.\n* **Status de Integração:** Geometria disponível no visualizador de mapas 3D.`;
      }

      // Validar retorno da IA
      if (!markdownResponse || markdownResponse.trim().length < 120 || markdownResponse.includes("PLACEHOLDER")) {
        throw new Error("A IA gerou um laudo incompleto ou muito curto.");
      }

      if (isFastChainOfTitleOnly) {
        const fastQualityIssue = validateFastChainOfTitleResponse(markdownResponse);
        if (fastQualityIssue) {
          const qualityError = new Error(fastQualityIssue);
          (qualityError as any).technicalErrorType = 'ai_incomplete_response';
          (qualityError as any).userMessage = 'A IA retornou um parecer incompleto. Tente reprocessar.';
          (qualityError as any).findingsCurrentStep = 'A IA retornou um parecer incompleto. Tente reprocessar.';
          throw qualityError;
        }
      }

      const derivedRisk = deriveRiskLevelFromResumo(markdownResponse);
      const riskLevel = derivedRisk.level;
      const riskLevelSource = derivedRisk.source;

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (polygonCoords.length > 0) {
        let latSum = 0;
        let lngSum = 0;
        for (const c of polygonCoords) {
          latSum += c[0];
          lngSum += c[1];
        }
        latitude = latSum / polygonCoords.length;
        longitude = lngSum / polygonCoords.length;
      }

      const coordsMatch = markdownResponse.match(/COORDS:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
      if (coordsMatch) {
        if (polygonCoords.length === 0) {
          latitude = parseFloat(coordsMatch[1]);
          longitude = parseFloat(coordsMatch[2]);
        }
        markdownResponse = markdownResponse.replace(/COORDS:\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+/i, '').trim();
      }

      const completedAt = new Date().toISOString();
      const postprocessStartAt = Date.now();
      const resultJson = {
        ...updatedFindings,
        isHtmlResumo: false,
        resumo: markdownResponse,
        problemas: [],
        recomendacoes: [],
        documentosFaltantes: [],
        linhaDoTempo: [],
        checklist: [],
        amountPaid: amountPaid,
        modulesSelected: selectedModules,
        latitude,
        longitude,
        polygon: polygonCoords.length > 0 ? polygonCoords : null,
        current_step: "Parecer técnico concluído.",
        completed_at: completedAt,
        risk_level_source: riskLevelSource,
        ...(riskLevelSource === 'ai_section' ? { risk_level_detected_at: completedAt } : {}),
        processing_metrics: {
          gemini_ms: geminiMs,
          total_ms: Date.now() - startedAt
        }
      };

      const { error: dbError } = await supabaseAdmin
        .from('analyses')
        .update({
          status: 'completed',
          risk_level: riskLevel,
          findings: resultJson
        })
        .eq('id', analysisId);

      if (dbError) throw new Error("Erro ao salvar resultado final: " + dbError.message);

      try {
        const parsedProblemas = extractProblemsFromReport(markdownResponse);
        const parsedDocumentosFaltantes = extractMissingDocumentsFromReport(markdownResponse);
        const parsedRecomendacoes = extractRecommendationsFromReport(markdownResponse);
        const postprocessMs = Date.now() - postprocessStartAt;
        const totalMs = Date.now() - startedAt;
        let caseFileExtractError: string | null = null;
        let enrichedCaseFile = resultJson.case_file;

        try {
          enrichedCaseFile = updateCaseFileWithBasicFacts(resultJson.case_file, {
            now: new Date().toISOString(),
            property: {
              name: propertyData?.name || null,
              state: propertyData?.state || null,
              city: propertyData?.city || null,
              car_number: propertyData?.car_number || null,
              declared_area_ha: propertyData?.area ?? null,
              owner_document: propertyData?.cpf_cnpj || null
            },
            resumo: markdownResponse,
            problemas: parsedProblemas,
            documentosFaltantes: parsedDocumentosFaltantes,
            recomendacoes: parsedRecomendacoes,
            riskLevel
          });
        } catch (caseFileError: any) {
          caseFileExtractError = ((caseFileError && (caseFileError.message || caseFileError.toString())) || 'Erro desconhecido no case_file')
            .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
          console.error('[CaseFile] Falha ao enriquecer fatos bÃ¡sicos:', caseFileExtractError);
        }

        const patchedFindings = {
          ...resultJson,
          problemas: parsedProblemas,
          recomendacoes: parsedRecomendacoes,
          documentosFaltantes: parsedDocumentosFaltantes,
          case_file: enrichedCaseFile,
          ...(caseFileExtractError ? { case_file_extract_error: caseFileExtractError } : {}),
          structured_extract_source: 'local_parser',
          structured_extract_at: new Date().toISOString(),
          processing_metrics: {
            gemini_ms: geminiMs,
            postprocess_ms: postprocessMs,
            total_ms: totalMs
          }
        };

        const { error: patchError } = await supabaseAdmin
          .from('analyses')
          .update({ findings: patchedFindings })
          .eq('id', analysisId);

        if (patchError) {
          console.error('[Postprocess] Falha ao salvar extração estruturada:', patchError.message);
        }
      } catch (postprocessError: any) {
        const postprocessMs = Date.now() - postprocessStartAt;
        const totalMs = Date.now() - startedAt;
        const structuredError = (postprocessError && (postprocessError.message || postprocessError.toString())) || 'Erro desconhecido na extração estruturada';
        console.error('[Postprocess] Erro na extração estruturada:', structuredError);

        const failedFindings = {
          ...resultJson,
          structured_extract_source: 'local_parser',
          structured_extract_at: new Date().toISOString(),
          structured_extract_error: structuredError.replace(/https?:\/\/\S+/gi, '[REDACTED_URL]'),
          processing_metrics: {
            gemini_ms: geminiMs,
            postprocess_ms: postprocessMs,
            total_ms: totalMs
          }
        };

        const { error: patchError } = await supabaseAdmin
          .from('analyses')
          .update({ findings: failedFindings })
          .eq('id', analysisId);

        if (patchError) {
          console.error('[Postprocess] Falha ao salvar erro de extração estruturada:', patchError.message);
        }
      }

      return NextResponse.json({
        success: true,
        simulador: false,
        analysisId: analysisId,
        status: 'completed'
      });

    } catch (innerError: any) {
      console.error("[Synchronous AI Process] Erro no processamento interno:", innerError);

      const rawMessage = (innerError && (innerError.message || innerError.toString())) || '';
      const messageLower = rawMessage.toLowerCase();
      const isTimeout = messageLower.includes("timeout:");
      const forcedTechnicalErrorType = innerError?.technicalErrorType;

      const aiUnavailableIndicators = [
        '503',
        'service unavailable',
        'high demand',
        'model is currently experiencing high demand'
      ];

      const isAiUnavailable = aiUnavailableIndicators.some(p => messageLower.includes(p));

      let technicalErrorType = 'processing_failed';
      let userMessage = 'Não foi possível concluir o parecer técnico neste momento. Tente novamente ou contate o suporte.';
      let findingsCurrentStep = 'Falha no processamento do parecer técnico.';

      if (forcedTechnicalErrorType === 'ai_incomplete_response') {
        technicalErrorType = 'ai_incomplete_response';
        findingsCurrentStep = innerError?.findingsCurrentStep || 'A IA retornou um parecer incompleto. Tente reprocessar.';
        userMessage = innerError?.userMessage || 'A IA retornou um parecer incompleto. Tente reprocessar.';
      } else if (isTimeout) {
        technicalErrorType = 'ai_timeout';
        findingsCurrentStep = 'A IA demorou mais que o esperado para concluir. Voce pode tentar novamente sem reenviar os documentos.';
        userMessage = 'A IA demorou mais que o esperado para concluir. Voce pode tentar novamente sem reenviar os documentos.';
      } else if (isAiUnavailable) {
        technicalErrorType = 'ai_unavailable';
        // Mensagem de etapa salva de forma amigável
        findingsCurrentStep = 'IA temporariamente indisponível. Tente novamente em alguns minutos.';
        userMessage = 'A IA está temporariamente indisponível. Tente reprocessar em alguns minutos.';
      }

      // Sanitize any URLs to avoid leaking endpoints
      const sanitizedMessage = rawMessage.replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
      const failedAt = new Date().toISOString();
      const recoverableFailureType = isRecoverableErrorType(technicalErrorType) ? technicalErrorType : null;
      
      const currentRetryCount = getRetryCount(updatedFindings);
      const isTimeoutExhausted = recoverableFailureType === 'ai_timeout' && currentRetryCount >= 5;
      
      const isRecoverableFailure = Boolean(recoverableFailureType) && !isTimeoutExhausted;
      let retryState: any = null;

      if (isTimeoutExhausted) {
        retryState = {
          available: false,
          exhausted: true,
          reason: "max_ai_timeout_attempts",
          retry_count: currentRetryCount,
          last_error_type: "ai_timeout",
          last_error_at: failedAt
        };
        findingsCurrentStep = "A IA excedeu o tempo limite em múltiplas tentativas. Esta análise exige processamento em etapas.";
        userMessage = "A IA excedeu o tempo limite em múltiplas tentativas. Esta análise exige processamento em etapas.";
      } else if (recoverableFailureType) {
        retryState = buildRetryState(updatedFindings, recoverableFailureType, failedAt);
      }

      const failedFindings = {
        ...updatedFindings,
        current_step: findingsCurrentStep,
        error_message: sanitizedMessage || 'Erro no processamento interno',
        technical_error_type: isTimeoutExhausted ? 'max_ai_timeout_attempts' : technicalErrorType,
        failed_at: failedAt,
        retry_available: isRecoverableFailure,
        retry_reason: isTimeoutExhausted ? "max_ai_timeout_attempts" : (isRecoverableFailure ? technicalErrorType : null),
        retry_exhausted: isTimeoutExhausted ? true : undefined,
        ...(retryState ? { retry_state: retryState } : {}),
        case_file: {
          ...updatedFindings.case_file,
          ...(retryState ? { retry_state: retryState } : {})
        }
      };

      await supabaseAdmin
        .from('analyses')
        .update({
          status: 'error',
          findings: failedFindings
        })
        .eq('id', analysisId);

      const statusCode = isAiUnavailable ? 503 : 500;
      return NextResponse.json({ error: userMessage, type: technicalErrorType }, { status: statusCode });
    }

  } catch (error: any) {
    console.error('Erro geral no POST /api/analyze:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
