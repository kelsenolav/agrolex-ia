#!/usr/bin/env node
/**
 * Script para habilitar trigger anti-bypass no HML.
 * 
 * Uso: node scripts/fix-hml-triggers.mjs
 * 
 * ATENÇÃO: Opera APENAS no HML (lagnmjshlmssshctkyel).
 * NUNCA executar em produção.
 * 
 * Ação ÚNICA:
 * - ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_profile_trial_bypass;
 */

import pg from 'pg';

const HML_CONNECTION_STRING = 'postgresql://postgres:HmlAgrolex2026!@db.lagnmjshlmssshctkyel.supabase.co:5432/postgres';

async function main() {
  console.log('=== FIX HML TRIGGERS - lagnmjshlmssshctkyel ===\n');
  console.log('Project Ref: lagnmjshlmssshctkyel (HML)');
  console.log('Ambiente: HOMOLOGAÇÃO');
  console.log('Ação: HABILITAR trg_prevent_profile_trial_bypass\n');

  const client = new pg.Client({ connectionString: HML_CONNECTION_STRING });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco HML\n');

    // ETAPA 1: Habilitar trigger anti-bypass
    console.log('=== ETAPA 1: Habilitar trg_prevent_profile_trial_bypass ===');
    await client.query('ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_profile_trial_bypass;');
    console.log('✅ Trigger anti-bypass — HABILITADO\n');

    // ETAPA 2: Validar estado do trigger
    console.log('=== ETAPA 2: Validação ===\n');
    const { rows } = await client.query(`
      SELECT tgname, tgenabled 
      FROM pg_trigger 
      WHERE tgname = 'trg_prevent_profile_trial_bypass';
    `);
    
    if (rows.length > 0) {
      const status = rows[0].tgenabled === 't' ? 'ATIVO' : 'DESABILITADO';
      console.log(`✅ trg_prevent_profile_trial_bypass — ${status}`);
    } else {
      console.log('❌ Trigger NÃO ENCONTRADO');
    }
    console.log('');

    // ETAPA 3: Listar todos os triggers para referência
    console.log('--- Todos os triggers atuais ---');
    const { rows: allTriggers } = await client.query(`
      SELECT tgname, tgenabled, 
        CASE WHEN tgenabled = 't' THEN '✅ ATIVO' ELSE '❌ DESABILITADO' END AS status
      FROM pg_trigger 
      WHERE tgname NOT LIKE 'pg_%' AND tgname NOT LIKE 'RI_%'
      ORDER BY tgname;
    `);
    for (const t of allTriggers) {
      console.log(`  ${t.status} ${t.tgname}`);
    }
    console.log('');

    console.log('=== FIX HML TRIGGERS CONCLUÍDO ===');
    console.log('Trigger habilitado: trg_prevent_profile_trial_bypass');
    console.log('HML pronto para teste anti-bypass!\n');

  } catch (err) {
    console.error('\n❌ ERRO FATAL:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();