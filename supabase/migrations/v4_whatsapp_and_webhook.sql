-- ==============================================================
-- AGRILEX V4.2 - SUPORTE A NOTIFICAÇÕES WHATSAPP E WEBHOOKS
-- ==============================================================

DO $$ 
BEGIN 
    -- 1. Adiciona coluna whatsapp na tabela profiles se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='whatsapp') THEN
        ALTER TABLE public.profiles ADD COLUMN whatsapp VARCHAR(20);
    END IF;

    -- 2. Adiciona coluna webhook_url na tabela profiles se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='webhook_url') THEN
        ALTER TABLE public.profiles ADD COLUMN webhook_url TEXT;
    END IF;
END $$;
