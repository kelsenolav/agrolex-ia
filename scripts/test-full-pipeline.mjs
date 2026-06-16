#!/usr/bin/env node
/**
 * Teste completo do pipeline OCR → Análise com matrícula real.
 * Simula exatamente o que acontece em produção.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Carregar .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { GoogleGenerativeAI } = await import('@google/generative-ai');
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

async function callWithRetry(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); }
    catch (e) {
      if (e.status === 503 && i < maxRetries - 1) {
        const wait = (i + 1) * 10;
        console.log(`  503 - retry em ${wait}s (${i + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, wait * 1000));
      } else throw e;
    }
  }
}

// 1. Baixar PDF
console.log('=== ETAPA 1: Baixando PDF ===');
const { data: fileData, error } = await s.storage.from('documents')
  .download('c3ae6e12-e025-4c9b-95e9-76bc7928deff/938c3bf2-eaec-46df-b888-c273f74de502-1781568206254-9hxpyg.pdf');
if (error) { console.log('ERRO:', error.message); process.exit(1); }
const buf = Buffer.from(await fileData.arrayBuffer());
console.log('PDF:', buf.length, 'bytes');

// 2. OCR dedicado
console.log('\n=== ETAPA 2: OCR Dedicado ===');
const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';
console.log('Modelo:', modelName);
const ocrModel = genAI.getGenerativeModel({
  model: modelName,
  generationConfig: { temperature: 0, maxOutputTokens: 16384 },
});

const OCR_PROMPT = 'Você é um sistema de OCR especializado em documentos imobiliários brasileiros. Transcreva INTEGRALMENTE o conteúdo deste PDF, preservando todos os números, nomes, datas, CPFs, áreas e atos registrais. Transcreva EXATAMENTE o que está escrito. Se algo estiver ilegível, marque [ILEGÍVEL]. NÃO invente dados. Separe páginas com --- PÁGINA X ---. RESPONDA APENAS COM A TRANSCRIÇÃO.';

const base64 = buf.toString('base64');
const ocrStart = Date.now();
const ocrResult = await callWithRetry(() => ocrModel.generateContent([
  { text: OCR_PROMPT },
  { inlineData: { data: base64, mimeType: 'application/pdf' } },
]));
const ocrText = (await ocrResult.response).text();
const ocrMs = Date.now() - ocrStart;
console.log(`OCR: ${ocrText.length} chars em ${ocrMs}ms`);
console.log('Contém 26839:', /26\.?839/.test(ocrText));
console.log('Contém IDEMAR:', /idemar/i.test(ocrText));

// 3. Análise jurídica sobre texto transcrito
console.log('\n=== ETAPA 3: Análise Jurídica (texto transcrito, SEM PDF) ===');
const analysisModel = genAI.getGenerativeModel({
  model: modelName,
  generationConfig: { temperature: 0, maxOutputTokens: 8192 },
});

const ANALYSIS_PROMPT = `Você é um Perito Forense Fundiário Sênior especializado em análise de matrículas imobiliárias rurais.
Analise o texto da matrícula transcrito abaixo e produza análise objetiva no formato JSON.

PROIBIÇÃO ABSOLUTA DE FABRICAÇÃO DE DADOS
NUNCA invente números de matrícula, nomes de proprietários, áreas ou atos registrais que não constem no texto abaixo.

Sua resposta DEVE ser EXCLUSIVAMENTE um objeto JSON válido com esta estrutura:
{
  "identificacao": { "numero_matricula": "", "cartorio": "", "imovel": "", "area_numerica": "", "localizacao": "" },
  "proprietario_atual": { "nome": "", "conjuge": "" },
  "atos_registrais": [{ "ato": "", "tipo": "", "data": "", "partes": "", "observacao": "" }],
  "onus_restricoes": [{ "tipo": "", "descricao": "", "situacao": "" }],
  "achados": [{ "titulo": "", "risco": "", "descricao": "" }],
  "classificacao_risco": { "nivel": "", "justificativa": "" },
  "parecer_markdown": "parecer técnico completo em português"
}

TEXTO DA MATRÍCULA TRANSCRITO:
${ocrText}`;

const analysisStart = Date.now();
const analysisResult = await callWithRetry(() => analysisModel.generateContent([{ text: ANALYSIS_PROMPT }]));
const analysisText = (await analysisResult.response).text();
const analysisMs = Date.now() - analysisStart;
console.log(`Análise: ${analysisText.length} chars em ${analysisMs}ms`);

// 4. Validação
console.log('\n=== ETAPA 4: Validação ===');
const hasReal26839 = /26\.?839/.test(analysisText);
const hasRealIdemar = /idemar/i.test(analysisText);
const hasRealGurupi = /gurupi/i.test(analysisText);
const hasHallucinationJoao = /jo[aã]o da silva/i.test(analysisText);
const hasHallucinationXYZ = /cidade xyz/i.test(analysisText);

console.log('✅/❌ Dados REAIS:');
console.log(`  ${hasReal26839 ? '✅' : '❌'} Matrícula 26.839`);
console.log(`  ${hasRealIdemar ? '✅' : '❌'} Proprietário IDEMAR`);
console.log(`  ${hasRealGurupi ? '✅' : '❌'} Cidade Gurupi`);
console.log('❌ Dados FABRICADOS (devem ser ❌):');
console.log(`  ${hasHallucinationJoao ? '🔴 HALLUCINATION!' : '❌ OK'} João da Silva`);
console.log(`  ${hasHallucinationXYZ ? '🔴 HALLUCINATION!' : '❌ OK'} Cidade XYZ`);

// Parsear JSON
try {
  let jsonStr = analysisText.trim();
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonStr);
  console.log('\n=== RESULTADO FINAL ===');
  console.log('Matrícula:', parsed.identificacao?.numero_matricula);
  console.log('Proprietário:', parsed.proprietario_atual?.nome);
  console.log('Cartório:', parsed.identificacao?.cartorio);
  console.log('Área:', parsed.identificacao?.area_numerica);
  console.log('Localização:', parsed.identificacao?.localizacao);
  console.log('Atos registrais:', parsed.atos_registrais?.length);
  console.log('Achados:', parsed.achados?.length);
  console.log('Risco:', parsed.classificacao_risco?.nivel);
  console.log('\nParecer (500 chars):', parsed.parecer_markdown?.slice(0, 500));
} catch (e) {
  console.log('Erro ao parsear JSON:', e.message);
  console.log('Preview:', analysisText.slice(0, 1000));
}

console.log(`\n=== TEMPOS ===`);
console.log(`OCR: ${ocrMs}ms | Análise: ${analysisMs}ms | Total: ${ocrMs + analysisMs}ms`);
