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

// Listar documentos distintos do usuário (via properties do usuário)
const { data: props } = await admin.from('properties').select('id, name, city, state').eq('user_id', user.id).order('created_at',{ascending:false}).limit(30);
console.log('Propriedades:', props?.length);
for (const p of (props||[])) {
  const { data: docs } = await admin.from('documents').select('id, file_path, document_type').eq('property_id', p.id);
  for (const d of (docs||[])) {
    console.log(`prop=${p.id.slice(0,8)} "${p.name||''}" ${p.city||''}/${p.state||''} | doc=${d.id.slice(0,8)} ${d.document_type} ${d.file_path?.split('/').pop()}`);
  }
}
