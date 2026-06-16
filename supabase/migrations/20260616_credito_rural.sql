-- ─── Crédito Rural — Persistência de análises ───────────────────────────────
-- Armazena cada diagnóstico (elegibilidade, defesa, ambiental) com input e
-- resultado, vinculado ao usuário e (opcionalmente) à propriedade.

CREATE TABLE IF NOT EXISTS public.credito_rural_analises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('elegibilidade', 'defesa', 'ambiental')),
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  faixa TEXT,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado JSONB NOT NULL DEFAULT '{}'::jsonb,
  parametros_vigencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credito_rural_user ON public.credito_rural_analises(user_id);
CREATE INDEX IF NOT EXISTS idx_credito_rural_property ON public.credito_rural_analises(property_id);
CREATE INDEX IF NOT EXISTS idx_credito_rural_tipo ON public.credito_rural_analises(tipo);
CREATE INDEX IF NOT EXISTS idx_credito_rural_created ON public.credito_rural_analises(created_at DESC);

-- ─── Grants (necessário p/ RLS no Supabase quando a tabela é criada via SQL) ─

GRANT SELECT, INSERT, DELETE ON public.credito_rural_analises TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.credito_rural_analises TO service_role;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.credito_rural_analises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credito_rural_select_own" ON public.credito_rural_analises;
CREATE POLICY "credito_rural_select_own" ON public.credito_rural_analises
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "credito_rural_insert_own" ON public.credito_rural_analises;
CREATE POLICY "credito_rural_insert_own" ON public.credito_rural_analises
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "credito_rural_delete_own" ON public.credito_rural_analises;
CREATE POLICY "credito_rural_delete_own" ON public.credito_rural_analises
  FOR DELETE USING (auth.uid() = user_id);
