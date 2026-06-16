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
  const v = t.slice(i + 1).trim();
  env[k] = v;
  if (!process.env[k]) process.env[k] = v;
}

// ── Teste A: Detector de template de fabricação ──
console.log('=== TESTE A: Detector de fabricação ===');
const FABRICATION_SIGNATURES = [
  /jo[ãa]o\s+da\s+silva/i,
  /cidade\s+xyz/i,
  /comarca\s+(?:de\s+)?xyz/i,
  /bairro\s+das\s+flores/i,
  /lote\s+12,?\s*quadra\s+b/i,
];
function detectFabrication(t) {
  for (const s of FABRICATION_SIGNATURES) if (s.test(t)) return s.source;
  return null;
}
const hallucinated = `# Parecer Técnico\n## Identificação\n**Interessado:** João da Silva\n**Imóvel:** Lote 12, Quadra B, Bairro das Flores, Cidade XYZ`;
const realText = `## PARECER\n**Matrícula:** 26.839\n**Proprietário:** IDEMAR JOSÉ FERREIRA\n**Cartório:** Gurupi/TO`;
console.log('Alucinada detectada?', detectFabrication(hallucinated) ? '✅ SIM (' + detectFabrication(hallucinated) + ')' : '❌ NÃO');
console.log('Real (limpa) passou?', detectFabrication(realText) === null ? '✅ SIM' : '❌ NÃO bloqueada');

// ── Teste B: OCR resiliente via módulo compilado ──
console.log('\n=== TESTE B: OCR resiliente (módulo real) ===');
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: fileData, error } = await s.storage.from('documents')
  .download('c3ae6e12-e025-4c9b-95e9-76bc7928deff/938c3bf2-eaec-46df-b888-c273f74de502-1781568206254-9hxpyg.pdf');
if (error) { console.log('ERRO download:', error.message); process.exit(1); }
const buf = Buffer.from(await fileData.arrayBuffer());
console.log('PDF:', buf.length, 'bytes');

const { ocrWithGemini } = await import('../src/lib/pdf/ocrPreProcessor.ts');
const r = await ocrWithGemini(buf, { timeoutMs: 150000 });
console.log('OCR success:', r.success);
console.log('OCR method:', r.method);
console.log('OCR chars:', r.text.length);
console.log('OCR durationMs:', r.durationMs);
console.log('Contém 26839:', /26\.?839/.test(r.text));
console.log('Contém IDEMAR:', /idemar/i.test(r.text));
console.log('Contém fabricação?', detectFabrication(r.text) ? '🔴 SIM' : '✅ NÃO');
