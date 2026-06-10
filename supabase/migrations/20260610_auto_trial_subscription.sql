-- Migration: Auto Trial Subscription + Backfill
-- Data: 10/06/2026
-- Descrição: Garante que todo novo usuário receba uma subscription trial real no banco.
-- Isso resolve o problema de "saldo insuficiente no fechamento" onde o getUserSubscription
-- retornava um objeto mockado em memória e o consumePages falhava pois a RPC não encontrava
-- registro real na tabela subscriptions.
--
-- Aplica também backfill para usuários existentes que ainda não possuem subscription.

-- PARTE 1: Gatilho para criar Subscription Trial automaticamente ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user_trial_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_type, status, credits_available, started_at, expires_at)
  VALUES (
    NEW.id,
    'trial',
    'active',
    10,
    timezone('utc'::text, now()),
    timezone('utc'::text, now()) + interval '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

DROP TRIGGER IF EXISTS on_auth_user_created_trial_subscription ON auth.users;

CREATE TRIGGER on_auth_user_created_trial_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_trial_subscription();

-- PARTE 2: Backfill para usuários existentes que ainda não possuem subscription
-- Insere subscription trial para todos os usuários atuais que não têm registro na tabela subscriptions
INSERT INTO public.subscriptions (user_id, plan_type, status, credits_available, started_at, expires_at)
SELECT
  u.id,
  'trial',
  'active',
  10,
  timezone('utc'::text, now()),
  timezone('utc'::text, now()) + interval '30 days'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;