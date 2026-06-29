// Prova do Data Room real (Eixo 3): confirma que o bucket privado `documents`
// aceita upload e que o signed URL é baixável. Sobe um arquivo de teste, gera
// signed URL, baixa, valida o conteúdo e LIMPA. Não toca dados de usuário.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function env() {
  const txt = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
  const e = {};
  for (const l of txt.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return e;
}
const E = env();
const url = E.NEXT_PUBLIC_SUPABASE_URL;
const key = E.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Faltam credenciais Supabase no .env.local'); process.exit(1); }

const admin = createClient(url, key, { auth: { persistSession: false } });
// O bucket `documents` só aceita application/pdf — a prova usa um PDF mínimo.
const testPath = `__healthcheck__/dataroom-probe-${Date.now()}.pdf`;
const conteudo = `%PDF-1.4 data-room-probe-${Date.now()}`;

async function main() {
  const up = await admin.storage.from('documents').upload(testPath, Buffer.from(conteudo), { contentType: 'application/pdf' });
  if (up.error) { console.error('❌ Upload falhou:', up.error.message); process.exit(2); }
  console.log('✅ Upload OK →', testPath);

  const signed = await admin.storage.from('documents').createSignedUrl(testPath, 60);
  if (signed.error || !signed.data?.signedUrl) { console.error('❌ Signed URL falhou:', signed.error?.message); process.exit(3); }
  console.log('✅ Signed URL gerada (60s)');

  const res = await fetch(signed.data.signedUrl);
  const body = await res.text();
  if (!res.ok || body !== conteudo) { console.error(`❌ Download divergente (HTTP ${res.status})`); process.exit(4); }
  console.log('✅ Download via signed URL bate com o conteúdo enviado');

  await admin.storage.from('documents').remove([testPath]);
  console.log('✅ Arquivo de teste removido (cleanup)');
  console.log('\n🎯 Data Room real: bucket `documents` + signed URL FUNCIONANDO.');
}
main().catch((e) => { console.error(e); process.exit(1); });
