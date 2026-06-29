// Observabilidade da cascata de IA (sub-bloco 1.5) — PREFLIGHT AO VIVO.
// Faz uma chamada mínima (poucos tokens) a CADA provedor configurado e reporta
// OK / FALHA + motivo. É o cheque que pega "credit balance too low" do Claude
// ANTES de um apagão — transformando a falha silenciosa em sinal explícito.
//
// Uso: node scripts/ai-cascade-preflight.mjs
// Custo: ~1 token por provedor. Não toca em produção (só chama as APIs de IA).
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
const short = (s) => String(s).replace(/https?:\/\/\S+/gi, '[url]').replace(/\s+/g, ' ').slice(0, 180);

async function checkGemini() {
  const key = env.GEMINI_API_KEY;
  if (!key) return { skip: true };
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash'; // mesmo default do app (aiProviders.ts)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } }),
  });
  if (res.ok) return { ok: true, detail: model };
  return { ok: false, detail: `HTTP ${res.status}: ${short(await res.text())}` };
}

async function checkClaude() {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return { skip: true };
  const model = env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
  });
  if (res.ok) return { ok: true, detail: model };
  const body = short(await res.text());
  const creditFlag = /credit balance|too low|billing|purchase credits/i.test(body) ? '  ⚠️ CRÉDITO' : '';
  return { ok: false, detail: `HTTP ${res.status}: ${body}${creditFlag}` };
}

async function checkOpenAICompatible(name, base, keyName, defaultModel) {
  const key = env[keyName];
  if (!key) return { skip: true };
  const model = env[`${name.toUpperCase()}_MODEL`] || defaultModel;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
  });
  if (res.ok) return { ok: true, detail: model };
  const body = short(await res.text());
  const creditFlag = /quota|insufficient|billing|credit/i.test(body) ? '  ⚠️ CRÉDITO/QUOTA' : '';
  return { ok: false, detail: `HTTP ${res.status}: ${body}${creditFlag}` };
}

async function main() {
  console.log('\n=== Preflight da cascata de IA (chamada mínima por provedor) ===\n');
  const checks = [
    ['gemini', checkGemini()],
    ['claude', checkClaude()],
    ['openai', checkOpenAICompatible('openai', 'https://api.openai.com/v1', 'OPENAI_API_KEY', 'gpt-4o-mini')],
    ['groq', checkOpenAICompatible('groq', 'https://api.groq.com/openai/v1', 'GROQ_API_KEY', 'llama-3.3-70b-versatile')],
  ];
  const results = [];
  for (const [name, promise] of checks) {
    let r;
    try {
      r = await promise;
    } catch (e) {
      r = { ok: false, detail: short(e?.message || String(e)) };
    }
    results.push([name, r]);
    if (r.skip) console.log(`  ${name.padEnd(8)} ⏭️  sem chave configurada`);
    else if (r.ok) console.log(`  ${name.padEnd(8)} ✅ OK  (${r.detail})`);
    else console.log(`  ${name.padEnd(8)} ❌ FALHA  ${r.detail}`);
  }

  const live = results.filter(([, r]) => r.ok).map(([n]) => n);
  const dead = results.filter(([, r]) => !r.ok && !r.skip).map(([n]) => n);
  console.log('\n--- Veredito da rede de resiliência ---');
  console.log(`  Vivos: ${live.length ? live.join(', ') : 'NENHUM'}`);
  if (dead.length) console.log(`  Mortos: ${dead.join(', ')}`);
  if (live.length === 0) {
    console.log('  🔴 CRÍTICO: nenhum provedor respondendo — análises de matrícula vão falhar.');
    process.exitCode = 2;
  } else if (live.length === 1) {
    console.log('  🟠 ATENÇÃO: só 1 provedor vivo — sem rede de resiliência (um apagão dele = parada total).');
  } else {
    console.log('  ✅ Rede de resiliência intacta (múltiplos provedores vivos).');
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
