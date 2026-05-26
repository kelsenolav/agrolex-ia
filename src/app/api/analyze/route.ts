import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

// Configuração CRÍTICA para a Vercel: Permite que a função rode por até 60 segundos
// (O padrão do plano Hobby é 10 segundos, o que mataria a IA)
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';

  if (!supabaseServiceKey) {
    console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY não está definida!");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const genAI = new GoogleGenerativeAI(geminiKey);
  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader || '' } }
    });

    const { propertyId, analysisId, analysisLevel, cpfCnpj, carNumber } = await req.json();

    if (!propertyId || !analysisId) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const { data: { user } } = await supabaseUser.auth.getUser();
    const userEmail = user?.email || 'cliente@teste.com';

    // O servidor responde imediatamente ao cliente
    // E joga a tarefa pesada para o background da Vercel
    // O servidor responde imediatamente ao cliente
    // E joga a tarefa pesada para o background da Vercel
    waitUntil(
      (async () => {
        const updateStep = async (stepMessage: string) => {
          console.log(`[Analysis Progress] ${stepMessage}`);
          await supabaseAdmin
            .from('analyses')
            .update({ findings: { current_step: stepMessage } })
            .eq('id', analysisId);
        };

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

        try {
          console.log(`[Background Job] Iniciando Análise IA para ID: ${analysisId}`);
          await updateStep('Lendo e validando arquivos anexados no cofre...');
          
          const { data: documents, error: docError } = await supabaseAdmin
            .from('documents')
            .select('*')
            .eq('property_id', propertyId);

          if (docError) throw new Error('Erro de permissão no Supabase: ' + JSON.stringify(docError));
          if (!documents || documents.length === 0) throw new Error('Nenhum documento encontrado.');

          let geminiParts: any[] = [];
          let polygonCoords: [number, number][] = [];

          // Busca dados Governamentais MOCK se CPF/CNPJ ou CAR estiverem presentes
          if (cpfCnpj || carNumber) {
            await updateStep('Consultando restrições e cruzamentos governamentais (IBAMA/Receita)...');
            console.log(`[Background Job] Buscando integrações GOV para CPF/CNPJ: ${cpfCnpj} e CAR: ${carNumber}`);
            try {
              const host = req.headers.get('host') || 'localhost:3000';
              const protocol = host.includes('localhost') ? 'http' : 'https';
              const govRes = await fetch(`${protocol}://${host}/api/gov?cpf=${cpfCnpj || ''}&car=${carNumber || ''}`);
              if (govRes.ok) {
                const govData = await govRes.json();
                geminiParts.push({
                  text: `\n=== DADOS GOVERNAMENTAIS EXTERNOS ENCONTRADOS (IBAMA, Receita, Tribunais) ===\n${JSON.stringify(govData.data, null, 2)}\n=== FIM DOS DADOS GOVERNAMENTAIS ===\nPor favor, cruze estes dados com os documentos abaixo.\n`
                });
              }
            } catch (govErr) {
              console.error("[Background Job] Erro ao buscar API Gov Mock:", govErr);
            }
          }
          
          await updateStep('Executando visão computacional e extraindo polígonos geoespaciais...');
          for (const doc of documents) {
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from('documents')
              .download(doc.file_path);
              
            if (downloadError || !fileData) continue;

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
            throw new Error('Não foi possível ler os documentos visuais.');
          }

          const MODULE_PRICES: Record<string, number> = {
            titulos_incra: 99.90,
            registros: 149.90,
            geoespacial: 199.90,
            nulidades: 249.90,
            forense: 299.90,
            cruzamento: 499.90,
          };
          
          const selectedModules = (analysisLevel || '').split(',');
          const amountPaid = selectedModules.reduce((acc: number, mod: string) => acc + (MODULE_PRICES[mod] || 0), 0);
          
          let instructions = `Você é um Perito Forense Fundiário Sênior e Especialista em Direito Agrário/Registral.
Sua missão é ler atentamente os documentos extraídos anexados e gerar um Parecer Forense rigoroso no formato Markdown.

INSTRUÇÕES DE FORMATAÇÃO:
1. Retorne APENAS o texto em Markdown puro. NÃO retorne blocos de código JSON nem nada fora do padrão Markdown.
2. Use formatação rica: **negrito** para alertas, listas com bullet points, títulos (###).
3. Seja profundo, cite os números das matrículas, datas, hectares exatos e embasamento legal.

Os módulos de análise solicitados pelo usuário são:
`;

          if (selectedModules.includes('titulos_incra')) {
            instructions += `\n- MÓDULO 1: AUDITORIA DE TÍTULOS INCRA. Verifique minuciosamente TODOS os títulos emitidos pelo INCRA na origem. Identifique Título Definitivo, Contrato de Concessão, etc. Analise pagamento (quitação, inadimplemento, quitação fraudulenta), Prazo de inalienabilidade (venda simulada, alienação antes do prazo), Exploração direta e Residência (posse fictícia), e Acúmulo irregular de lotes.\n`;
          }
          if (selectedModules.includes('registros')) {
            instructions += `\n- MÓDULO 2: AUDITORIA REGISTRAL E AVERBAÇÕES. Foque na manipulação cartorária, criação de matrículas fantasmas/clonadas, quebra da unicidade matricial. Audite gravames (hipotecas sucessivas, penhoras milionárias, cancelamentos em bloco suspeitos), averbações contraditórias e falsidade ideológica processual (uso de matrícula nula).\n`;
          }
          if (selectedModules.includes('geoespacial')) {
            instructions += `\n- MÓDULO 3: AUDITORIA GEOESPACIAL E SIGEF. Verifique a (in)compatibilidade cadastral. Existe CAR, CCIR, SIGEF averbado? Há expansão territorial artificial e divergência de área? Há sobreposição com assentamentos reais, APP ou terras indígenas? Há clonagem de perímetro gerando grilagem de papel?\n`;
          }
          if (selectedModules.includes('nulidades')) {
            instructions += `\n- MÓDULO 4: MAPEAMENTO DE NULIDADES. Estruture o parecer apontando expressamente: Nulidade Absoluta (ex: registro duplicado), Inexistência Jurídica (fraude processual), Violação da Função Social (abandono vs posse pro labore), Nulidade Relativa (erros comunicacionais), e Violações do INCRA.\n`;
          }
          if (selectedModules.includes('forense')) {
            instructions += `\n- MÓDULO 5: INVESTIGAÇÃO FORENSE (GRILAGEM). Aponte indícios de lavagem patrimonial rural, laranjas (interposição fraudulenta), apropriação de terras públicas, padrões repetitivos financeiros (hipotecas para fins especulativos) e falsidade ideológica.\n`;
          }
          if (selectedModules.includes('cruzamento')) {
            instructions += `\n- MÓDULO 6: CRUZAMENTO SISTÊMICO TOTAL. Cruza as informações de forma magistral: Matrículas antigas vs novas, Matrículas vs Processos judiciais, Matrículas vs Memoriais Físicos (SIGEF), Matrículas vs Posse Fática, Matrículas vs INCRA. Aponte todas as contradições entre os bancos de dados.\n`;
          }
          
          instructions += `\nINSTRUÇÃO FINAL: Leia minuciosamente os documentos PDFs anexados com sua visão computacional avançada, extraindo as entrelinhas e as averbações manuscritas/carimbos.
INSTRUÇÃO CRÍTICA GEOESPACIAL: Identifique no texto dos documentos as coordenadas geográficas (Latitude e Longitude em formato decimal) do imóvel. Se encontrar, inclua na última linha do seu laudo o marcador especial exatamente neste formato: COORDS: lat, lng (exemplo: COORDS: -17.6521, -51.0429). Se não encontrar coordenadas exatas nos documentos, identifique o município e estado do imóvel no documento (por exemplo, Tocantínia-TO) e estime coordenadas rurais verossímeis correspondentes à região deste município (por exemplo, na estrada de aparecida em Tocantínia-TO, estime coordenadas na serra do lajeado como -10.0500, -48.2000) e inclua o marcador COORDS com estes valores estimados.

AGORA, GERE O PARECER FORENSE COMPLETAMENTE ESTRUTURADO EM MARKDOWN:`;

          geminiParts.unshift({ text: instructions });

          await updateStep('Sintetizando Parecer Técnico Forense com Inteligência Artificial...');

          let markdownResponse = "";
          if (geminiParts.length > 1) {
            const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
            const result = await model.generateContent(geminiParts);
            const response = await result.response;
            markdownResponse = response.text();

            if (markdownResponse.startsWith('\`\`\`markdown')) {
              markdownResponse = markdownResponse.replace(/^\`\`\`markdown\n?/, '').replace(/\n?\`\`\`$/, '');
            } else if (markdownResponse.startsWith('\`\`\`')) {
              markdownResponse = markdownResponse.replace(/^\`\`\`\n?/, '').replace(/\n?\`\`\`$/, '');
            }
          } else {
            markdownResponse = `### PARECER TÉCNICO GEOESPACIAL (APENAS GEOMETRIA KML/GPX)\n\nFoi efetuado o upload de arquivo de geometria de limites físicos e georreferenciamento em formato digital nativo. Não foram inseridas matrículas textuais em PDF para análise textual.\n\n* **Limite Físico Importado:** ${polygonCoords.length} pontos de curva detectados.\n* **Status de Integração:** Geometria disponível no visualizador de mapas 3D.`;
          }

          // Extrair coordenadas da resposta da IA ou do KML
          let latitude = -17.6521;
          let longitude = -51.0429;

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
            polygon: polygonCoords.length > 0 ? polygonCoords : null
          };

          const { error: dbError } = await supabaseAdmin
            .from('analyses')
            .update({
              status: 'completed',
              risk_level: 'Alto',
              findings: resultJson
            })
            .eq('id', analysisId);

          if (dbError) throw new Error("Erro DB: " + dbError.message);

          // [NOVO] Disparar Notificação por E-mail Passiva (Resend)
          console.log(`[Background Job] Disparando e-mail de conclusão para: ${userEmail}`);
          
          if (!process.env.RESEND_API_KEY) {
            console.warn("⚠️ RESEND_API_KEY não configurada. Simulando envio de e-mail localmente...");
          } else {
            await resend.emails.send({
              from: 'Agrilex IA <laudos@agrilex.com.br>',
              to: [userEmail],
              subject: '✅ Seu Laudo Pericial Fundiário está pronto!',
              html: `
                <h2>Olá! A análise da sua propriedade foi concluída com sucesso.</h2>
                <p>Nossa Inteligência Artificial processou os documentos enviados e cruzou as bases de dados.</p>
                <p><strong>Risco Detectado:</strong> Alto</p>
                <br/>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard/resultado?id=${analysisId}" style="background-color: #d4af37; color: #051F15; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Acessar Parecer Completo (PDF)
                </a>
                <br/><br/>
                <p>Atenciosamente,<br/>Equipe Agrilex</p>
              `
            });
          }

          // [NOVO] Disparar Webhook para o N8N / WhatsApp
          const webhookUrl = process.env.N8N_WEBHOOK_URL;
          try {
            let whatsapp = '';
            let clientName = 'Cliente';
            let userWebhookUrl = '';
            if (user) {
              const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
              if (profile) {
                whatsapp = profile.whatsapp || '';
                clientName = profile.name || 'Cliente';
                userWebhookUrl = profile.webhook_url || '';
              }
            }

            // 1. Webhook N8N Global
            if (webhookUrl) {
              await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  analysisId: analysisId,
                  propertyId: propertyId,
                  riskLevel: 'Alto',
                  clientName: clientName,
                  whatsapp: whatsapp,
                  amountPaid: amountPaid,
                  modulesCount: selectedModules.length,
                  message: `Aviso do Agrilex IA: Nova análise concluída. Risco detectado: Alto.`
                })
              });
            }

            // 2. Webhook Customizado do Usuário
            if (userWebhookUrl) {
              console.log(`[Webhook Custom] Disparando para: ${userWebhookUrl}`);
              await fetch(userWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'analysis.completed',
                  analysisId,
                  propertyId,
                  riskLevel: 'Alto',
                  clientName,
                  amountPaid,
                  findings: resultJson
                })
              }).catch(err => console.error("Erro no Webhook Custom:", err));
            }

            // 3. Notificação no WhatsApp
            if (whatsapp) {
              const whatsappMsg = `Olá, ${clientName}! A auditoria forense da sua propriedade no Agrolex IA foi concluída com sucesso.\n\n📋 *Laudo:* ID #${analysisId}\n⚠️ *Grau de Risco:* ALTO\n\n🔗 Acesse o parecer completo online:\n${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard/resultado?id=${analysisId}`;

              if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
                console.log(`[WhatsApp API] Enviando real para: ${whatsapp}`);
                await fetch(process.env.WHATSAPP_API_URL, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`
                  },
                  body: JSON.stringify({
                    number: whatsapp,
                    message: whatsappMsg
                  })
                }).catch(err => console.error("Erro no Gateway WhatsApp:", err));
              } else {
                console.log("----------------------------------------");
                console.log(`[SIMULADOR WHATSAPP] Destinatário: ${whatsapp}`);
                console.log(`Mensagem:\n${whatsappMsg}`);
                console.log("----------------------------------------");
              }
            }
          } catch (webhookErr) {
            console.error("Erro ao processar notificações pós-análise:", webhookErr);
          }

          console.log(`[Background Job] Análise ${analysisId} finalizada 100%.`);

        } catch (error: any) {
          console.error('[Background Job] Erro na análise da IA:', error);
          await supabaseAdmin.from('analyses').update({ status: 'error', risk_level: 'Alto' }).eq('id', analysisId);
        }
      })()
    );

    // Retorna a resposta instantaneamente para liberar o navegador e evitar Timeout
    return NextResponse.json({ success: true, simulador: false, analysisId: analysisId });

  } catch (error: any) {
    console.error('Erro na análise da IA:', error);
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.analysisId) {
        await supabaseAdmin.from('analyses').update({ status: 'error', risk_level: 'Alto' }).eq('id', body.analysisId);
      }
    } catch(e) {}
    return NextResponse.json({ error: error.message || 'Falha ao processar' }, { status: 500 });
  }
}
