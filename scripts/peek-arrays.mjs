import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env={};
for (const l of readFileSync('.env.local','utf-8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;env[t.slice(0,i).trim()]=t.slice(i+1).trim();}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const {data}=await admin.from('analyses').select('findings').eq('id','eb362716-2401-4334-9c1a-499dbfe1e189').single();
const f=data.findings;
for(const key of ['documentosFaltantes','problemas','achados','recomendacoes','linhaDoTempo','checklist']){
  const arr=f[key];
  console.log(`\n=== ${key} (${Array.isArray(arr)?arr.length:typeof arr}) ===`);
  if(Array.isArray(arr)) arr.forEach((it,i)=>{
    console.log(`  [${i}] type=${typeof it}`, typeof it==='object'&&it!==null?`keys=[${Object.keys(it).join(',')}]`:JSON.stringify(it));
  });
}
