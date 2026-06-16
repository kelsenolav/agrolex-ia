import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = {};
for (const line of readFileSync('.env.local','utf-8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i===-1)continue; env[t.slice(0,i).trim()]=t.slice(i+1).trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const ids = [
  '02d7aa76-aa19-434f-92d3-53e0fdb50e5d','8813463b-7508-446c-865b-37b257415832',
  '4b025d0f-9623-4837-bf7e-bcb95f68af95','4df888dc-fd8d-4f65-b609-573542681555',
  'e082a21c-60ae-4044-8e68-2df8d0b50a56','e80b368c-97c2-4830-907a-6d0751e61f99',
];
for (const id of ids) await admin.from('analyses').delete().eq('id', id);
console.log('Análises de teste removidas:', ids.length);
