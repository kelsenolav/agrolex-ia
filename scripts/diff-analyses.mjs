import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env={};
for (const l of readFileSync('.env.local','utf-8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;env[t.slice(0,i).trim()]=t.slice(i+1).trim();}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function get(id){ const {data}=await admin.from('analyses').select('findings, isf_eixos, isf_achados, isf_version, risk_level').eq('id',id).single(); return data; }
const crash=await get('eb362716-2401-4334-9c1a-499dbfe1e189'); // trava
const ok=await get('beea6e13-e866-4f2c-9072-5f3524e58e72');     // renderizou (dossie54)
function shape(f){
  const out={};
  for(const k of Object.keys(f||{})){
    const v=f[k];
    out[k]=Array.isArray(v)?`array(${v.length})`:(v===null?'null':typeof v==='object'?`obj{${Object.keys(v).length}}`:typeof v);
  }
  return out;
}
const sc=shape(crash.findings), so=shape(ok.findings);
console.log('=== Campos SÓ na que TRAVA ===');
for(const k of Object.keys(sc)) if(!(k in so)) console.log(`  + ${k}: ${sc[k]}`);
console.log('=== Campos SÓ na que RENDERIZOU ===');
for(const k of Object.keys(so)) if(!(k in sc)) console.log(`  - ${k}: ${so[k]}`);
console.log('=== Tipo DIFERENTE no mesmo campo ===');
for(const k of Object.keys(sc)) if(k in so && sc[k]!==so[k]) console.log(`  ~ ${k}: trava=${sc[k]} vs ok=${so[k]}`);
console.log('=== colunas ===');
console.log('crash: isf_eixos=',crash.isf_eixos?'set':crash.isf_eixos, 'isf_achados=',crash.isf_achados?'set':crash.isf_achados,'isf_version=',crash.isf_version,'risk=',crash.risk_level);
console.log('ok:    isf_eixos=',ok.isf_eixos?'set':ok.isf_eixos, 'isf_achados=',ok.isf_achados?'set':ok.isf_achados,'isf_version=',ok.isf_version,'risk=',ok.risk_level);
