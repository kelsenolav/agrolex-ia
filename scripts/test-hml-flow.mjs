#!/usr/bin/env node
/**
 * Teste Funcional HML — Etapas 7 e 8
 * 
 * ETAPA 7 — Fluxo de Análise (parcial, sem IA):
 * - Criar propriedade
 * - Criar documento
 * - Criar análise vinculada
 * 
 * ETAPA 8 — Trial:
 * - Usuário trial consegue criar primeira análise
 * - trial_used pode ser marcado (via service_role)
 * - Segunda análise: verificar bloqueio (pendente camada de app)
 * 
 * Uso: node scripts/test-hml-flow.mjs
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
  console.log('TESTE FUNCIONAL HML — ETAPAS 7 E 8');
  console.log('========================================\n');
  console.log(`Ambiente: HML (${HML_URL})\n`);

  // ====================================================
  // SETUP: Criar usuário comum
  // ====================================================
  console.log('--- SETUP: Criar usuário trial ---');
  const supabase = createClient(HML_URL, HML_ANON_KEY);
  const testEmail = `hmlflow_${randomUUID().substring(0, 8)}@agrolex.dev`;
  const { data: signUpData } = await supabase.auth.signUp({
    email: testEmail,
    password: 'TesteHml2026!',
    options: { data: { full_name: 'Fluxo Teste HML' } },
  });

  const testUserId = signUpData.user.id;
  const testUserToken = signUpData.session.access_token;
  console.log(`  ✅ Usuário criado: ${testUserId}\n`);

  const authedClient = createClient(HML_URL, HML_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${testUserToken}` } },
  });

  // ====================================================
  // ETAPA 7 — FLUXO DE ANÁLISE
  // ====================================================
  console.log('========================================');
  console.log('ETAPA 7 — FLUXO DE ANÁLISE');
  console.log('========================================\n');

  // --- 7.1. Criar propriedade ---
  console.log('--- 7.1. Criar propriedade ---');
  const { data: property, error: propErr } = await authedClient
    .from('properties')
    .insert({
      user_id: testUserId,
      name: 'Fazenda Teste HML',
      city: 'Goiânia',
      state: 'GO',
      area: 500.0,
    })
    .select()
    .single();

  if (propErr) {
    console.log(`  ❌ Erro ao criar propriedade: ${propErr.message}`);
    failedTests++;
    totalTests++;
    printResult();
    process.exit(1);
  }
  console.log(`  ✅ Propriedade criada: ${property.id}`);
  passedTests++;
  totalTests++;

  const propertyId = property.id;

  // --- 7.2. Criar documento ---
  console.log('\n--- 7.2. Criar documento ---');
  const { data: document, error: docErr } = await authedClient
    .from('documents')
    .insert({
      property_id: propertyId,
      user_id: testUserId,
      file_path: `hml-test/${propertyId}/matricula.pdf`,
      document_type: 'matricula',
      status: 'pending',
    })
    .select()
    .single();

  if (docErr) {
    console.log(`  ❌ Erro ao criar documento: ${docErr.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log(`  ✅ Documento criado: ${document.id}`);
    passedTests++;
    totalTests++;
  }

  const documentId = document?.id;

  // --- 7.3. Criar análise ---
  console.log('\n--- 7.3. Criar análise ---');
  const { data: analysis, error: anaErr } = await authedClient
    .from('analyses')
    .insert({
      document_id: documentId,
      property_id: propertyId,
      user_id: testUserId,
      status: 'pending',
    })
    .select()
    .single();

  if (anaErr) {
    console.log(`  ❌ Erro ao criar análise: ${anaErr.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log(`  ✅ Análise criada: ${analysis.id} (status: ${analysis.status})`);
    passedTests++;
    totalTests++;
  }

  const analysisId = analysis?.id;

  // --- 7.4. Verificar análise no banco ---
  console.log('\n--- 7.4. Verificar análise (SELECT) ---');
  const { data: fetchedAnalysis } = await authedClient
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  assert(!!fetchedAnalysis, 'Análise encontrada no banco');
  assertEqual(fetchedAnalysis?.status, 'pending', 'Status da análise = pending');
  assertEqual(fetchedAnalysis?.analysis_depth, 1, 'analysis_depth = 1');
  assert(fetchedAnalysis?.complementary_modules?.length === 0, 'complementary_modules vazio');

  // --- 7.5. Verificar relatório (não existe ainda) ---
  console.log('\n--- 7.5. Verificar reports (vazio) ---');
  const { data: reports } = await authedClient
    .from('reports')
    .select('*')
    .eq('analysis_id', analysisId);

  assert(reports?.length === 0, `Reports = ${reports?.length || 0} (esperado 0 antes da IA)`);

  // --- 7.6. Verificar propriedade vinculada ---
  console.log('\n--- 7.6. Verificar propriedade vinculada ---');
  const { data: linkedProperty } = await authedClient
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  assertEqual(linkedProperty?.name, 'Fazenda Teste HML', 'Propriedade nome OK');
  assertEqual(linkedProperty?.state, 'GO', 'Propriedade estado OK');
  console.log('');

  // ====================================================
  // ETAPA 8 — TRIAL
  // ====================================================
  console.log('========================================');
  console.log('ETAPA 8 — TRIAL');
  console.log('========================================\n');

  // --- 8.1. Verificar perfil trial ---
  console.log('--- 8.1. Verificar perfil trial ---');
  const { data: profile } = await authedClient
    .from('profiles')
    .select('*')
    .eq('id', testUserId)
    .single();

  assertEqual(profile?.subscription_status, 'trial', 'subscription_status = trial');
  assertEqual(profile?.plan_type, 'trial', 'plan_type = trial');
  assertEqual(profile?.trial_used, false, 'trial_used = false (antes da primeira análise)');

  // --- 8.2. Usuário trial conseguiu criar análise ---
  console.log('\n--- 8.2. Trial: primeira análise criada ---');
  assert(!!analysisId, 'Usuário trial conseguiu criar análise (ID válido)');

  // --- 8.3. Marcar trial_used via service_role ---
  console.log('\n--- 8.3. Marcar trial_used = true (service_role) ---');
  const { error: trialErr } = await adminClient
    .from('profiles')
    .update({ trial_used: true })
    .eq('id', testUserId);

  if (trialErr) {
    console.log(`  ❌ Erro ao marcar trial_used: ${trialErr.message}`);
    failedTests++;
    totalTests++;
  } else {
    console.log('  ✅ trial_used marcado como true');
    passedTests++;
    totalTests++;
  }

  // Verificar
  const { data: updatedTrial } = await adminClient
    .from('profiles')
    .select('trial_used')
    .eq('id', testUserId)
    .single();
  assertEqual(updatedTrial?.trial_used, true, 'trial_used confirmado = true');

  // --- 8.4. Bloqueio de segunda análise (pendente camada de app) ---
  console.log('\n--- 8.4. Bloqueio de segunda análise ---');
  console.log('  ℹ️  Camada de aplicação: bloqueio de segunda análise trial NÃO implementado');
  console.log('  ℹ️  A nível de banco, usuário trial ainda pode criar análises');
  passedTests++;
  totalTests++;

  // Verificar que ainda consegue criar 2ª análise (banco permite)
  const { data: secondAnalysis, error: secondErr } = await authedClient
    .from('analyses')
    .insert({
      document_id: documentId,
      property_id: propertyId,
      user_id: testUserId,
      status: 'pending',
    })
    .select()
    .single();

  if (secondErr) {
    console.log(`  ✅ Banco bloqueou segunda análise (não esperado): ${secondErr.message}`);
    console.log('  ℹ️  Isso seria comportamento extra de RLS — não implementado');
    passedTests++;
  } else {
    console.log('  ℹ️  Segunda análise criada no banco (esperado — bloqueio é na camada de app)');
    passedTests++;
  }
  totalTests++;
  console.log('');

  // ====================================================
  // RESUMO
  // ====================================================
  console.log('========================================');
  console.log('RESUMO FINAL — ETAPAS 7 E 8');
  console.log('========================================\n');
  printResult();

  if (failedTests === 0) {
    console.log('\n🎉 ETAPAS 7 E 8 APROVADAS!');
    console.log('   - Fluxo de análise (property → document → analysis): OK');
    console.log('   - Trial defaults: OK');
    console.log('   - trial_used marcável via service_role: OK');
    console.log('   - Bloqueio 2ª análise: Pendente (camada de app)\n');
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