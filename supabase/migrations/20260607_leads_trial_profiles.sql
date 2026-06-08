-- Migration Comercial P0 — Leads, Trial e Campos de Assinatura em Profiles
-- Data: 07/06/2026
-- Descrição:
--   1. Cria tabela public.leads para captura de leads comerciais
--   2. Adiciona campos de subscription/trial em public.profiles
--   3. Adiciona constraints CHECK seguras
--   4. Ativa RLS em leads com políticas restritivas
--   5. Cria trigger de proteção anti-bypass em profiles
--   6. Prepara substituição segura da trigger handle_new_user (COMENTADA)
--
-- ATENÇÃO: NÃO EXECUTAR EM PRODUÇÃO SEM AUTORIZAÇÃO EXPLÍCITA.
-- Esta migration é apenas preparação de arquivo versionável.

-- ============================================================
-- BLOCO 1: Tabela de Leads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
    lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    cidade TEXT,
    estado TEXT,
    origem TEXT DEFAULT 'trial',
    primeira_analise_id UUID NULL REFERENCES public.analyses(id) ON DELETE SET NULL,
    isf_resultado INTEGER NULL,
    converteu BOOLEAN DEFAULT false,
    converted_at TIMESTAMPTZ NULL,
    plano TEXT DEFAULT 'trial',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BLOCO 2: Índices em leads
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_converteu ON public.leads(converteu);
CREATE INDEX IF NOT EXISTS idx_leads_plano ON public.leads(plano);

-- ============================================================
-- BLOCO 3: Campos de assinatura/trial em profiles
-- ============================================================
-- NOTA: credits NÃO é adicionado aqui porque já existe na tabela.
-- Se não existir, será adicionado em migration separada.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS trial_analysis_id UUID NULL REFERENCES public.analyses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
    ADD COLUMN IF NOT EXISTS lead_id UUID NULL REFERENCES public.leads(lead_id) ON DELETE SET NULL;

-- ============================================================
-- BLOCO 2.5: Índice para trial_analysis_id em profiles
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_trial_analysis_id
ON public.profiles(trial_analysis_id);

-- ============================================================
-- BLOCO 3.5: Garantir NOT NULL e valores padrão em subscription_status e plan_type
-- ============================================================
-- Protege contra NULLs: registros existentes que não receberam o DEFAULT
-- (ex: profiles criados antes desta migration, ou inserções que forçaram NULL)

UPDATE public.profiles
SET subscription_status = 'trial'
WHERE subscription_status IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN subscription_status SET NOT NULL,
    ALTER COLUMN subscription_status SET DEFAULT 'trial';

UPDATE public.profiles
SET plan_type = 'trial'
WHERE plan_type IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN plan_type SET NOT NULL,
    ALTER COLUMN plan_type SET DEFAULT 'trial';

