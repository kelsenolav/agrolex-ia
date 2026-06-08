#!/usr/bin/env node
/**
 * Script para corrigir grants de acesso no HML.
 * 
 * Uso: node scripts/fix-hml-grants.mjs
 * 
 * ATENÇÃO: Opera APENAS no HML (lagnmjshlmssshctkyel).
 * NUNCA executar em produção.
 * 
 * Ações:
 * - GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role
 * - GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role
 * - GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role
 * - Validação de acesso
 */

import pg from 'pg';

const HML_CONNECTION_STRING = 'postgresql://postgres:HmlAgrolex2026!@db.lagnmjshlmssshctkyel.supabase.co:5432/postgres';

async function main() {
  console.log('=== FIX HML GRANTS - lagnmjshlmssshctkyel ===\n');
  console.log('Project Ref: lagnmjshlmssshctkyel (HML)');
  console.log('Ambiente: HOMOLOGAÇÃO');
  console.log('Ação: CORRIGIR GRANTS (sem alterar schema/triggers)\n');

  const client = new pg.Client({ connectionString: HML_CONNECTION_STRING });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco HML\n');

    // ETAPA 1: Grants de schema
    console.log('=== ETAPA 1: GRANT USAGE ON SCHEMA ===');
    await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;');
    console.log('✅ GRANT USAGE ON SCHEMA public — OK\n');

    // ETAPA 2: Grants em todas as tabelas
    console.log('=== ETAPA 2: GRANT ON ALL TABLES ===');
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;');
    console.log('✅ GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES — OK\n');

    // ETAPA 3: Grants em sequences (para auto-increment funcionar)
    console.log('=== ETAPA 3: GRANT ON ALL SEQUENCES ===');
    await client.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;');
    console.log('✅ GRANT ALL ON ALL SEQUENCES — OK\n');

    // ETAPA 4: Validação — listar tabelas como service_role
    console.log('=== ETAPA 4: VALIDAÇÃO ===\n');

    // Testar SELECT em profiles via tabela do sistema (pg_catalog)
    const { rows: tables } = await client.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    
    console.log('Tabelas encontradas:', tables.map(r => r.tablename).join(', '));

    // Testar SELECT direto em cada tabela
    for (const { tablename } of tables) {
      try {
        const { rowCount } = await client.query(`SELECT COUNT(*) FROM public."${tablename}";`);
        console.log(`✅ ${tablename}: ${rowCount} registros`);
      } catch (err) {
        console.log(`❌ ${tablename}: ${err.message}`);
      }
    }
    console.log('');

    // ETAPA 5: Verificar triggers e funções
    console.log('--- Triggers ---');
    const { rows: triggers } = await client.query(`
      SELECT tgname, tgtype, tgenabled 
      FROM pg_trigger 
      WHERE tgname NOT LIKE 'pg_%' AND tgname NOT LIKE 'RI_%'
      ORDER BY tgname;
    `);
    for (const t of triggers) {
      const status = t.tgenabled === 't' ? '✅' : '❌ DESABILITADO';
      console.log(`${status} ${t.tgname} (type: ${t.tgtype})`);
    }
    console.log('');

    // ETAPA 6: Verificar função handle_new_user
    console.log('--- Função handle_new_user ---');
    const { rows: funcs } = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';
    `);
    if (funcs.length > 0) {
      const f = funcs[0];
      console.log(`✅ handle_new_user EXISTE (SECURITY DEFINER: ${f.prosecdef})`);
    } else {
      console.log('❌ handle_new_user NÃO EXISTE');
    }
    console.log('');

    // ETAPA 7: Verificar trigger on_auth_user_created
    console.log('--- Trigger on_auth_user_created ---');
    const { rows: authTrigger } = await client.query(`
      SELECT tgname, tgenabled
      FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created';
    `);
    if (authTrigger.length > 0) {
      const t = authTrigger[0];
      const status = t.tgenabled === 't' ? 'ATIVO' : 'DESABILITADO';
      console.log(`✅ Trigger on_auth_user_created — ${status}`);
    } else {
      console.log('❌ Trigger on_auth_user_created NÃO EXISTE');
    }
    console.log('');

    // ETAPA 8: Verificar RLS policies
    console.log('--- RLS Policies ---');
    const { rows: policies } = await client.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    for (const p of policies) {
      console.log(`✅ ${p.tablename}: ${p.policyname} (${p.cmd})`);
    }
    console.log('');

    console.log('=== FIX HML GRANTS CONCLUÍDO ===');
    console.log('Grants aplicados: USAGE schema + ALL TABLES + ALL SEQUENCES');
    console.log('Roles: anon, authenticated, service_role');
    console.log('HML pronto para teste de acesso!\n');

  } catch (err) {
    console.error('\n❌ ERRO FATAL:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();