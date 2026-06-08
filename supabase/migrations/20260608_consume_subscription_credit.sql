-- Migration: consume_subscription_credit
-- Data: 08/06/2026
-- Descrição: Cria a função RPC consume_subscription_credit para decremento atômico de créditos.

CREATE OR REPLACE FUNCTION public.consume_subscription_credit(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INT;
BEGIN
    UPDATE public.subscriptions
    SET credits_available = credits_available - 1
    WHERE user_id = user_id_param
      AND status = 'active'
      AND credits_available > 0;
      
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
