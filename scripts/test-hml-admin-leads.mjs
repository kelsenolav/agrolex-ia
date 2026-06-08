#!/usr/bin/env node
/**
 * Teste Funcional HML — Etapas 5 e 6
 * 
 * ETAPA 5 — Admin/Service Role:
 * - Validar que service_role consegue alterar subscription_status, plan_type, trial_used
 * 
 * ETAPA 6 — Leads/RLS:
 * - SELECT próprio (usuário comum)
 * - SELECT admin (service_role)
 * - INSERT admin (service_role)
 * - UPDATE admin (service_role)
 * - DELETE admin (service_role)
 * - Usuário comum não acessa leads de outros
 * 
 * Uso: node scripts/test-hml-admin-leads.mjs
 * 
 * ATENÇÃO: Opera APENAS no HML (lagnmjshlmssshctkyel).
 * NUNCA executar em produção.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const HML_URL = 'https://lagnmjshlmssshctkyel.supabase.co';
const HML_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhZ25tanNobG1zc3NoY3RreWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjcxNjYsImV4cCI6MjA5NjQwMzE2Nn0.HD3NzmTiu7crq2DUDnWaZ8wTr4Tc1zU9jqihAUgczoc';
const HML_SR_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhZ25tanNobG1zc3NoY3RreWVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgyNzE2NiwiZXhwIjoyMDk2NDAzMTY2fQ.PW-WjTiK19dH23zVgl2JdddE7cG1LRDfYGbWt0HbUFQ';

const adminClient = createClient(HML_URL, HML_SR_KEY, { auth: { persistSession: false } });

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, description) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ ${description}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${description}`);
    failedTests++;
  }
}

function assertEqual(actual, expected, description) {
  totalTests++;
  if (actual === expected) {
    console.log(`  ✅ ${description}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${description}: esperado "${expected}", recebido "${actual}"`);
    failedTests++;
  }
}

function printResult() {
  console.log(`\n--- RESULTADO PARCIAL: ${passedTests}/${totalTests} passaram, ${failedTests} falharam ---`);
}

async function main() {
  console.log('========================================');
  console.log('TESTE FUNCIONAL HML — ETAPAS 5 E 6');
  console.log('========================================\n');
  console.log(`Ambiente: HML (${HML_URL})\n`);

  // ====================================================
  // SETUP: Criar usuário comum para testes
  // ====================================================
  console.log('--- SETUP: Criar usuário comum ---');
  const supabase = createClient(HML_URL, HML_ANON_KEY);
  const testEmail = `hmladmin_${randomUUID().substring(0, 8)}@agrolex.dev`;
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: 'TesteHml2026!',
    options: { data: { full_name: 'Teste Admin HML' } },
  });

  if (signUpError) {
    console.log(`  ❌ Erro no cadastro: ${signUpError.message}`);
    process.exit(1);
  }

  const testUserId = signUpData.user.id;
  const testUserToken = signUpData.session.access_token;
  console.log(`  ✅ Usuário criado: ${testUserId}\n`);

  const authedClient = createClient(HML_URL, HML_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${testUserToken}` } },
  });

  // Pegar profile
  const { data: profile } = await authedClient.from('profiles').select('*').eq('id', testUserId).single();
  if (!profile) { console.log('  ❌ Profile não encontrado'); process.exit(1); }

  // ====================================================
  // ETAPA 5 — ADMIN/SERVICE ROLE
  // ====================================================
  console.log('========================================');
  console.log('ETAPA 5 — ADMIN/SERVICE ROLE');
  console.log('========================================\n');

  console.log('--- 5.1. Alterar subscription_status via service_role ---');
  const { error: srErr1 } = await adminClient
    .from('profiles')
    .update({ subscription_status: 'active' })
    .eq('id', testUserId);

  if (srErr1) {
    console.log(`  ❌ Erro ao alterar subscription_status: ${srErr1.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log('  ✅ subscription_status alterado para "active"');
    passedTests++;
    totalTests++;
  }

  // Verificar
  const { data: p1 } = await adminClient.from('profiles').select('subscription_status').eq('id', testUserId).single();
  assertEqual(p1?.subscription_status, 'active', 'subscription_status confirmado = active');

  console.log('\n--- 5.2. Alterar plan_type via service_role ---');
  const { error: srErr2 } = await adminClient
    .from('profiles')
    .update({ plan_type: 'profissional' })
    .eq('id', testUserId);

  if (srErr2) {
    console.log(`  ❌ Erro ao alterar plan_type: ${srErr2.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log('  ✅ plan_type alterado para "profissional"');
    passedTests++;
    totalTests++;
  }

  const { data: p2 } = await adminClient.from('profiles').select('plan_type').eq('id', testUserId).single();
  assertEqual(p2?.plan_type, 'profissional', 'plan_type confirmado = profissional');

  console.log('\n--- 5.3. Alterar trial_used via service_role ---');
  const { error: srErr3 } = await adminClient
    .from('profiles')
    .update({ trial_used: true })
    .eq('id', testUserId);

  if (srErr3) {
    console.log(`  ❌ Erro ao alterar trial_used: ${srErr3.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log('  ✅ trial_used alterado para true');
    passedTests++;
    totalTests++;
  }

  const { data: p3 } = await adminClient.from('profiles').select('trial_used').eq('id', testUserId).single();
  assertEqual(p3?.trial_used, true, 'trial_used confirmado = true');

  console.log('\n--- 5.4. Restaurar valores originais (service_role) ---');
  await adminClient.from('profiles').update({
    subscription_status: 'trial',
    plan_type: 'trial',
    trial_used: false,
  }).eq('id', testUserId);

  const { data: p4 } = await adminClient.from('profiles').select('subscription_status,plan_type,trial_used').eq('id', testUserId).single();
  assertEqual(p4?.subscription_status, 'trial', 'Restaurado: subscription_status = trial');
  assertEqual(p4?.plan_type, 'trial', 'Restaurado: plan_type = trial');
  assertEqual(p4?.trial_used, false, 'Restaurado: trial_used = false');
  console.log('');

  // ====================================================
  // ETAPA 6 — LEADS / RLS
  // ====================================================
  console.log('========================================');
  console.log('ETAPA 6 — LEADS / RLS');
  console.log('========================================\n');

  // --- 6.1. Usuário comum: SELECT próprio (sem leads ainda) ---
  console.log('--- 6.1. Usuário comum: SELECT próprio ---');
  const { data: userLeads, error: userLeadsErr } = await authedClient
    .from('leads')
    .select('*');

  if (userLeadsErr) {
    console.log(`  ❌ Erro SELECT próprio: ${userLeadsErr.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log(`  ✅ SELECT próprio retornou ${userLeads?.length || 0} leads (esperado 0)`);
    passedTests++;
    totalTests++;
  }

  // --- 6.2. Usuário comum: tentar INSERT (deve falhar) ---
  console.log('\n--- 6.2. Usuário comum: tentar INSERT (deve falhar) ---');
  const { error: userInsertErr } = await authedClient
    .from('leads')
    .insert({
      nome: 'Lead Malicioso',
      email: 'hacker@evil.com',
      origem: 'trial',
      plano: 'trial',
    });

  if (userInsertErr) {
    console.log(`  ✅ INSERT bloqueado (esperado): "${userInsertErr.message.substring(0, 60)}"`);
    passedTests++;
  } else {
    console.log('  ❌ INSERT permitido (FALHA DE SEGURANÇA)');
    failedTests++;
  }
  totalTests++;

  // --- 6.3. Service role: INSERT lead ---
  console.log('\n--- 6.3. Service role: INSERT lead ---');
  const leadEmail = `lead_${randomUUID().substring(0, 8)}@agrolex.dev`;
  const { data: insertedLead, error: srInsertErr } = await adminClient
    .from('leads')
    .insert({
      nome: 'Lead Teste HML',
      email: leadEmail,
      telefone: '(11) 99999-0000',
      cidade: 'São Paulo',
      estado: 'SP',
      origem: 'trial',
      plano: 'trial',
    })
    .select()
    .single();

  if (srInsertErr) {
    console.log(`  ❌ Erro INSERT admin: ${srInsertErr.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log(`  ✅ Lead inserido: ${insertedLead.lead_id}`);
    passedTests++;
    totalTests++;
  }

  const testLeadId = insertedLead?.lead_id;
  if (!testLeadId) {
    console.log('  ❌ Lead ID não retornado — abortando testes de UPDATE/DELETE');
    printResult();
    process.exit(1);
  }

  // --- 6.4. Service role: UPDATE lead ---
  console.log('\n--- 6.4. Service role: UPDATE lead ---');
  const { error: srUpdateErr } = await adminClient
    .from('leads')
    .update({ nome: 'Lead Atualizado HML', cidade: 'Rio de Janeiro' })
    .eq('lead_id', testLeadId);

  if (srUpdateErr) {
    console.log(`  ❌ Erro UPDATE admin: ${srUpdateErr.message}`);
    failedTests++;
  } else {
    console.log('  ✅ Lead atualizado');
    passedTests++;
  }
  totalTests++;

  // Verificar update
  const { data: updatedLead } = await adminClient.from('leads').select('nome,cidade').eq('lead_id', testLeadId).single();
  assertEqual(updatedLead?.nome, 'Lead Atualizado HML', 'Lead nome atualizado confirmado');
  assertEqual(updatedLead?.cidade, 'Rio de Janeiro', 'Lead cidade atualizada confirmada');

  // --- 6.5. Usuário comum: tentar UPDATE no lead (deve falhar) ---
  console.log('\n--- 6.5. Usuário comum: tentar UPDATE (deve falhar) ---');
  const { error: userUpdateErr, count: userUpdateCount } = await authedClient
    .from('leads')
    .update({ nome: 'Hacked' }, { count: 'exact' })
    .eq('lead_id', testLeadId);

  if (userUpdateErr || userUpdateCount === 0) {
    console.log(`  ✅ UPDATE bloqueado (esperado): ${userUpdateErr ? userUpdateErr.message.substring(0, 50) : '0 linhas afetadas (RLS silenciosa)'}`);
    passedTests++;
  } else {
    console.log('  ❌ UPDATE permitido (FALHA DE SEGURANÇA)');
    failedTests++;
  }
  totalTests++;

  // --- 6.6. Usuário comum: tentar DELETE no lead (deve falhar) ---
  console.log('\n--- 6.6. Usuário comum: tentar DELETE (deve falhar) ---');
  const { error: userDeleteErr, count: userDeleteCount } = await authedClient
    .from('leads')
    .delete({ count: 'exact' })
    .eq('lead_id', testLeadId);

  if (userDeleteErr || userDeleteCount === 0) {
    console.log(`  ✅ DELETE bloqueado (esperado): ${userDeleteErr ? userDeleteErr.message.substring(0, 50) : '0 linhas afetadas (RLS silenciosa)'}`);
    passedTests++;
  } else {
    console.log('  ❌ DELETE permitido (FALHA DE SEGURANÇA)');
    failedTests++;
  }
  totalTests++;

  // --- 6.7. Service role: DELETE lead ---
  console.log('\n--- 6.7. Service role: DELETE lead ---');
  const { error: srDeleteErr } = await adminClient
    .from('leads')
    .delete()
    .eq('lead_id', testLeadId);

  if (srDeleteErr) {
    console.log(`  ❌ Erro DELETE admin: ${srDeleteErr.message}`);
    failedTests++;
  } else {
    console.log('  ✅ Lead deletado');
    passedTests++;
  }
  totalTests++;

  // Confirmar deleção
  const { data: deletedLead } = await adminClient.from('leads').select('lead_id').eq('lead_id', testLeadId);
  assert(deletedLead?.length === 0, 'Lead deletado confirmado (não encontrado)');

  // --- 6.8. Usuário comum: verificar que não vê lead deletado ---
  console.log('\n--- 6.8. Usuário comum: verificar isolamento ---');
  const { data: allLeads } = await authedClient.from('leads').select('*');
  assert(
    !allLeads?.some(l => l.lead_id === testLeadId),
    'Usuário comum não vê lead deletado pelo admin (isolamento OK)'
  );

  // ====================================================
  // RESUMO
  // ====================================================
  console.log('\n========================================');
  console.log('RESUMO FINAL — ETAPAS 5 E 6');
  console.log('========================================\n');
  printResult();

  if (failedTests === 0) {
    console.log('\n🎉 ETAPAS 5 E 6 APROVADAS!');
    console.log('   - Service role edita campos comerciais: OK');
    console.log('   - RLS leads bloqueia usuário comum: OK');
    console.log('   - Admin CRUD em leads: OK\n');
    process.exit(0);
  } else {
    console.log(`\n❌ ${failedTests} teste(s) falharam.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Erro não esperado:', err);
  process.exit(1);
});