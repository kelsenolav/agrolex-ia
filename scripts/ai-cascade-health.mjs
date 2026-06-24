// Observabilidade da cascata de IA (sub-bloco 1.5) — saúde por TRÁFEGO REAL.
// Read-only: lê análises recentes de produção e agrega o desempenho provedor-a-
// provedor (Gemini→Claude→OpenAI→Groq). Responde "a rede de fallback está intacta
// ou algum provedor está caindo/sem crédito em silêncio?" sem gastar chamadas de IA.
//
// Uso: node scripts/ai-cascade-health.mjs [limit]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseEnvLocal() {
  const txt = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
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
const LIMIT = Number(process.argv[2] || 100);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const PROVIDERS = ['gemini', 'claude', 'openai', 'groq'];

async function main() {
  const url =
    `${SUPABASE_URL}/rest/v1/analyses` +
    `?select=id,status,findings,created_at&order=created_at.desc&limit=${LIMIT}`;
  const res = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  if (!res.ok) {
    console.error(`Supabase HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const rows = await res.json();

  const winner = {};        // provedor → quantas vezes foi o vencedor
  const attempts = {};      // provedor → { ok, fail }
  const failReasons = {};   // motivo (1ª palavra) → contagem
  let withCascade = 0;
  let fallbackCount = 0;
  for (const p of PROVIDERS) {
    winner[p] = 0;
    attempts[p] = { ok: 0, fail: 0 };
  }

  for (const row of rows) {
    const f = row.findings || {};
    const c = f.ai_cascade || null;
    const providerUsed = c?.provider_used || f.provider_used;
    const fallback = c?.fallback_triggered ?? f.fallback_triggered;
    const reason = c?.fallback_reason || f.fallback_reason;
    if (providerUsed && winner[providerUsed] !== undefined) winner[providerUsed]++;
    if (fallback) fallbackCount++;
    if (reason) {
      const key = String(reason).split(/[\s:]/)[0] || 'desconhecido';
      failReasons[key] = (failReasons[key] || 0) + 1;
    }
    if (Array.isArray(c?.attempts) && c.attempts.length) {
      withCascade++;
      for (const a of c.attempts) {
        if (attempts[a.provider]) attempts[a.provider][a.success ? 'ok' : 'fail']++;
      }
    }
  }

  console.log(`\n=== Saúde da cascata de IA — últimas ${rows.length} análises ===\n`);
  console.log(`Análises com log detalhado (ai_cascade): ${withCascade}`);
  console.log(`Análises com fallback acionado: ${fallbackCount}\n`);

  console.log('Vencedor da cascata (quem efetivamente respondeu):');
  for (const p of PROVIDERS) console.log(`  ${p.padEnd(8)} ${winner[p]}`);

  console.log('\nTentativas por provedor (do log detalhado):');
  for (const p of PROVIDERS) {
    const a = attempts[p];
    const total = a.ok + a.fail;
    const rate = total ? Math.round((a.ok / total) * 100) : null;
    console.log(`  ${p.padEnd(8)} ok=${a.ok} fail=${a.fail}` + (rate !== null ? `  (${rate}% sucesso)` : '  (sem dados)'));
  }

  if (Object.keys(failReasons).length) {
    console.log('\nMotivos de fallback (top):');
    for (const [k, v] of Object.entries(failReasons).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`  ${String(k).padEnd(18)} ${v}`);
    }
  }

  // Veredito heurístico de saúde da rede de resiliência.
  const claudeFails = attempts.claude.fail;
  const claudeOk = attempts.claude.ok;
  console.log('\n--- Veredito ---');
  if (claudeFails > 0 && claudeOk === 0) {
    console.log('⚠️  Claude SÓ FALHOU nas tentativas registradas — possível crédito esgotado/chave inválida.');
    console.log('    A rede de resiliência pode estar comprometida. Rode o preflight: node scripts/ai-cascade-preflight.mjs');
  } else if (fallbackCount > rows.length * 0.3) {
    console.log('⚠️  Fallback acionado em >30% das análises — provedor primário (Gemini) instável.');
  } else {
    console.log('✅ Sem sinal forte de degradação no tráfego recente.');
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
