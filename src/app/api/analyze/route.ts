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
    waitUntil(
      (async () => {
        try {
          console.log(`[Background Job] Iniciando Análise IA para ID: ${analysisId}`);
          
          const { data: documents, error: docError } = await supabaseAdmin
            .from('documents')
            .select('*')
            .eq('property_id', propertyId);

          if (docError) throw new Error('Erro de permissão no Supabase: ' + JSON.stringify(docError));
          if (!documents || documents.length === 0) throw new Error('Nenhum documento encontrado.');

          let geminiParts: any[] = [];

          // Busca dados Governamentais MOCK se CPF/CNPJ ou CAR estiverem presentes
          if (cpfCnpj || carNumber) {
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
          
          for (const doc of documents) {
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from('documents')
              .download(doc.file_path);
              
            if (downloadError || !fileData) continue;
            
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

          if (geminiParts.length === 0) {
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
    
    instructions += `\nINSTRUÇÃO FINAL: Leia minuciosamente os documentos PDFs anexados com sua visão computacional avançada, extraindo as entrelinhas e as averbações manuscritas/carimbos.\n\nAGORA, GERE O PARECER FORENSE COMPLETAMENTE ESTRUTURADO EM MARKDOWN:`;

    geminiParts.unshift({ text: instructions });

    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent(geminiParts);
    const response = await result.response;
    let markdownResponse = response.text();

    // Remover delimitadores de markdown code block se a IA enviar
    if (markdownResponse.startsWith('\`\`\`markdown')) {
      markdownResponse = markdownResponse.replace(/^\`\`\`markdown\n?/, '').replace(/\n?\`\`\`$/, '');
    } else if (markdownResponse.startsWith('\`\`\`')) {
      markdownResponse = markdownResponse.replace(/^\`\`\`\n?/, '').replace(/\n?\`\`\`$/, '');
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
      modulesSelected: selectedModules
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
          if (webhookUrl) {
            try {
              let whatsapp = '';
              let clientName = 'Cliente';
              if (user) {
                const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
                if (profile) {
                  whatsapp = profile.whatsapp || '';
                  clientName = profile.name || 'Cliente';
                }
              }

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
            } catch (webhookErr) {
              console.error("Erro ao notificar N8N:", webhookErr);
            }
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
