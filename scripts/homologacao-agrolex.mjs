import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = {};
for (const l of readFileSync('.env.local', 'utf-8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i === -1) continue; env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const PROD = 'https://agrolex-ia-qx32.vercel.app';
const EMAIL = 'advkelsenolavbruno@gmail.com';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const CASOS = [
  { nome: '26.839 (Gurupi/TO)', property_id: '9da7d867-efe8-4f7f-b639-416de9cf5ae0', document_id: 'afafd1a2-82b1-4cfc-a09a-5af91688abdf', espera: ['26839', 'idemar', 'gurupi'] },
  { nome: '27.180 (Porto Nacional/TO)', property_id: '67e97410-63ef-459b-8bba-671535cd0628', document_id: 'f073c700-6f01-4665-a034-b5d9ade8d64f', espera: ['27180', 'porto nacional'] },
];

async function jwt() {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  const { data: otp } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' });
  return otp.session.access_token;
}
const { data: users } = await admin.auth.admin.listUsers();
const user = users.users.find(u => u.email === EMAIL);

function check(txt, re) { return re.test(txt) ? '✅' : '❌'; }

for (const caso of CASOS) {
  console.log('\n══════════════════════════════════════════════');
  console.log('CASO:', caso.nome);
  console.log('══════════════════════════════════════════════');
  // análise nova e limpa
  const { data: created, error: ce } = await admin.from('analyses').insert({
    user_id: user.id, property_id: caso.property_id, document_id: caso.document_id,
    status: 'pending', findings: { selected_modules: ['matricula_individual'] },
  }).select('id').single();
  if (ce) { console.log('ERRO criar análise:', ce.message); continue; }
  const id = created.id;
  const token = await jwt();
  const t0 = Date.now();
  const res = await fetch(PROD + '/api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ analysisId: id }),
  });
  console.log('POST /api/analyze →', res.status);
  let final = null;
  for (let k = 0; k < 80; k++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: a } = await admin.from('analyses').select('status, risk_level, isf_score, findings').eq('id', id).single();
    if (a.status === 'completed' || a.status === 'error') { final = a; break; }
    if (k % 4 === 0) process.stdout.write(`  …${a.status} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  if (!final) { console.log(`⏱️ TIMEOUT (>${secs}s)`); continue; }
  const f = final.findings || {};
  const resumo = String(f.resumo || '');
  const diag = f.pdf_extraction_diagnostics || {};
  console.log(`\n  STATUS: ${final.status}  |  TEMPO: ${secs}s`);
  console.log(`  Pipeline: ${f.pdf_extraction_mode} | OCR sucesso=${diag.markdown_success} binário=${diag.binary_fallback} (${diag.extraction_total_ms}ms)`);
  console.log(`  validation_path: ${f.validation_path} | erro: ${f.technical_error_type || '—'}`);
  if (final.status === 'completed') {
    console.log(`\n  --- DADOS REAIS (anti-alucinação) ---`);
    for (const e of caso.espera) console.log(`    ${check(resumo, new RegExp(e, 'i'))} contém "${e}"`);
    console.log(`    ${/jo[ãa]o da silva|cidade xyz|bairro das flores|matr[ií]cula.*12345/i.test(resumo) ? '🔴 ALUCINAÇÃO' : '✅ sem alucinação'}`);
    console.log(`    ${/(^|\n)#{1,6}\s|\*\*/.test(resumo) ? '🔴 Markdown cru no laudo' : '✅ sem markdown cru'}`);
    console.log(`\n  --- ISF / RISCO ---`);
    console.log(`    Score: ${final.isf_score} | Risco: ${final.risk_level} | isf_eixos: ${final.findings ? (f.isf_v2_2 ? 'v2.2' : '?') : ''} (coluna: ver abaixo)`);
    console.log(`\n  --- ESTRUTURA (shapes corrigidos) ---`);
    const arrType = (x) => Array.isArray(x) ? `array(${x.length})${x.length ? ' tipo[0]=' + typeof x[0] : ''}` : typeof x;
    console.log(`    problemas: ${arrType(f.problemas)} | achados: ${arrType(f.achados)}`);
    console.log(`    documentosFaltantes: ${arrType(f.documentosFaltantes)} | recomendacoes: ${arrType(f.recomendacoes)}`);
    console.log(`\n  --- RESUMO (300 chars) ---`);
    console.log('   ', resumo.slice(0, 300).replace(/\n/g, '\n    '));
    console.log(`\n  🔗 Ver dossiê: ${PROD}/dashboard/resultado?id=${id}`);
  } else {
    console.log(`  resumo/erro preview: ${(f.error_message || resumo).slice(0, 200)}`);
    console.log(`  🔗 ${PROD}/dashboard/resultado?id=${id}`);
  }
}
console.log('\n══════════════════════════════════════════════');
console.log('Homologação concluída. As análises ficam salvas para você abrir no painel.');
