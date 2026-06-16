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

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: users } = await s.auth.admin.listUsers();
const user = users?.users?.find(u => u.email === 'advkelsenolavbruno@gmail.com');
console.log('User:', user.id);

const { data: analyses } = await s
  .from('analyses')
  .select('id, status, created_at, findings')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(5);

for (const a of analyses) {
  console.log('\n=====================================');
  console.log('ID:', a.id);
  console.log('Status:', a.status);
  console.log('Created:', a.created_at);
  const f = a.findings || {};
  console.log('pdf_extraction_mode:', f.pdf_extraction_mode);
  console.log('validation_path:', f.validation_path);
  console.log('pdf_extraction_diagnostics:', JSON.stringify(f.pdf_extraction_diagnostics));
  console.log('error_type:', f.technicalErrorType || f.error_type);
  console.log('raw_ai_response_preview:', (f.raw_ai_response_preview || '').slice(0, 300));
  // Show identificacao if present
  const ident = f.identificacao || f.module_results?.matricula_individual?.identificacao;
  console.log('numero_matricula:', f.numero_matricula || ident?.numero_matricula);
  console.log('resumo:', (f.resumo || '').slice(0, 300));
}
