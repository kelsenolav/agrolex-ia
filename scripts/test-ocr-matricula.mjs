#!/usr/bin/env node
/**
 * Teste interno do pipeline OCR com matrícula real.
 *
 * Busca a análise "poliana" ou "Polyana2" do usuário advkelsenolavbruno@gmail.com,
 * baixa o PDF da matrícula e testa o pipeline OCR dedicado.
 *
 * Uso: node scripts/test-ocr-matricula.mjs
 *
 * Requisitos:
 * - .env.local com NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e GEMINI_API_KEY
 * - Servidor Next.js NÃO precisa estar rodando (teste direto via SDK)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Carregar .env.local manualmente
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch (e) {
  console.error('⚠️  Não foi possível ler .env.local:', e.message);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TARGET_EMAIL = 'advkelsenolavbruno@gmail.com';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  TESTE OCR — Matrícula da análise Poliana/Polyana2         ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log();

// ── Validações ──────────────────────────────────────────────────────────────

if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL não encontrada'); process.exit(1); }
if (!SERVICE_ROLE_KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada'); process.exit(1); }
if (!GEMINI_API_KEY) { console.error('❌ GEMINI_API_KEY não encontrada'); process.exit(1); }

console.log(`✓ Supabase URL: ${SUPABASE_URL}`);
console.log(`✓ Service Role Key: ${SERVICE_ROLE_KEY.slice(0, 20)}...`);
console.log(`✓ Gemini API Key: ${GEMINI_API_KEY.slice(0, 10)}...`);
console.log();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Etapa 1: Buscar usuário ─────────────────────────────────────────────────

console.log('─── ETAPA 1: Buscando usuário...');
const { data: users } = await supabase.auth.admin.listUsers();
const user = users?.users?.find(u => u.email === TARGET_EMAIL);
if (!user) { console.error(`❌ Usuário ${TARGET_EMAIL} não encontrado`); process.exit(1); }
console.log(`✓ Usuário encontrado: ${user.id}`);

// ── Etapa 2: Buscar análises do usuário ─────────────────────────────────────

console.log('─── ETAPA 2: Buscando análises...');
const { data: analyses, error: aErr } = await supabase
  .from('analyses')
  .select('id, name, status, property_id, findings')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(10);

if (aErr) { console.error('❌ Erro ao buscar análises:', aErr.message); process.exit(1); }
console.log(`✓ ${analyses.length} análises encontradas:`);
for (const a of analyses) {
  console.log(`  - "${a.name}" (status: ${a.status}, id: ${a.id.slice(0, 8)}...)`);
}

// Buscar a análise poliana/polyana
const target = analyses.find(a =>
  a.name?.toLowerCase().includes('poliana') ||
  a.name?.toLowerCase().includes('polyana')
);
if (!target) {
  console.log('\n⚠️  Nenhuma análise "poliana/polyana" encontrada. Usando a mais recente.');
}
const analysis = target || analyses[0];
console.log(`\n✓ Análise selecionada: "${analysis.name}" (${analysis.id.slice(0, 8)}...)`);

// ── Etapa 3: Buscar documentos da análise ───────────────────────────────────

console.log('─── ETAPA 3: Buscando documentos...');
const { data: documents, error: dErr } = await supabase
  .from('documents')
  .select('id, file_path, document_type, file_size')
  .eq('property_id', analysis.property_id);

if (dErr) { console.error('❌ Erro ao buscar documentos:', dErr.message); process.exit(1); }
console.log(`✓ ${documents.length} documento(s) encontrado(s):`);
for (const d of documents) {
  console.log(`  - ${d.document_type}: ${d.file_path} (${d.file_size ? (d.file_size / 1024).toFixed(1) + 'KB' : '?'})`);
}

// ── Etapa 4: Baixar o PDF ───────────────────────────────────────────────────

console.log('─── ETAPA 4: Baixando PDF...');
const pdfDoc = documents.find(d => d.file_path?.toLowerCase().endsWith('.pdf'));
if (!pdfDoc) { console.error('❌ Nenhum PDF encontrado nos documentos'); process.exit(1); }

const { data: fileData, error: fErr } = await supabase.storage
  .from('documents')
  .download(pdfDoc.file_path);

if (fErr || !fileData) { console.error('❌ Erro ao baixar PDF:', fErr?.message); process.exit(1); }

const buffer = Buffer.from(await fileData.arrayBuffer());
console.log(`✓ PDF baixado: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`);

// ── Etapa 5: Teste de extração de texto nativa (pdf2json) ───────────────────

console.log('─── ETAPA 5: Testando extração de texto nativa (pdf2json)...');
try {
  const PDFParser = (await import('pdf2json')).default;
  const parser = new PDFParser(null, 1);

  const rawText = await new Promise((resolve, reject) => {
    parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()));
    parser.on('pdfParser_dataError', (err) => reject(err));
    parser.parseBuffer(buffer);
  });

  const charCount = rawText.length;
  console.log(`✓ pdf2json extraiu ${charCount} caracteres`);
  if (charCount < 100) {
    console.log('⚠️  Texto insuficiente — PDF provavelmente é escaneado');
  } else {
    console.log(`  Preview (500 chars): ${rawText.slice(0, 500).replace(/\n/g, '\\n')}`);
  }
} catch (e) {
  console.log(`⚠️  pdf2json falhou: ${e.message}`);
}

// ── Etapa 6: Teste OCR dedicado com Gemini ──────────────────────────────────

console.log('─── ETAPA 6: Testando OCR dedicado com Gemini...');
const startOcr = Date.now();

const { GoogleGenerativeAI } = await import('@google/generative-ai');
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  generationConfig: { temperature: 0, maxOutputTokens: 16384 },
});

const OCR_PROMPT = `Você é um sistema de OCR especializado em documentos imobiliários brasileiros.

TAREFA: Transcreva INTEGRALMENTE o conteúdo deste documento PDF, preservando:
- Todos os números de matrícula, registro e averbação (R-1, AV-2, etc.)
- Todos os nomes de pessoas (proprietários, cônjuges, transmitentes, adquirentes)
- Todos os CPFs, CNPJs e números de documentos
- Todas as datas, áreas, valores monetários
- Números de CCIR, CAR, ITR, SIGEF
- Descrições de confrontações e limites
- Estrutura do documento (cabeçalhos, seções, atos registrais)

REGRAS:
1. Transcreva EXATAMENTE o que está escrito — não interprete, não resuma, não analise.
2. Se uma palavra estiver ilegível, marque como [ILEGÍVEL].
3. Se um número estiver parcialmente legível, marque o restante como [?].
4. Separe páginas com "--- PÁGINA X ---".
5. NÃO invente dados.

RESPONDA APENAS COM A TRANSCRIÇÃO.`;

try {
  const base64Data = buffer.toString('base64');
  const result = await model.generateContent([
    { text: OCR_PROMPT },
    { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
  ]);

  const response = await result.response;
  const ocrText = response.text();
  const ocrMs = Date.now() - startOcr;

  console.log(`✓ OCR Gemini: ${ocrText.length} caracteres em ${ocrMs}ms`);

  // Verificar conteúdo esperado da Matrícula 26.839
  const checks = [
    { label: 'Número da matrícula (26.839 ou 26839)', test: /26\.?839/ },
    { label: 'Cidade (Gurupi)', test: /[Gg]urupi/ },
    { label: 'Estado (TO/Tocantins)', test: /\bTO\b|[Tt]ocantins/ },
    { label: 'Proprietário (IDEMAR)', test: /[Ii][Dd][Ee][Mm][Aa][Rr]/ },
    { label: 'CPF (171.311.896-34)', test: /171\.?311\.?896/ },
    { label: 'Área (27)', test: /27[.,]?\d*\s*(ha|hect)/ },
    { label: 'AV-1 (averbação)', test: /AV-?1|[Aa]v[.-]?\s*1/ },
    { label: 'AV-2 (averbação)', test: /AV-?2|[Aa]v[.-]?\s*2/ },
  ];

  console.log('\n─── VALIDAÇÃO DE CONTEÚDO ───');
  let passed = 0;
  for (const check of checks) {
    const found = check.test.test(ocrText);
    console.log(`  ${found ? '✅' : '❌'} ${check.label}`);
    if (found) passed++;
  }
  console.log(`\n  Resultado: ${passed}/${checks.length} verificações passaram`);

  if (passed >= 5) {
    console.log('  🟢 OCR FUNCIONOU — a matrícula foi lida corretamente!');
  } else if (passed >= 3) {
    console.log('  🟡 OCR PARCIAL — alguns dados foram lidos');
  } else {
    console.log('  🔴 OCR FALHOU — a matrícula NÃO foi lida corretamente');
  }

  // Imprimir preview
  console.log('\n─── PREVIEW DO OCR (primeiros 2000 chars) ───');
  console.log(ocrText.slice(0, 2000));
  console.log('\n─── FIM DO PREVIEW ───');

} catch (e) {
  console.error(`❌ OCR falhou: ${e.message}`);
}

console.log('\n✓ Teste concluído.');
