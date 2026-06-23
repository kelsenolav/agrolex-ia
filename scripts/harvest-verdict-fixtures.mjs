// Harvest read-only: colhe análises de produção como fixtures de CARACTERIZAÇÃO
// para o Proof Engine (Camada A). NÃO escreve em produção — apenas SELECT.
// Pula casos sem dados reconstruíveis, logando o motivo (sem corte silencioso).
//
// Uso: node scripts/harvest-verdict-fixtures.mjs [limit]
//
// Importante: só colhe análises com isf_version=22 (motor atual) para que o
// veredito persistido coincida com computeISFVerdict. Fixtures divergentes
// (análises anteriores ao motor atual) devem ser podadas após rodar o runner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'lib', 'isf', '__fixtures__', 'verdict');

function parseEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  const txt = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = parseEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const LIMIT = Number(process.argv[2] || 25);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

function reconstructInput(findings) {
  const v22 = findings?.isf_v2_2;
  if (!v22 || typeof v22.isf_score !== 'number') return { skip: 'sem isf_v2_2 persistido' };
  const mij = findings?.matricula_individual_json;
  const dims = mij?.isf_dimensoes && typeof mij.isf_dimensoes === 'object' ? mij.isf_dimensoes : null;
  const problemas = Array.isArray(findings?.problemas) ? findings.problemas : [];
  if (!dims && problemas.length === 0) return { skip: 'sem dimensões nem problemas reconstruíveis' };
  const diag = findings?.pdf_extraction_diagnostics || {};
  const modules = Array.isArray(findings?.selected_modules) ? findings.selected_modules : [];
  const input = {
    isfDimensoesFromAI: dims || null,
    parsedProblemas: problemas,
    ocrIncomplete: !!diag.ocr_incomplete,
    ocrPages: diag.ocr_pages || null,
    ehMatriculaModule: modules.includes('matricula_individual') || modules.includes('cadeia_dominial'),
    atosCount: mij && Array.isArray(mij.atos_registrais) ? mij.atos_registrais.length : null,
    proprietarioNome: mij?.proprietario_atual?.nome ?? null,
    cadeiaNaoAuditada: !!findings?.cadeiaNaoAuditada,
    riskLevel: findings?.risk_level || findings?.riskLevel || 'Baixo',
  };
  const expected = {
    isf_score: v22.isf_score,
    faixa: v22.faixa,
    travas_includes: Array.isArray(v22.travas_aplicadas)
      ? v22.travas_aplicadas.map((t) => String(t).split(':')[0].trim()).filter(Boolean).slice(0, 3)
      : [],
  };
  return { input, expected };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const url =
    `${SUPABASE_URL}/rest/v1/analyses` +
    `?status=eq.completed&isf_version=eq.22` +
    `&select=id,findings,isf_version,status&order=created_at.desc&limit=${LIMIT}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    console.error(`Supabase HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const rows = await res.json();
  console.log(`Análises retornadas (completed, isf_version=22): ${rows.length}`);
  let written = 0;
  const skipped = [];
  for (const row of rows) {
    const r = reconstructInput(row.findings);
    if (r.skip) {
      skipped.push(`${row.id}: ${r.skip}`);
      continue;
    }
    const id = `prod-${String(row.id).slice(0, 8)}`;
    const fixture = {
      id,
      source: `prod:${row.id}`,
      label: 'characterization',
      note: 'Colhida automaticamente de produção (read-only).',
      input: r.input,
      expected: r.expected,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(fixture, null, 2) + '\n');
    written++;
  }
  console.log(`Fixtures escritas: ${written}`);
  if (skipped.length) {
    console.log(`Puladas (${skipped.length}):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
  console.log(
    '\nAgora rode: npx jest src/lib/isf/__tests__/isfVerdict.fixtures.test.ts\n' +
      'Fixtures que falharem são análises divergentes do motor atual — pode podá-las.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
