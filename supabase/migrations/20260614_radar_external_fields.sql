-- Radar v2: Campos para consultas externas e monitoramento
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_monitoring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS car_code TEXT,
  ADD COLUMN IF NOT EXISTS ccir TEXT,
  ADD COLUMN IF NOT EXISTS sigef_code TEXT,
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS matricula_number TEXT,
  ADD COLUMN IF NOT EXISTS registry_office TEXT;

-- Novos tipos de alerta suportados
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_alert_type ON public.monitoring_alerts(alert_type);

-- Índice para consultas de cron (propriedades monitoradas)
CREATE INDEX IF NOT EXISTS idx_properties_is_monitoring ON public.properties(is_monitoring) WHERE is_monitoring = true;
