import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env={};
for (const l of readFileSync('.env.local','utf-8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;env[t.slice(0,i).trim()]=t.slice(i+1).trim();}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data:a }=await admin.from('analyses').select('findings').eq('id','eb362716-2401-4334-9c1a-499dbfe1e189').single();
const f=a.findings||{};
const full=JSON.stringify(f);
console.log('findings TOTAL size:', full.length, 'chars (~', (full.length/1024).toFixed(0),'KB)');
// Tamanho de cada chave
const sizes=Object.keys(f).map(k=>[k, JSON.stringify(f[k]??null).length]).sort((a,b)=>b[1]-a[1]);
console.log('--- top 10 maiores campos ---');
for(const [k,s] of sizes.slice(0,10)) console.log(`  ${k}: ${s} chars`);
// Checar campos que a página usa para arrays/objetos
console.log('--- shapes ---');
console.log('achados:', Array.isArray(f.achados)?`array(${f.achados.length})`:typeof f.achados);
console.log('problemas:', Array.isArray(f.problemas)?`array(${f.problemas.length})`:typeof f.problemas);
console.log('linhaDoTempo:', Array.isArray(f.linhaDoTempo)?`array(${f.linhaDoTempo.length})`:typeof f.linhaDoTempo);
console.log('matricula_rules:', typeof f.matricula_rules, Array.isArray(f.matricula_rules)?`len ${f.matricula_rules.length}`:'');
console.log('isf_v2_2 keys:', f.isf_v2_2?Object.keys(f.isf_v2_2).join(','):'undefined');
console.log('score_comparison:', JSON.stringify(f.score_comparison)?.slice(0,200));
