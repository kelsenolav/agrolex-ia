-- Radar de Monitoramento Fundiário v1
-- Tabela de alertas de monitoramento
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colunas de controle de monitoramento na tabela properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS last_radar_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_radar_isf_score INTEGER,
  ADD COLUMN IF NOT EXISTS last_radar_analysis_id UUID;

-- Índices
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_user_id ON public.monitoring_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_property_id ON public.monitoring_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_is_read ON public.monitoring_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_at ON public.monitoring_alerts(created_at DESC);

-- RLS
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own monitoring alerts"
  ON public.monitoring_alerts FOR ALL
  USING (auth.uid() = user_id);
