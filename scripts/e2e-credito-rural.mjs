import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = {};
for (const line of readFileSync('.env.local','utf-8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i===-1)continue; env[t.slice(0,i).trim()]=t.slice(i+1).trim();
}
const PROD='https://agrolex-ia-qx32.vercel.app', EMAIL='advkelsenolavbruno@gmail.com';
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: link }=await admin.auth.admin.generateLink({ type:'magiclink', email:EMAIL });
const { data: otp }=await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type:'email' });
const jwt=otp.session.access_token;
const { data: users }=await admin.auth.admin.listUsers();
const user=users.users.find(u=>u.email===EMAIL);

// Elegibilidade
const body={ property_id:null, origem_matricula:false, matricula_limpa:true, onus_count:0, onus_types:[],
  hipotecas_vigentes:0, penhoras_vigentes:0, area_total_ha:122.54, area_gravada_ha:0, car_ativo:true,
  ccir_vigente:true, itr_regular:true, dap_caf_valida:false, tipo_produtor:'medio', renda_bruta_anual:800000,
  uf:'TO', credito_rural_vigente:false, inadimplencia_credito_rural:false, cadin_serasa:false,
  prodes_clean:true, embargo_ibama:false };
const res=await fetch(PROD+'/api/credito-rural/elegibilidade',{ method:'POST',
  headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt}`}, body:JSON.stringify(body) });
const data=await res.json();
console.log('HTTP', res.status);
console.log('Score:', data.resultado?.score, '| Faixa:', data.resultado?.faixa);
console.log('Vigência:', data.resultado?.parametros_vigencia);
console.log('Programas:', data.resultado?.programas_elegiveis?.map(p=>`${p.nome}:${p.elegivel?'✓':'✗'}`).join(', '));
console.log('FNO (TO) presente?', data.resultado?.programas_elegiveis?.some(p=>p.programa_id==='fno'));
console.log('analise_id persistido:', data.analise_id);
console.log('disclaimer presente?', !!data.resultado?.disclaimer);

// Defesa
const defBody={ property_id:null, tipo_cedula:'CCR', credor:'Banco X', devedor:'Produtor Y',
  valor_principal:200000, taxa_juros_contratual:8, taxa_mora_contratual:12, data_emissao:'2018-01-01',
  data_vencimento:'2019-01-01', capitalizacao_juros:true };
const res2=await fetch(PROD+'/api/credito-rural/defesa',{ method:'POST',
  headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt}`}, body:JSON.stringify(defBody) });
const data2=await res2.json();
console.log('\n[DEFESA] HTTP', res2.status, '| score:', data2.resultado?.score_defesa, '| estratégia:', data2.resultado?.estrategia_recomendada);
console.log('Prescrita?', data2.resultado?.prescricao?.prescrita, '| defeitos:', data2.resultado?.defects?.length, '| analise_id:', data2.analise_id);

// Verifica persistência no banco
const { data: rows }=await admin.from('credito_rural_analises').select('id, tipo, score').eq('user_id', user.id).order('created_at',{ascending:false}).limit(3);
console.log('\nPersistência (últimas 3):', JSON.stringify(rows));

// Limpeza
if (rows?.length) for (const r of rows) await admin.from('credito_rural_analises').delete().eq('id', r.id);
console.log('Linhas de teste removidas.');
