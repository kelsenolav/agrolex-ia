-- =================================================================================
-- Hotfix: Adiciona UNIQUE constraint na coluna user_id da tabela public.leads
-- =================================================================================
-- Contexto: A API /api/leads usa upsert com "onConflict: 'user_id'".
-- O Postgres exige um índice único para resolver conflitos de upsert.
--
-- ATENÇÃO ADMINISTRADOR: ANTES DE RODAR ESTA MIGRATION, VERIFIQUE DUPLICATAS!
-- Execute a query abaixo no SQL Editor do Supabase:
--
-- SELECT user_id, COUNT(*)
-- FROM public.leads
-- WHERE user_id IS NOT NULL
-- GROUP BY user_id
-- HAVING COUNT(*) > 1;
--
-- Se a query acima retornar resultados, você possui leads duplicados.
-- Remova as duplicatas manualmente antes de aplicar esta migration.
-- =================================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_user_id_key'
      AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_user_id_key UNIQUE (user_id);
  END IF;
END $$;
