-- Migration: 20260613_update_isf_faixa_and_version
-- Descrição: Adiciona 'regular' e 'invalido' à CHECK constraint de isf_faixa
--            e altera isf_version para aceitar valores textuais (ex: '2.2')
-- Contexto: Correção do motor ISF v2.2 — divergência de score entre dashboard e laudo

-- 1. Remover a CHECK constraint antiga de isf_faixa e recriar com novos valores
ALTER TABLE public.analyses
  DROP CONSTRAINT IF EXISTS analyses_isf_faixa_check;

ALTER TABLE public.analyses
  ADD CONSTRAINT analyses_isf_faixa_check
  CHECK (isf_faixa IN ('muito_seguro', 'seguro', 'regular', 'atencao', 'alto_risco', 'critico', 'invalido'));

-- 2. Alterar isf_version de INTEGER para aceitar strings como '2.1', '2.2'
--    (Usando USING para converter valores existentes)
ALTER TABLE public.analyses
  ALTER COLUMN isf_version DROP DEFAULT,
  ALTER COLUMN isf_version DROP NOT NULL,
  ALTER COLUMN isf_version TYPE TEXT USING isf_version::TEXT;