import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = {};
for (const line of readFileSync('.env.local','utf-8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i===-1)continue; env[t.slice(0,i).trim()]=t.slice(i+1).trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: users } = await admin.auth.admin.listUsers();
const user = users.users.find(u => u.email === 'advkelsenolavbruno@gmail.com');

const { data: a } = await admin.from('analyses')
  .select('*').eq('user_id', user.id).order('created_at',{ascending:false}).limit(1).single();
console.log('Colunas analyses:', Object.keys(a).join(', '));
console.log('property_id:', a.property_id, '| document_id:', a.document_id);

// Documento da matrícula 26839
const { data: docs } = await admin.from('documents')
  .select('id, property_id, file_path, document_type')
  .eq('id', a.document_id).maybeSingle();
console.log('Doc da última análise:', JSON.stringify(docs));
