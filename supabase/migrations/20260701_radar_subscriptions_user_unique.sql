-- Radar: UNIQUE em radar_subscriptions.user_id
--
-- Bug latente descoberto em 01/07/2026 (bloco MP Preapproval): o webhook do
-- Radar (Eixo 2.1) e o checkout usam upsert com onConflict:'user_id', mas a
-- migration original (20260614) só criou índice comum — sem constraint UNIQUE,
-- o upsert falharia em runtime no primeiro pagamento real. Nunca disparou
-- porque nenhum pagamento de Radar real passou pelo webhook até hoje.
-- Tabela verificada vazia em produção antes de aplicar (sem risco de duplicata).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'radar_subscriptions_user_id_key'
      AND conrelid = 'public.radar_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.radar_subscriptions
      ADD CONSTRAINT radar_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Preapproval: o MP usa 'paused' quando a cobrança automática falha (cartão
-- recusado etc.) — estado distinto de 'cancelled' (o MP pode retentar e o
-- dunning do cron precisa saber a diferença). Recria o CHECK incluindo-o.
ALTER TABLE public.radar_subscriptions
  DROP CONSTRAINT IF EXISTS radar_subscriptions_status_check;
ALTER TABLE public.radar_subscriptions
  ADD CONSTRAINT radar_subscriptions_status_check
  CHECK (status IN ('active', 'cancelled', 'expired', 'pending', 'paused'));

-- Segundo bug latente do mesmo diagnóstico: o webhook do Radar (Eixo 2.1) e o
-- cron de renovação já escrevem `updated_at`, mas a coluna nunca existiu —
-- nunca explodiu porque a tabela sempre esteve vazia até hoje.
ALTER TABLE public.radar_subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
