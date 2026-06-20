import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env={};
for (const l of readFileSync('.env.local','utf-8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;env[t.slice(0,i).trim()]=t.slice(i+1).trim();}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data:link }=await admin.auth.admin.generateLink({type:'magiclink',email:'advkelsenolavbruno@gmail.com'});
const { data:otp }=await anon.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'email'});
const ref=env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const s=otp.session;
const payload={ access_token:s.access_token, refresh_token:s.refresh_token, expires_at:s.expires_at, expires_in:s.expires_in, token_type:'bearer', user:s.user };
console.log('STORAGE_KEY=sb-'+ref+'-auth-token');
console.log('VALUE='+JSON.stringify(payload));
