import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env={};
for (const l of readFileSync('.env.local','utf-8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;env[t.slice(0,i).trim()]=t.slice(i+1).trim();}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data:a }=await admin.from('analyses').select('findings').eq('id','eb362716-2401-4334-9c1a-499dbfe1e189').single();
const resumo=a.findings.resumo;
function parseMarkdown(md){
  if(!md) return '';
  return md
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/^#### (.*)$/gm,'<h4>$1</h4>')
    .replace(/^### (.*)$/gm,'<h3>$1</h3>')
    .replace(/^## (.*)$/gm,'<h2>$1</h2>')
    .replace(/^# (.*)$/gm,'<h2>$1</h2>')
    .replace(/\n\* (.*?)/g,'<br/>• $1')
    .replace(/\n1\. (.*?)/g,'<br/>1. $1')
    .replace(/\n\n/g,'<br/><br/>')
    .replace(/---/g,'<hr/>')
    .replace(/(^|<br\/>)\s*#{1,6}\s+/g,'$1');
}
const t0=Date.now();
const out=parseMarkdown(resumo);
console.log('parseMarkdown OK em', Date.now()-t0,'ms | output', out.length,'chars');
console.log('Tem # cru?', /#/.test(out)?'SIM':'NÃO');
console.log(out.slice(0,300));
