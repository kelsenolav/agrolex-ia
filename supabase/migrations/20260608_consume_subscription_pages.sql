-- Migration para suporte a débito variável de páginas
-- Data: 2026-06-08

CREATE OR REPLACE FUNCTION public.consume_subscription_pages(
    user_id_param UUID, 
    pages_count INT
)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INT;
BEGIN
    -- Validação inicial de segurança
    IF pages_count <= 0 THEN
        RETURN FALSE;
    END IF;

    -- Atualiza e debita de forma atômica
    UPDATE public.subscriptions
    SET credits_available = credits_available - pages_count
    WHERE user_id = user_id_param
      AND status = 'active'
      AND credits_available >= pages_count;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    -- Retorna TRUE se a linha foi afetada (saldo era suficiente e ativo)
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
