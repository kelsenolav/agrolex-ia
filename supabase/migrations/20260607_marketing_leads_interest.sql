-- ============================================================
-- Migration Sugerida: marketing_leads_interest
-- Data: 07/06/2026
-- Descrição: Adiciona campos de interesse comercial e status de
--            fila para remarketing e conversão futura.
--
-- ATENÇÃO: NÃO EXECUTAR ESTA MIGRATION EM PRODUÇÃO SEM AUTORIZAÇÃO.
-- ============================================================

ALTER TABLE public.marketing_leads
    ADD COLUMN IF NOT EXISTS interest_registered BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS interest_registered_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS interest_plan TEXT NULL,
    ADD COLUMN IF NOT EXISTS interest_volume TEXT NULL,
    ADD COLUMN IF NOT EXISTS interest_status TEXT DEFAULT 'Novo';

-- Opcional: Adiciona constraint check para garantir integridade do status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'marketing_leads_interest_status_check'
        AND conrelid = 'public.marketing_leads'::regclass
    ) THEN
        ALTER TABLE public.marketing_leads
            ADD CONSTRAINT marketing_leads_interest_status_check
            CHECK (interest_status IN ('Novo', 'Contato Realizado', 'Qualificado', 'Aguardando Mercado Pago', 'Convertido'));
    END IF;
END $$;
