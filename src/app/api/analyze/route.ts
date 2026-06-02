import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { buildLegalAuditPrompt } from '@/lib/auditPromptBuilder';

export const maxDuration = 60;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${label}`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
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
    const { analysisId } = body;

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
    if (currentStatus !== 'ready_for_processing') {
      return NextResponse.json({ error: 'Status atual inválido para iniciar processamento' }, { status: 400 });
    }

    // Validação de propriedade e findings
    if (!analysis.property_id) {
      return NextResponse.json({ error: 'Propriedade não associada a esta análise' }, { status: 400 });
    }

    const findings = analysis.findings || {};
    const selectedModules = findings.selected_modules;
    if (!selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
      return NextResponse.json({ error: 'Nenhum módulo selecionado para auditoria' }, { status: 400 });
    }

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

    // 1. Atualizar para "processing" e iniciar log
    const updatedFindings = {
      ...findings,
      current_step: "Processamento de IA iniciado.",
      processing_started_at: new Date().toISOString()
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

      const MODULE_PRICES: Record<string, number> = {
        titulos_incra: 99.90,
        registros: 149.90,
        geoespacial: 199.90,
        nulidades: 249.90,
        forense: 299.90,
        cruzamento: 499.90,
        moratoria_soja: 249.90,
        gravames_dividas: 199.90,
        cadeia_sucessoria: 299.90,
        credito_carbono: 149.90,
        matricula_individual: 99.90,
        cruzamento_matriculas: 149.90,
        cadeia_dominial: 199.90,
        origem_publica: 199.90,
        nulidades_fraudes: 249.90,
        cruzamento_total: 499.90
      };
      
      const amountPaid = selectedModules.reduce((acc: number, mod: string) => acc + (MODULE_PRICES[mod] || 0), 0);

      // Normalização em memória para montagem do prompt
      const normalizedModules = Array.from(new Set(selectedModules.map((m: string) => {
        if (m === "titulos_incra") return "origem_publica";
        if (m === "registros") return "cadeia_dominial";
        if (m === "nulidades" || m === "forense") return "nulidades_fraudes";
        if (m === "cruzamento") return "cruzamento_total";
        return m;
      })));
      
      const instructions = buildLegalAuditPrompt(normalizedModules, documents);

      geminiParts.unshift({ text: instructions });

      let markdownResponse = "";
      if (geminiParts.length > 1) {
        // Chamada Gemini com timeout explícito global de 35s
        await supabaseAdmin
          .from('analyses')
          .update({ findings: { ...updatedFindings, current_step: "Sintetizando Parecer Técnico Forense com Inteligência Artificial..." } })
          .eq('id', analysisId);

        const genAI = new GoogleGenerativeAI(geminiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName });

        const aiPromise = model.generateContent(geminiParts).then(async (result) => {
          const response = await result.response;
          return response.text();
        });

        markdownResponse = await withTimeout(aiPromise, 35000, "gemini_generation");

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
        latitude: latitude,
        longitude: longitude,
        polygon: polygonCoords.length > 0 ? polygonCoords : null,
        current_step: "Parecer técnico concluído.",
        completed_at: new Date().toISOString()
      };

      const { error: dbError } = await supabaseAdmin
        .from('analyses')
        .update({
          status: 'completed',
          risk_level: 'Alto',
          findings: resultJson
        })
        .eq('id', analysisId);

      if (dbError) throw new Error("Erro ao salvar resultado final: " + dbError.message);

      return NextResponse.json({
        success: true,
        simulador: false,
        analysisId: analysisId,
        status: 'completed'
      });

    } catch (innerError: any) {
      console.error("[Synchronous AI Process] Erro no processamento interno:", innerError);

      const isTimeout = innerError.message?.includes("Timeout:");
      const technicalErrorType = isTimeout ? "ai_timeout" : "processing_failed";
      const technicalErrorMessage = innerError.message || "Unknown error";
      const userMessage = isTimeout
        ? "Tempo limite excedido na geração do parecer da IA. Tente novamente."
        : "Não foi possível concluir o parecer técnico neste momento. Tente novamente ou contate o suporte.";

      const failedFindings = {
        ...updatedFindings,
        current_step: "Falha no processamento do parecer técnico.",
        error_message: technicalErrorMessage,
        technical_error_type: technicalErrorType,
        failed_at: new Date().toISOString()
      };

      await supabaseAdmin
        .from('analyses')
        .update({
          status: 'error',
          findings: failedFindings
        })
        .eq('id', analysisId);

      return NextResponse.json({ error: userMessage, type: technicalErrorType }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Erro geral no POST /api/analyze:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
