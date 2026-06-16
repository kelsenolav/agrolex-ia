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
await admin.from('analyses').delete().eq('id','3562878a-a41c-4914-b791-1489a042b757');
const { data: ok } = await admin.from('analyses')
  .select('id, status, created_at').eq('user_id', user.id).eq('status','completed')
  .order('created_at',{ascending:false}).limit(1).single();
console.log('Análise de erro de teste removida.');
console.log('Análise concluída (prova) no painel:', ok.id);
