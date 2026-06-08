#!/usr/bin/env node
/**
 * Script para resetar o banco HML e aplicar migrations na ordem correta.
 * 
 * Uso: node scripts/reset-hml.mjs
 * 
 * ATENÇÃO: Este script opera APENAS no HML (lagnmjshlmssshctkyel).
 * NUNCA executar em produção.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

// Configuração HML
const HML_CONNECTION_STRING = 'postgresql://postgres:HmlAgrolex2026!@db.lagnmjshlmssshctkyel.supabase.co:5432/postgres';

// Ordem correta das migrations
const MIGRATION_ORDER = [
  '00000_init.sql',
  '20260605_parent_analysis_id.sql',
  '20260605_orders_payments.sql',
  '20260607_leads_trial_profiles.sql',
];

const MIGRATIONS_TO_IGNORE = [
  'lgpd_cron.sql',
  'radar_schema.sql',
  'v4_features.sql',
];

async function main() {
  console.log('=== RESET HML - lagnmjshlmssshctkyel ===\n');
  
  console.log('Project Ref: lagnmjshlmssshctkyel (HML)');
  console.log('Ambiente: HOMOLOGAÇÃO');
  console.log('Ação: RESETAR schema public e aplicar migrations\n');

  const client = new pg.Client({ connectionString: HML_CONNECTION_STRING });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao banco HML\n');

    // ETAPA 2: Resetar schema public
    console.log('=== ETAPA 2: Resetando schema public ===');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('✅ Schema public resetado\n');

    // ETAPA 3: Aplicar migrations na ordem
    console.log('=== ETAPA 3: Aplicando migrations ===\n');
    
    // Pré-limpeza: dropar policies de storage que persistem fora do schema public
    await client.query(`DROP POLICY IF EXISTS "Usuários podem fazer upload em documents" ON storage.objects;`);
    await client.query(`DROP POLICY IF EXISTS "Usuários podem ler seus documentos" ON storage.objects;`);
    console.log('✅ Storage policies removidas\n');
    
    // --- Migration 1: 00000_init.sql ---
    console.log('📄 Aplicando: 00000_init.sql');
    const initSql = readFileSync(join(MIGRATIONS_DIR, '00000_init.sql'), 'utf-8');
    await client.query(initSql);
    console.log('✅ 00000_init.sql — OK\n');

    // --- Migration 2: 20260605_parent_analysis_id.sql ---
    console.log('📄 Aplicando: 20260605_parent_analysis_id.sql');
    const parentSql = readFileSync(join(MIGRATIONS_DIR, '20260605_parent_analysis_id.sql'), 'utf-8');
    await client.query(parentSql);
    console.log('✅ 20260605_parent_analysis_id.sql — OK\n');

    // --- Migration 3: 20260605_orders_payments.sql ---
    console.log('📄 Aplicando: 20260605_orders_payments.sql');
    const ordersSql = readFileSync(join(MIGRATIONS_DIR, '20260605_orders_payments.sql'), 'utf-8');
    await client.query(ordersSql);
    console.log('✅ 20260605_orders_payments.sql — OK\n');

    // --- Migration 4: 20260607_leads_trial_profiles.sql ---
    // NOTA: Esta migration tem um bug de ordem: o índice idx_profiles_trial_analysis_id
    // (Bloco 2.5) é criado ANTES do ALTER TABLE que adiciona trial_analysis_id (Bloco 3).
    // Solução: executar em partes, movendo o índice para depois do ALTER TABLE.
    console.log('📄 Aplicando: 20260607_leads_trial_profiles.sql');
    
    // Bloco 1: CREATE TABLE leads
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.leads (
          lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
          nome TEXT NOT NULL,
          email TEXT NOT NULL,
          telefone TEXT,
          cidade TEXT,
          estado TEXT,
          origem TEXT DEFAULT 'trial',
          primeira_analise_id UUID NULL REFERENCES public.analyses(id) ON DELETE SET NULL,
          isf_resultado INTEGER NULL,
          converteu BOOLEAN DEFAULT false,
          converted_at TIMESTAMPTZ NULL,
          plano TEXT DEFAULT 'trial',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('  ✅ Bloco 1 (CREATE TABLE leads) — OK');

    // Bloco 2: Índices de leads
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_leads_converteu ON public.leads(converteu);
      CREATE INDEX IF NOT EXISTS idx_leads_plano ON public.leads(plano);
    `);
    console.log('  ✅ Bloco 2 (índices leads) — OK');

    // Bloco 3: ALTER TABLE profiles (adiciona colunas comerciais)
    await client.query(`
      ALTER TABLE public.profiles
          ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
          ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'trial',
          ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS trial_analysis_id UUID NULL REFERENCES public.analyses(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now(),
          ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
          ADD COLUMN IF NOT EXISTS lead_id UUID NULL REFERENCES public.leads(lead_id) ON DELETE SET NULL;
    `);
    console.log('  ✅ Bloco 3 (ALTER TABLE profiles) — OK');

    // Bloco 2.5: Índice trial_analysis_id (AGORA a coluna existe)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_profiles_trial_analysis_id ON public.profiles(trial_analysis_id);
    `);
    console.log('  ✅ Bloco 2.5 (índice trial_analysis_id) — OK');

    // Bloco 3.5: NOT NULL constraints
    await client.query(`
      UPDATE public.profiles SET subscription_status = 'trial' WHERE subscription_status IS NULL;
      ALTER TABLE public.profiles ALTER COLUMN subscription_status SET NOT NULL, ALTER COLUMN subscription_status SET DEFAULT 'trial';
      UPDATE public.profiles SET plan_type = 'trial' WHERE plan_type IS NULL;
      ALTER TABLE public.profiles ALTER COLUMN plan_type SET NOT NULL, ALTER COLUMN plan_type SET DEFAULT 'trial';
    `);
    console.log('  ✅ Bloco 3.5 (NOT NULL constraints) — OK');

    // Bloco 4: CHECK constraints
    await client.query(`
      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_subscription_status_check' AND conrelid = 'public.profiles'::regclass) THEN
              ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_status_check CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired'));
          END IF;
      END $$;
      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_type_check' AND conrelid = 'public.profiles'::regclass) THEN
              ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_type_check CHECK (plan_type IN ('trial', 'starter', 'profissional', 'empresarial'));
          END IF;
      END $$;
      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_plano_check' AND conrelid = 'public.leads'::regclass) THEN
              ALTER TABLE public.leads ADD CONSTRAINT leads_plano_check CHECK (plano IN ('trial', 'starter', 'profissional', 'empresarial'));
          END IF;
      END $$;
    `);
    console.log('  ✅ Bloco 4 (CHECK constraints) — OK');

    // Bloco 5: RLS em leads
    await client.query(`
      ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Leads visível para admin ou próprio" ON public.leads FOR SELECT USING (
          auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
      CREATE POLICY "Leads inserível apenas por admin" ON public.leads FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
      CREATE POLICY "Leads atualizável apenas por admin" ON public.leads FOR UPDATE USING (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
      CREATE POLICY "Leads deletável apenas por admin" ON public.leads FOR DELETE USING (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
    `);
    console.log('  ✅ Bloco 5 (RLS leads) — OK');

    // Bloco 6: Trigger anti-bypass
    await client.query(`
      CREATE OR REPLACE FUNCTION public.prevent_profile_trial_bypass()
      RETURNS trigger AS $$
      BEGIN
          IF auth.role() = 'service_role' THEN RETURN new; END IF;
          IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN RETURN new; END IF;
          IF (
              old.subscription_status IS DISTINCT FROM new.subscription_status
              OR old.plan_type IS DISTINCT FROM new.plan_type
              OR old.trial_used IS DISTINCT FROM new.trial_used
              OR old.trial_analysis_id IS DISTINCT FROM new.trial_analysis_id
              OR old.trial_started_at IS DISTINCT FROM new.trial_started_at
              OR old.trial_ends_at IS DISTINCT FROM new.trial_ends_at
              OR old.lead_id IS DISTINCT FROM new.lead_id
          ) THEN
              RAISE EXCEPTION 'Usuário comum não pode alterar campos de assinatura diretamente. Use o fluxo oficial.';
          END IF;
          RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      DROP TRIGGER IF EXISTS trg_prevent_profile_trial_bypass ON public.profiles;
      CREATE TRIGGER trg_prevent_profile_trial_bypass
          BEFORE UPDATE ON public.profiles
          FOR EACH ROW
          EXECUTE FUNCTION public.prevent_profile_trial_bypass();
    `);
    console.log('  ✅ Bloco 6 (trigger anti-bypass) — OK');
    console.log('✅ 20260607_leads_trial_profiles.sql — OK (executada em partes)\n');

    console.log('=== Migrations ignoradas ===');
    for (const filename of MIGRATIONS_TO_IGNORE) {
      console.log(`⏭️  ${filename}`);
    }
    console.log('');

    // ETAPA 4: Validar estrutura
    console.log('=== ETAPA 4: Validando estrutura ===\n');

    const expectedTables = ['profiles', 'properties', 'documents', 'analyses', 'reports', 'orders', 'payments', 'leads'];
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const existingTables = tablesResult.rows.map(r => r.table_name);
    console.log('Tabelas encontradas:', existingTables.join(', '));

    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        console.log(`✅ ${table} — OK`);
      } else {
        console.log(`❌ ${table} — AUSENTE`);
      }
    }
    console.log('');

    // Validar colunas comerciais em profiles
    console.log('--- Colunas comerciais em profiles ---');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
      ORDER BY ordinal_position;
    `);

    const expectedColumns = [
      'subscription_status', 'plan_type', 'trial_used', 
      'trial_analysis_id', 'trial_started_at', 'trial_ends_at', 'lead_id'
    ];

    const existingColumns = columnsResult.rows.map(r => r.column_name);
    
    for (const col of expectedColumns) {
      if (existingColumns.includes(col)) {
        console.log(`✅ profiles.${col} — OK`);
      } else {
        console.log(`❌ profiles.${col} — AUSENTE`);
      }
    }
    console.log('');

    // Validar colunas de análise complementar
    console.log('--- Colunas complementares em analyses ---');
    const analysesColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'analyses'
      ORDER BY ordinal_position;
    `);

    const expectedAnalysesCols = ['parent_analysis_id', 'analysis_depth', 'complementary_modules'];
    const existingAnalysesCols = analysesColumns.rows.map(r => r.column_name);

    for (const col of expectedAnalysesCols) {
      if (existingAnalysesCols.includes(col)) {
        console.log(`✅ analyses.${col} — OK`);
      } else {
        console.log(`❌ analyses.${col} — AUSENTE`);
      }
    }
    console.log('');

    // Validar RLS policies
    console.log('--- RLS Policies ---');
    const policiesResult = await client.query(`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    for (const row of policiesResult.rows) {
      console.log(`✅ ${row.tablename}: ${row.policyname}`);
    }
    console.log('');

    // Validar triggers
    console.log('--- Triggers ---');
    const triggersResult = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY trigger_name;
    `);

    for (const row of triggersResult.rows) {
      console.log(`✅ ${row.trigger_name} ON ${row.event_object_table} (${row.event_manipulation})`);
    }
    console.log('');

    // Validar índices
    console.log('--- Índices ---');
    const indexesResult = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);

    for (const row of indexesResult.rows) {
      console.log(`✅ ${row.indexname} ON ${row.tablename}`);
    }
    console.log('');

    console.log('=== RESET HML CONCLUÍDO ===');
    console.log(`Tabelas criadas: ${existingTables.length}`);
    console.log(`Migrations aplicadas: ${MIGRATION_ORDER.length}`);
    console.log(`Migrations ignoradas: ${MIGRATIONS_TO_IGNORE.length}`);
    console.log('HML pronto para testes reais!');

  } catch (err) {
    console.error('\n❌ ERRO FATAL:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();