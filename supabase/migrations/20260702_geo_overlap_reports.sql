-- Análise de Sobreposição Georreferenciada (aposta 1 — spec 2026-07-02)

CREATE TABLE IF NOT EXISTS public.geo_overlap_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  car_code TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_overlap_user ON public.geo_overlap_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_overlap_car ON public.geo_overlap_reports(car_code);

ALTER TABLE public.geo_overlap_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'geo_overlap_reports' AND policyname = 'Users manage own overlap reports'
  ) THEN
    CREATE POLICY "Users manage own overlap reports"
      ON public.geo_overlap_reports FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT ALL ON public.geo_overlap_reports TO authenticated, service_role;
