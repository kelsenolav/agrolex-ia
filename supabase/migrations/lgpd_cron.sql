-- ==============================================================
-- AGRILEX V2 - SCRIPT DE BANCO DE DADOS (SUPABASE)
-- ==============================================================
-- Instruções: Copie todo este código e cole no SQL Editor do seu Supabase
-- e clique em "Run".

-- 1. CRIAÇÃO DA COLUNA DE CRÉDITOS B2B
-- Verifica se a coluna 'credits' existe na tabela 'profiles', se não, cria.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='profiles' AND column_name='credits') THEN
        ALTER TABLE profiles ADD COLUMN credits INT DEFAULT 0;
    END IF;
END $$;


-- 2. ROTINA DE EXPURGO LGPD (EXCLUSÃO AUTOMÁTICA APÓS 7 DIAS)
-- Para rodar jobs automáticos, o Supabase usa a extensão pg_cron.
-- Garante que a extensão está ativada.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cria a função de limpeza
CREATE OR REPLACE FUNCTION delete_old_analyses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deleta análises com mais de 7 dias
  -- Obs: Se a constraint ON DELETE CASCADE estiver ativa nas tabelas relacionadas
  -- (ex: documents), os documentos e arquivos atrelados à propriedade também serão deletados
  -- se você deletar a property. Para o MVP, vamos deletar as análises antigas.
  
  DELETE FROM analyses 
  WHERE created_at < NOW() - INTERVAL '7 days';

  -- Deleta documentos físicos do banco com mais de 7 dias
  DELETE FROM documents 
  WHERE created_at < NOW() - INTERVAL '7 days';

END;
$$;

-- Agenda o Cron Job para rodar toda madrugada (03:00 AM)
SELECT cron.schedule(
  'lgpd-purge-job',   -- Nome do job
  '0 3 * * *',        -- Expressão cron (todo dia às 3 da manhã)
  'SELECT delete_old_analyses()' -- Função a ser executada
);

-- ==============================================================
-- FINALIZADO COM SUCESSO!
-- ==============================================================
