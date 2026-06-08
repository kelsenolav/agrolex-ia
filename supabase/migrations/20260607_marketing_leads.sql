-- ============================================================
-- Migration: marketing_leads
-- Data: 07/06/2026
-- Descrição: Tabela de captura estratégica de leads de marketing
--            para CRM, remarketing e conversão futura.
--
-- ATENÇÃO: NÃO EXECUTAR EM PRODUÇÃO SEM AUTORIZAÇÃO EXPLÍCITA.
-- Esta migration é apenas preparação de arquivo versionável.
-- ============================================================

-- ============================================================
-- BLOCO 1: Tabela marketing_leads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id         UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    nome            TEXT NOT NULL,
    email           TEXT NOT NULL,
    whatsapp        TEXT NULL,
    tipo_usuario    TEXT NULL CHECK (
                        tipo_usuario IS NULL OR tipo_usuario IN (
                            'Produtor Rural', 'Advogado', 'Corretor', 'Investidor', 'Outro'
                        )
                    ),
    origem          TEXT NOT NULL DEFAULT 'signup',
    converteu       BOOLEAN NOT NULL DEFAULT false,
    converted_at    TIMESTAMPTZ NULL,
    trial_utilizado BOOLEAN NOT NULL DEFAULT false,
    ultima_atividade TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================
-- BLOCO 2: Constraint de unicidade por email
-- ============================================================

ALTER TABLE public.marketing_leads
    ADD CONSTRAINT marketing_leads_email_unique UNIQUE (email);

-- ============================================================
-- BLOCO 3: Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_marketing_leads_email
    ON public.marketing_leads(email);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_user_id
    ON public.marketing_leads(user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_created_at
    ON public.marketing_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_converteu
    ON public.marketing_leads(converteu);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_origem
    ON public.marketing_leads(origem);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_ultima_atividade
    ON public.marketing_leads(ultima_atividade DESC);

-- ============================================================
-- BLOCO 4: RLS — Row Level Security
-- ============================================================

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas admin pode ver todos os leads de marketing
CREATE POLICY "marketing_leads_select_admin"
ON public.marketing_leads FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- INSERT: apenas service_role (via API Route com SUPABASE_SERVICE_ROLE_KEY)
-- Usuário comum NÃO pode inserir diretamente.
CREATE POLICY "marketing_leads_insert_service"
ON public.marketing_leads FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE: apenas admin
CREATE POLICY "marketing_leads_update_admin"
ON public.marketing_leads FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- DELETE: apenas admin
CREATE POLICY "marketing_leads_delete_admin"
ON public.marketing_leads FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- BLOCO 5: Função de atualização automática de updated_at
-- (reutilizável se necessário no futuro)
-- ============================================================

-- Não adicionamos updated_at separado pois ultima_atividade cumpre esse papel.

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
