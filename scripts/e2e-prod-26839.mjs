import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const PROD = 'https://agrolex-ia-qx32.vercel.app';
const EMAIL = 'advkelsenolavbruno@gmail.com';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// 1. Usuário + análise que falhou (reusar property + documento + módulos)
const { data: users } = await admin.auth.admin.listUsers();
const user = users.users.find(u => u.email === EMAIL);
console.log('User:', user.id);

const { data: failed } = await admin
  .from('analyses')
  .select('id, status, property_id, findings')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(10);

// Pegar a análise mais recente para reusar property_id + document_id da 26.839
const ref = failed[0];
const { data: refFull } = await admin.from('analyses')
  .select('property_id, document_id').eq('id', ref.id).single();
console.log('Reusando property_id:', refFull.property_id, '| document_id:', refFull.document_id);

// 2. Criar análise NOVA e LIMPA (sem case_file → sem filtro de módulo pai)
const { data: created, error: createErr } = await admin.from('analyses').insert({
  user_id: user.id,
  property_id: refFull.property_id,
  document_id: refFull.document_id,
  status: 'pending',
  findings: { selected_modules: ['matricula_individual'] },
}).select('id').single();
if (createErr) { console.log('Erro ao criar análise:', createErr.message); process.exit(1); }
const target = { id: created.id };
console.log('Nova análise criada:', target.id);

// 3. Obter JWT via magic link → verifyOtp
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink', email: EMAIL,
});
if (linkErr) { console.log('Erro generateLink:', linkErr.message); process.exit(1); }
const tokenHash = linkData.properties?.hashed_token;
const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
  token_hash: tokenHash, type: 'email',
});
if (otpErr) { console.log('Erro verifyOtp:', otpErr.message); process.exit(1); }
const jwt = otpData.session.access_token;
console.log('JWT obtido:', jwt.slice(0, 20) + '...');

// 4. POST produção /api/analyze
console.log('\n=== POST', PROD + '/api/analyze ===');
const t0 = Date.now();
const res = await fetch(PROD + '/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ analysisId: target.id }),
});
console.log('HTTP', res.status, '|', (await res.text()).slice(0, 200));

// 5. Polling do resultado no banco
console.log('\n=== Polling resultado ===');
let final = null;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const { data: a } = await admin
    .from('analyses')
    .select('status, findings')
    .eq('id', target.id).single();
  const st = a.status;
  process.stdout.write(`  [${i}] ${st} (${Math.round((Date.now()-t0)/1000)}s)\n`);
  if (st === 'completed' || st === 'error') { final = a; break; }
}

// 6. Resultado
console.log('\n========== RESULTADO FINAL ==========');
if (!final) { console.log('Timeout no polling (>5min)'); process.exit(1); }
const f = final.findings || {};
console.log('Status:', final.status);
console.log('pdf_extraction_mode:', f.pdf_extraction_mode);
console.log('validation_path:', f.validation_path);
console.log('diagnostics:', JSON.stringify(f.pdf_extraction_diagnostics));
console.log('error_type:', f.technical_error_type || f.technicalErrorType);
const resumo = f.resumo || '';
console.log('\n--- Dados extraídos ---');
console.log('Contém 26.839?', /26\.?839/.test(resumo) ? '✅' : '❌');
console.log('Contém IDEMAR?', /idemar/i.test(resumo) ? '✅' : '❌');
console.log('Contém Gurupi?', /gurupi/i.test(resumo) ? '✅' : '❌');
console.log('ALUCINAÇÃO João da Silva?', /jo[ãa]o da silva/i.test(resumo) ? '🔴 SIM' : '✅ NÃO');
console.log('ALUCINAÇÃO Cidade XYZ?', /cidade xyz/i.test(resumo) ? '🔴 SIM' : '✅ NÃO');
console.log('\n--- Resumo (600 chars) ---');
console.log(resumo.slice(0, 600));
