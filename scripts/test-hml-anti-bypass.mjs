#!/usr/bin/env node
/**
 * Teste Funcional HML — Etapa 4: ANTI-BYPASS
 * 
 * Valida que usuário comum NÃO pode alterar diretamente:
 * - subscription_status, plan_type, trial_used
 * - trial_analysis_id, trial_started_at, trial_ends_at
 * - lead_id
 * 
 * E que campos normais (name) continuam editáveis.
 * 
 * Uso: node scripts/test-hml-anti-bypass.mjs
 * 
 * ATENÇÃO: Opera APENAS no HML (lagnmjshlmssshctkyel).
 * NUNCA executar em produção.
 * Usa APENAS chave anon — sem service_role, sem DB password.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const HML_URL = 'https://lagnmjshlmssshctkyel.supabase.co';
const HML_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhZ25tanNobG1zc3NoY3RreWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjcxNjYsImV4cCI6MjA5NjQwMzE2Nn0.HD3NzmTiu7crq2DUDnWaZ8wTr4Tc1zU9jqihAUgczoc';

const supabase = createClient(HML_URL, HML_ANON_KEY);

const TEST_EMAIL = `hmlbp${randomUUID().substring(0, 8)}@agrolex.dev`;
const TEST_PASSWORD = 'TesteHml2026!';
const TEST_NAME = 'Teste Anti-Bypass HML';

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

function printResult() {
  console.log(`\n--- RESULTADO: ${passedTests}/${totalTests} passaram, ${failedTests} falharam ---`);
}

async function main() {
  console.log('========================================');
  console.log('TESTE FUNCIONAL HML — ETAPA 4: ANTI-BYPASS');
  console.log('========================================\n');
  console.log(`Ambiente: HML (${HML_URL})`);
  console.log(`Email de teste: ${TEST_EMAIL}\n`);

  // --- Criar usuário e logar ---
  console.log('--- Setup: Criar usuário e logar ---');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: { data: { full_name: TEST_NAME } },
  });

  if (signUpError) {
    console.log(`  ❌ Erro no cadastro: ${signUpError.message}`);
    process.exit(1);
  }

  const userId = signUpData.user?.id;
  const sessionToken = signUpData.session?.access_token || '';
  console.log(`  ✅ Usuário criado: ${userId}`);
  console.log(`  ✅ Sessão ativa\n`);

  // Client autenticado
  const authedClient = createClient(HML_URL, HML_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionToken}` } },
  });

  // Verificar profile inicial
  const { data: profile } = await authedClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    console.log('  ❌ Profile não encontrado');
    process.exit(1);
  }
  console.log(`  Profile: sub=${profile.subscription_status} plan=${profile.plan_type} trial_used=${profile.trial_used}\n`);

  // ====================================================
  // BLOCO 1: Tentativas de burlar campos comerciais
  // ====================================================
  console.log('=== BLOCO 1: TENTATIVAS DE BURLAR CAMPOS COMERCIAIS ===\n');

  const BYPASS_ATTEMPTS = [
    { field: 'subscription_status', value: 'active', desc: 'subscription_status → "active"' },
    { field: 'subscription_status', value: 'cancelled', desc: 'subscription_status → "cancelled"' },
    { field: 'plan_type', value: 'profissional', desc: 'plan_type → "profissional"' },
    { field: 'plan_type', value: 'empresarial', desc: 'plan_type → "empresarial"' },
    { field: 'trial_used', value: true, desc: 'trial_used → true' },
    { field: 'trial_analysis_id', value: '00000000-0000-0000-0000-000000000001', desc: 'trial_analysis_id → UUID falso' },
    { field: 'trial_started_at', value: '2020-01-01T00:00:00Z', desc: 'trial_started_at → data antiga' },
    { field: 'trial_ends_at', value: '2099-12-31T00:00:00Z', desc: 'trial_ends_at → data futura' },
    { field: 'lead_id', value: '00000000-0000-0000-0000-000000000002', desc: 'lead_id → UUID falso' },
  ];

  let bypassBlocked = 0;
  let bypassAllowed = 0;

  for (const attempt of BYPASS_ATTEMPTS) {
    totalTests++;
    const { error } = await authedClient
      .from('profiles')
      .update({ [attempt.field]: attempt.value })
      .eq('id', userId);

    if (error) {
      console.log(`  ✅ BLOQUEADO: ${attempt.desc} — "${error.message.substring(0, 60)}"`);
      passedTests++;
      bypassBlocked++;
    } else {
      console.log(`  ❌ PERMITIDO (FALHA DE SEGURANÇA): ${attempt.desc}`);
      failedTests++;
      bypassAllowed++;
    }
  }
  console.log(`\n  Bloqueios: ${bypassBlocked}/${BYPASS_ATTEMPTS.length} | Permitidos: ${bypassAllowed}\n`);

  // ====================================================
  // BLOCO 2: Confirmar que campos comerciais continuam
  // com valores originais (não foram alterados)
  // ====================================================
  console.log('=== BLOCO 2: CONFIRMAÇÃO DE INTEGRIDADE ===\n');

  const { data: profileAfter } = await authedClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profileAfter) {
    console.log('  ❌ Profile não encontrado após testes');
    process.exit(1);
  }

  assert(profileAfter.subscription_status === 'trial', `subscription_status preservado = "${profileAfter.subscription_status}"`);
  assert(profileAfter.plan_type === 'trial', `plan_type preservado = "${profileAfter.plan_type}"`);
  assert(profileAfter.trial_used === false, `trial_used preservado = ${profileAfter.trial_used}`);
  assert(profileAfter.trial_analysis_id === null, `trial_analysis_id preservado = ${profileAfter.trial_analysis_id}`);
  assert(profileAfter.lead_id === null, `lead_id preservado = ${profileAfter.lead_id}`);
  assert(!!profileAfter.trial_started_at, 'trial_started_at ainda preenchido');
  assert(!!profileAfter.trial_ends_at, 'trial_ends_at ainda preenchido');
  console.log('');

  // ====================================================
  // BLOCO 3: Confirmar que campos normais são editáveis
  // ====================================================
  console.log('=== BLOCO 3: CAMPOS NORMAIS EDITÁVEIS ===\n');

  const { error: nameUpdateError } = await authedClient
    .from('profiles')
    .update({ name: 'Usuário Anti-Bypass OK' })
    .eq('id', userId);

  assert(!nameUpdateError, 'Update de nome permitido (campo normal)');

  // Verificar
  const { data: finalProfile } = await authedClient
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single();

  assert(finalProfile?.name === 'Usuário Anti-Bypass OK', `Nome atualizado confirmado = "${finalProfile?.name}"`);
  console.log('');

  // ====================================================
  // RESUMO
  // ====================================================
  console.log('=== RESUMO ===\n');
  printResult();

  if (failedTests === 0) {
    console.log('\n🎉 ANTI-BYPASS FUNCIONANDO PERFEITAMENTE!');
    console.log(`   ${bypassBlocked}/${BYPASS_ATTEMPTS.length} tentativas de burla bloqueadas`);
    console.log('   Campos comerciais íntegros');
    console.log('   Campos normais editáveis\n');
    process.exit(0);
  } else {
    console.log(`\n❌ ${failedTests} teste(s) falharam — ANTI-BYPASS NÃO ESTÁ 100%`);
    console.log(`   ${bypassBlocked}/${BYPASS_ATTEMPTS.length} bloqueados, ${bypassAllowed} permitidos indevidamente\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Erro não esperado:', err);
  process.exit(1);
});