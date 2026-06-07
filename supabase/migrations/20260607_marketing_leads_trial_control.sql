-- ============================================================
-- Migration Sugerida: marketing_leads_trial_control
-- Data: 07/06/2026
-- Descrição: Adiciona colunas para controle refinado de Trial e
--            conversões na tabela marketing_leads.
--
-- ATENÇÃO: NÃO EXECUTAR ESTA MIGRATION EM PRODUÇÃO SEM AUTORIZAÇÃO.
-- ============================================================

ALTER TABLE public.marketing_leads 
    ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS trial_analysis_id UUID NULL;

-- NOTA: converted_at já está presente no schema inicial de marketing_leads,
-- mas caso não exista, pode ser adicionado com a linha abaixo:
-- ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ NULL;
