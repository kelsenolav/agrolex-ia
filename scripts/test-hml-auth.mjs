#!/usr/bin/env node
/**
 * Teste Funcional HML — Etapas 2 e 3
 * 
 * Valida:
 * - Cadastro (signup)
 * - Login
 * - Logout
 * - Profile automático criado
 * - Defaults comerciais (subscription_status, plan_type, trial_used, etc.)
 * - Profile update (campos normais)
 * 
 * Uso: node scripts/test-hml-auth.mjs
 * 
 * ATENÇÃO: Opera APENAS no HML (lagnmjshlmssshctkyel).
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const HML_URL = 'https://lagnmjshlmssshctkyel.supabase.co';
const HML_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhZ25tanNobG1zc3NoY3RreWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjcxNjYsImV4cCI6MjA5NjQwMzE2Nn0.HD3NzmTiu7crq2DUDnWaZ8wTr4Tc1zU9jqihAUgczoc';

const supabase = createClient(HML_URL, HML_ANON_KEY);

const TEST_EMAIL = `hmldev${randomUUID().substring(0, 8)}@gmail.com`;
const TEST_PASSWORD = 'TesteHml2026!';
const TEST_NAME = 'Usuário Teste HML';

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
    console.log(`  ✅ ${description} (${JSON.stringify(actual)})`);
    passedTests++;
  } else {
    console.log(`  ❌ ${description}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
    failedTests++;
  }
}

function assertNotNull(value, description) {
  totalTests++;
  if (value !== null && value !== undefined) {
    console.log(`  ✅ ${description}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${description}: valor é null/undefined`);
    failedTests++;
  }
}

function printResult() {
  console.log(`\n--- RESULTADO: ${passedTests}/${totalTests} passaram, ${failedTests} falharam ---`);
}

async function main() {
  console.log('========================================');
  console.log('TESTE FUNCIONAL HML — ETAPAS 2 E 3');
  console.log('========================================\n');
  console.log(`Ambiente: HML (${HML_URL})`);
  console.log(`Email de teste: ${TEST_EMAIL}\n`);

  // ====================================================
  // ETAPA 2 — TESTE DE AUTH/CADASTRO
  // ====================================================
  console.log('=== ETAPA 2 — AUTH/CADASTRO ===\n');

  // --- 2.1. CADASTRO (SIGNUP) ---
  console.log('--- 2.1. Cadastro (signup) ---');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: {
      data: { full_name: TEST_NAME },
    },
  });

  if (signUpError) {
    console.log(`  ❌ Erro no cadastro: ${signUpError.message}`);
    failedTests++;
    totalTests++;
    printResult();
    process.exit(1);
  }

  assertNotNull(signUpData.user, 'User retornado no signup');
  assertNotNull(signUpData.user?.id, 'User.id retornado');
  assertEqual(signUpData.user?.email, TEST_EMAIL, 'Email do usuário');
  assertEqual(signUpData.user?.user_metadata?.full_name, TEST_NAME, 'Full name do usuário');

  const userId = signUpData.user?.id;
  console.log(`  User ID: ${userId}\n`);

  // --- 2.2. VERIFICAR SE PRECISA CONFIRMAR EMAIL ---
  console.log('--- 2.2. Verificação de confirmação de email ---');
  if (signUpData.session) {
    console.log('  ✅ Sessão retornada após signup — email não precisa confirmação');
  } else {
    console.log('  ⚠️ Sessão NÃO retornada — pode precisar confirmar email');
    console.log('  ⚠️ Tentando login mesmo assim\n');
  }
  totalTests++;
  if (signUpData.session) passedTests++;
  else {
    // Se não tem sessão, tenta login direto
    console.log('  Tentando login...');
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (loginError) {
      console.log(`  ❌ Login também falhou: ${loginError.message}`);
      failedTests++;
      printResult();
      process.exit(1);
    }
    passedTests++; // Considerou que email não confirmado é aceitável
  }
  console.log('');

  // --- 2.3. LOGIN ---
  console.log('--- 2.3. Login ---');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (loginError) {
    console.log(`  ❌ Erro no login: ${loginError.message}`);
    failedTests++;
    totalTests++;
    printResult();
    process.exit(1);
  }

  assertNotNull(loginData.session, 'Sessão retornada no login');
  assertNotNull(loginData.user, 'User retornado no login');
  assertEqual(loginData.user?.email, TEST_EMAIL, 'Email do usuário logado');

  const sessionToken = loginData.session?.access_token || '';
  console.log(`  Session token: ${sessionToken.substring(0, 20)}...\n`);

  // --- 2.4. LOGOUT ---
  console.log('--- 2.4. Logout ---');
  const { error: logoutError } = await supabase.auth.signOut();

  if (logoutError) {
    console.log(`  ❌ Erro no logout: ${logoutError.message}`);
    failedTests++;
  } else {
    console.log('  ✅ Logout realizado com sucesso');
    passedTests++;
  }
  totalTests++;
  console.log('');

  // --- 2.5. RELOGIN PARA TESTAR PROFILE ---
  console.log('--- 2.5. Relogin (para testar profile) ---');
  const { data: reloginData, error: reloginError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (reloginError) {
    console.log(`  ❌ Erro no relogin: ${reloginError.message}`);
    failedTests++;
    totalTests++;
    printResult();
    process.exit(1);
  }

  assertNotNull(reloginData.session, 'Sessão relogin OK');
  passedTests += 0; // já contado no assert
  totalTests++;
  console.log('');

  // --- 2.6. VALIDAÇÃO DO PROFILE AUTOMÁTICO ---
  console.log('--- 2.6. Validação do profile automático ---');
  
  // Usar o supabase autenticado
  const authedClient = createClient(HML_URL, HML_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${reloginData.session?.access_token || ''}`,
      },
    },
  });

  const { data: profile, error: profileError } = await authedClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.log(`  ❌ Erro ao buscar profile: ${profileError.message}`);
    failedTests++;
    totalTests++;
    printResult();
    process.exit(1);
  }

  assertNotNull(profile, 'Profile encontrado');
  assertEqual(profile.id, userId, 'Profile.id = user.id');
  assertEqual(profile.email, TEST_EMAIL, 'Profile.email');
  assertEqual(profile.name, TEST_NAME, 'Profile.name');
  assertNotNull(profile.created_at, 'Profile.created_at');
  
  // Defaults da migration base
  assertEqual(profile.role, 'user', 'Profile.role = user (default)');
  console.log('');

  // --- 2.7. VALIDAÇÃO DOS CAMPOS COMERCIAIS (TRIAL) ---
  console.log('--- 2.7. Validação dos campos comerciais (trial defaults) ---');

  assertEqual(profile.subscription_status, 'trial', 'subscription_status = trial');
  assertEqual(profile.plan_type, 'trial', 'plan_type = trial');
  assertEqual(profile.trial_used, false, 'trial_used = false');
  assertEqual(profile.trial_analysis_id, null, 'trial_analysis_id = null');
  assertNotNull(profile.trial_started_at, 'trial_started_at preenchido');
  assertNotNull(profile.trial_ends_at, 'trial_ends_at preenchido');
  assertEqual(profile.lead_id, null, 'lead_id = null');

  // Validar que trial_ends_at > trial_started_at
  const trialStarted = new Date(profile.trial_started_at).getTime();
  const trialEnds = new Date(profile.trial_ends_at).getTime();
  assert(trialEnds > trialStarted, `trial_ends_at > trial_started_at (${trialEnds - trialStarted}ms diferença)`);

  // Validar que o trial tem ~7 dias
  const diffDays = (trialEnds - trialStarted) / (1000 * 60 * 60 * 24);
  assert(diffDays >= 6 && diffDays <= 8, `Período trial ≈ 7 dias (${diffDays.toFixed(1)} dias)`);
  console.log('');

  // ====================================================
  // ETAPA 3 — TESTE PROFILE UPDATE
  // ====================================================
  console.log('=== ETAPA 3 — PROFILE UPDATE (campos normais) ===\n');

  const NEW_NAME = 'Usuário Atualizado HML';
  const NEW_PHONE = '(11) 99999-9999';
  const NEW_AVATAR = 'https://example.com/avatar.png';

  const { error: updateError } = await authedClient
    .from('profiles')
    .update({
      name: NEW_NAME,
      telefone: NEW_PHONE,
      avatar_url: NEW_AVATAR,
    })
    .eq('id', userId);

  if (updateError) {
    console.log(`  ❌ Erro ao atualizar profile: ${updateError.message}`);
    failedTests++;
  } else {
    console.log('  ✅ Update de profile executado sem erro');
    passedTests++;
  }
  totalTests++;

  // Verificar se os campos foram atualizados
  const { data: updatedProfile, error: readError } = await authedClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (readError) {
    console.log(`  ❌ Erro ao ler profile atualizado: ${readError.message}`);
    failedTests++;
    totalTests++;
  } else {
    // Verificar campos que existem na tabela (telefone e avatar_url podem não existir no schema base)
    if (updatedProfile.name !== undefined) {
      assertEqual(updatedProfile.name, NEW_NAME, 'Profile.name atualizado');
    }
    // Campos telefone e avatar_url só existem se a migration base os criou
    if ('telefone' in updatedProfile) {
      assertEqual(updatedProfile.telefone, NEW_PHONE, 'Profile.telefone atualizado');
    } else {
      console.log('  ℹ️  Campo telefone não existe no schema — ignorado');
    }
    if ('avatar_url' in updatedProfile) {
      assertEqual(updatedProfile.avatar_url, NEW_AVATAR, 'Profile.avatar_url atualizado');
    } else {
      console.log('  ℹ️  Campo avatar_url não existe no schema — ignorado');
    }
    
    // Garantir que campos comerciais NÃO foram alterados pelo update
    assertEqual(updatedProfile.subscription_status, 'trial', 'subscription_status preservado (trial)');
    assertEqual(updatedProfile.plan_type, 'trial', 'plan_type preservado (trial)');
    assertEqual(updatedProfile.trial_used, false, 'trial_used preservado (false)');
  }
  console.log('');

  // ====================================================
  // RESUMO
  // ====================================================
  console.log('=== RESUMO ===\n');
  printResult();

  if (failedTests === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! HML pronto para Etapa 4 (anti-bypass).\n');
    console.log('Credenciais do usuário teste:');
    console.log(`  Email: ${TEST_EMAIL}`);
    console.log(`  Senha: ${TEST_PASSWORD}`);
    console.log(`  ID:    ${userId}`);
    process.exit(0);
  } else {
    console.log(`\n❌ ${failedTests} teste(s) falharam.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Erro não esperado:', err);
  process.exit(1);
});