import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env={};
for (const l of readFileSync('.env.local','utf-8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;env[t.slice(0,i).trim()]=t.slice(i+1).trim();}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: link }=await admin.auth.admin.generateLink({ type:'magiclink', email:'advkelsenolavbruno@gmail.com' });
const { data: otp }=await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type:'email' });
const jwt=otp.session.access_token;
const userClient=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { global:{ headers:{ Authorization:`Bearer ${jwt}` } } });
const { data:{ user } }=await userClient.auth.getUser();
console.log('user.id:', user.id);
const { data, error }=await userClient.from('credito_rural_analises').insert({
  user_id:user.id, property_id:null, tipo:'elegibilidade', score:50, faixa:'condicional', input:{}, resultado:{}, parametros_vigencia:'x'
}).select('id').single();
console.log('insert data:', data);
console.log('insert error:', error?.message, '| code:', error?.code, '| details:', error?.details);
if (data) await admin.from('credito_rural_analises').delete().eq('id', data.id);