-- ============================================================
-- BLOCO 4: Constraints CHECK seguras
-- ============================================================
-- Abordagem: verificar se a constraint já existe antes de criar,
-- usando DO bloco para evitar erro se já existir.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_subscription_status_check'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_subscription_status_check
            CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_plan_type_check'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_plan_type_check
            CHECK (plan_type IN ('trial', 'starter', 'profissional', 'empresarial'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leads_plano_check'
        AND conrelid = 'public.leads'::regclass
    ) THEN
        ALTER TABLE public.leads
            ADD CONSTRAINT leads_plano_check
            CHECK (plano IN ('trial', 'starter', 'profissional', 'empresarial'));
    END IF;
END $$;

-- ============================================================
-- BLOCO 5: RLS em leads
-- ============================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Política SELECT: próprio usuário OU admin
CREATE POLICY "Leads visível para admin ou próprio"
ON public.leads FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Política INSERT: apenas admin ou sistema (service_role)
-- Usuário comum NÃO pode inserir lead diretamente.
-- A inserção deve ser feita via trigger SECURITY DEFINER ou admin.
CREATE POLICY "Leads inserível apenas por admin"
ON public.leads FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Política UPDATE: apenas admin
CREATE POLICY "Leads atualizável apenas por admin"
ON public.leads FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Política DELETE: apenas admin
CREATE POLICY "Leads deletável apenas por admin"
ON public.leads FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- BLOCO 6: Proteção anti-bypass em profiles
-- ============================================================
-- Impede que usuário comum altere campos críticos de assinatura
-- diretamente via UPDATE na tabela profiles.
-- Permite alteração apenas por admin ou operação SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.prevent_profile_trial_bypass()
RETURNS trigger AS $$
BEGIN
    -- ============================================================
    -- Permissão 1: Operação via service_role (SECURITY DEFINER, triggers do sistema, webhooks)
    -- ============================================================
    -- auth.role() retorna 'service_role' quando a operação vem de contexto
    -- SECURITY DEFINER (ex: handle_new_user) ou service_role direto.
    -- Isso garante que o sistema (ex: ativação de trial, webhook Mercado Pago)
    -- consiga alterar campos críticos sem ser bloqueado.
    IF auth.role() = 'service_role' THEN
        RETURN new;
    END IF;

    -- ============================================================
    -- Permissão 2: Usuário com role = 'admin'
    -- ============================================================
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RETURN new;
    END IF;

    -- ============================================================
    -- Bloqueio: Usuário comum tentando alterar campos críticos
    -- ============================================================
    IF (
        old.subscription_status IS DISTINCT FROM new.subscription_status
        OR old.plan_type IS DISTINCT FROM new.plan_type
        OR old.trial_used IS DISTINCT FROM new.trial_used
        OR old.trial_analysis_id IS DISTINCT FROM new.trial_analysis_id
        OR old.trial_started_at IS DISTINCT FROM new.trial_started_at
        OR old.trial_ends_at IS DISTINCT FROM new.trial_ends_at
        OR old.lead_id IS DISTINCT FROM new.lead_id
    ) THEN
        RAISE EXCEPTION 'Usuário comum não pode alterar campos de assinatura diretamente. Use o fluxo oficial.';
    END IF;

    -- ============================================================
    -- Permitido: alterações em campos não-comerciais (nome, email, telefone, avatar_url, etc.)
    -- ============================================================
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger existente se houver para recriar limpa
DROP TRIGGER IF EXISTS trg_prevent_profile_trial_bypass ON public.profiles;

CREATE TRIGGER trg_prevent_profile_trial_bypass
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_trial_bypass();

-- ============================================================
-- BLOCO 7: Trigger handle_new_user (COMENTADA — ALTO RISCO)
-- ============================================================
-- ATENÇÃO: A trigger handle_new_user atual (em 00000_init.sql) é:
--
--   CREATE OR REPLACE FUNCTION public.handle_new_user()
--   RETURNS trigger AS $$
--   BEGIN
--     INSERT INTO public.profiles (id, name, email)
--     VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
--     RETURN new;
--   END;
--   $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- RISCOS de alterar esta trigger:
--   1. Se a inserção em leads falhar (ex: constraint violation),
--      o profile NÃO será criado e o cadastro do usuário quebrará.
--   2. Usuários existentes (sem lead) podem ter conflito se a trigger
--      tentar criar lead com email já existente.
--   3. A trigger atual funciona em produção. Substituí-la sem backfill
--      prévio pode causar falhas em cascata.
--
-- RECOMENDAÇÃO: Não alterar a trigger agora. Em vez disso:
--   a) Executar backfill de leads para usuários existentes primeiro
--   b) Criar leadService.ts para criar leads via SECURITY DEFINER
--   c) Só então substituir a trigger, com fallback seguro
--
-- Abaixo, a nova versão COMENTADA para referência futura:

-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- DECLARE
--   new_lead_id UUID;
--   trial_end TIMESTAMPTZ;
-- BEGIN
--   -- Calcular fim do trial (7 dias)
--   trial_end := now() + interval '7 days';
--
--   -- Inserir lead (com fallback: se falhar, profile ainda é criado)
--   BEGIN
--     INSERT INTO public.leads (user_id, nome, email, origem)
--     VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'), new.email, 'cadastro')
--     RETURNING lead_id INTO new_lead_id;
--   EXCEPTION
--     WHEN OTHERS THEN
--       new_lead_id := NULL;
--   END;
--
--   -- Inserir profile com trial
--   INSERT INTO public.profiles (
--     id, name, email,
--     subscription_status, plan_type,
--     trial_started_at, trial_ends_at, lead_id
--   ) VALUES (
--     new.id,
--     COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
--     new.email,
--     'trial', 'trial',
--     now(), trial_end, new_lead_id
--   );
--
--   RETURN new;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================