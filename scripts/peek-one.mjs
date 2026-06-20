import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env={};
for (const l of readFileSync('.env.local','utf-8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;env[t.slice(0,i).trim()]=t.slice(i+1).trim();}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data:a, error }=await admin.from('analyses').select('id,status,risk_level,isf_score,findings').eq('id','eb362716-2401-4334-9c1a-499dbfe1e189').single();
if(error){console.log('ERRO:',error.message);process.exit(1);}
const f=a.findings||{};
console.log('status:', a.status, '| risk:', a.risk_level, '| isf:', a.isf_score);
console.log('isHtmlResumo:', f.isHtmlResumo);
console.log('resumo length:', (f.resumo||'').length);
console.log('chaves findings:', Object.keys(f).join(', '));
console.log('isf_achados type:', Array.isArray(f.isf_achados)?`array(${f.isf_achados.length})`:typeof f.isf_achados);
console.log('isf_eixos:', JSON.stringify(f.isf_eixos)?.slice(0,200));
console.log('--- resumo (primeiros 600) ---');
console.log((f.resumo||'(vazio)').slice(0,600));
console.log('--- resumo (últimos 300) ---');
console.log((f.resumo||'').slice(-300));
