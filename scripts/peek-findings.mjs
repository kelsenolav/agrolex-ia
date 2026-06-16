import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = {};
for (const line of readFileSync('.env.local','utf-8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i===-1)continue; env[t.slice(0,i).trim()]=t.slice(i+1).trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: a } = await admin.from('analyses')
  .select('status, findings, risk_level, isf_score').eq('id', '4b025d0f-9623-4837-bf7e-bcb95f68af95').single();
console.log('STATUS:', a.status, '| risk:', a.risk_level, '| isf:', a.isf_score);
const f = a.findings || {};
console.log('Chaves findings:', Object.keys(f).join(', '));
console.log('\ntechnical_error_type:', f.technical_error_type);
console.log('error_message:', f.error_message || f.error);
console.log('validation_path:', f.validation_path);
console.log('raw_ai_response_preview:\n', (f.raw_ai_response_preview || '(vazio)').slice(0, 1500));
console.log('\nretry_state:', JSON.stringify(f.retry_state));
console.log('retry_exhausted:', f.retry_exhausted);
