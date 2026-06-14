-- Radar: Assinaturas e controle de trial

CREATE TABLE IF NOT EXISTS public.radar_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  property_ids UUID[] DEFAULT '{}',
  max_properties INTEGER NOT NULL DEFAULT 5,
  price_per_property NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  mp_subscription_id TEXT,
  mp_preapproval_id TEXT
);

CREATE TABLE IF NOT EXISTS public.radar_trial_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  scans_used INTEGER NOT NULL DEFAULT 1,
  max_scans INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_subscriptions_user ON public.radar_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_radar_subscriptions_status ON public.radar_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_radar_trial_user ON public.radar_trial_usage(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_radar_trial_unique ON public.radar_trial_usage(user_id, property_id);

ALTER TABLE public.radar_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_trial_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own radar subscriptions"
  ON public.radar_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own radar trial usage"
  ON public.radar_trial_usage FOR ALL
  USING (auth.uid() = user_id);
