import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = {};
for (const line of readFileSync('.env.local','utf-8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i===-1)continue; env[t.slice(0,i).trim()]=t.slice(i+1).trim();
}
const PROD = 'https://agrolex-ia-qx32.vercel.app';
const EMAIL = 'advkelsenolavbruno@gmail.com';
const PROPERTY_ID = '67e97410-63ef-459b-8bba-671535cd0628'; // "teste" Palmas/TO
const DOCUMENT_ID = 'f073c700';

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: users } = await admin.auth.admin.listUsers();
const user = users.users.find(u => u.email === EMAIL);

const { data: docs } = await admin.from('documents').select('id, property_id, file_path').eq('property_id', PROPERTY_ID);
const doc = docs[0];
console.log('Documento:', doc.id, '| property:', doc.property_id, '|', doc.file_path?.split('/').pop());

const { data: created } = await admin.from('analyses').insert({
  user_id: user.id, property_id: doc.property_id, document_id: doc.id,
  status: 'pending', findings: { selected_modules: ['matricula_individual'] },
}).select('id').single();
console.log('Análise criada:', created.id);

const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
const { data: otpData } = await anon.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: 'email' });
const jwt = otpData.session.access_token;

const t0 = Date.now();
const res = await fetch(PROD + '/api/analyze', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ analysisId: created.id }),
});
console.log('POST HTTP', res.status, (await res.text()).slice(0, 120));

let final = null;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const { data: a } = await admin.from('analyses').select('status, findings').eq('id', created.id).single();
  console.log(`  [${i}] ${a.status} (${Math.round((Date.now()-t0)/1000)}s)`);
  if (a.status === 'completed' || a.status === 'error') { final = a; break; }
}

console.log('\n===== RESULTADO =====');
const f = final.findings || {};
console.log('Status:', final.status);
console.log('diagnostics:', JSON.stringify(f.pdf_extraction_diagnostics));
console.log('error:', f.technical_error_type, f.error_message);
const r = f.resumo || '';
console.log('Alucinação João da Silva?', /jo[ãa]o da silva/i.test(r) ? '🔴 SIM' : '✅ NÃO');
console.log('Alucinação Cidade XYZ?', /cidade xyz/i.test(r) ? '🔴 SIM' : '✅ NÃO');
console.log('Placeholder [colchetes]?', /\[[A-ZÀ-Ú][^\]]{4,}\]/.test(r) ? '🔴 SIM' : '✅ NÃO');
console.log('\n--- Resumo (700 chars) ---\n', r.slice(0, 700));
console.log('\nID da análise:', created.id);
