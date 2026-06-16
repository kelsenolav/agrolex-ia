import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  env[k] = t.slice(i + 1).trim();
  if (!process.env[k]) process.env[k] = env[k];
}

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Os arquivos que FALHARAM em produção (das análises aa05120a e 060db2bf)
const failingFiles = [
  'c3ae6e12-e025-4c9b-95e9-76bc7928deff/67e97410-63ef-459b-8bba-671535cd0628-1781322405379-uqutj.pdf',
];
// O arquivo que FUNCIONA no meu teste (para comparação)
const workingFile = 'c3ae6e12-e025-4c9b-95e9-76bc7928deff/938c3bf2-eaec-46df-b888-c273f74de502-1781568206254-9hxpyg.pdf';

const PDFParser = (await import('pdf2json')).default;

async function inspect(path, label) {
  console.log(`\n========== ${label} ==========`);
  console.log('Path:', path.split('/').pop());
  const { data, error } = await s.storage.from('documents').download(path);
  if (error) { console.log('❌ download:', error.message); return; }
  const buf = Buffer.from(await data.arrayBuffer());
  console.log('Tamanho:', (buf.length / 1024).toFixed(1), 'KB');

  // 1. Estrutura PDF: tem camada de texto? Quantas imagens? Quantas páginas?
  const latin = buf.toString('latin1');
  const imageCount = (latin.match(/\/Subtype\s*\/Image/g) || []).length;
  const fontCount = (latin.match(/\/Font/g) || []).length;
  const pageCount = (latin.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const hasText = /\/Type\s*\/Font/.test(latin);
  console.log('Páginas (aprox):', pageCount);
  console.log('Objetos de imagem:', imageCount);
  console.log('Objetos de fonte:', fontCount, '→ tem camada de texto?', hasText ? 'SIM' : 'NÃO (provável scan)');

  // 2. pdf2json: quanto texto nativo extrai?
  try {
    const parser = new PDFParser(null, 1);
    const raw = await new Promise((res, rej) => {
      parser.on('pdfParser_dataReady', () => res(parser.getRawTextContent()));
      parser.on('pdfParser_dataError', rej);
      parser.parseBuffer(buf);
    });
    const clean = raw.replace(/----------------Page.*?----------------/g, '').trim();
    console.log('pdf2json extraiu:', clean.length, 'chars de texto nativo');
    if (clean.length < 200) console.log('  → ⚠️ POUCO TEXTO NATIVO = scan/imagem');
  } catch (e) {
    console.log('pdf2json falhou:', e.message);
  }

  // 3. OCR via Gemini (módulo real)
  const { ocrWithGemini } = await import('../src/lib/pdf/ocrPreProcessor.ts');
  const r = await ocrWithGemini(buf, { timeoutMs: 150000 });
  console.log('OCR:', r.success ? '✅ sucesso' : '❌ falhou', '|', r.text.length, 'chars |', r.durationMs + 'ms', '| confiança:', r.confidence);
  if (r.error) console.log('  OCR erro:', r.error);
  console.log('  Contém 26839?', /26\.?839/.test(r.text), '| IDEMAR?', /idemar/i.test(r.text));
  if (r.text.length > 0) console.log('  Preview:', r.text.slice(0, 200).replace(/\n/g, ' '));
}

await inspect(failingFiles[0], 'FALHOU EM PRODUÇÃO #1 (aa05120a)');
await inspect(failingFiles[1], 'FALHOU EM PRODUÇÃO #2 (060db2bf)');
await inspect(workingFile, 'FUNCIONA NO MEU TESTE (comparação)');
