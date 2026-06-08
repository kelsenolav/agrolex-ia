-- Migration: 20260608_add_isf_v2_fields
-- Descrição: Adiciona campos do ISF v2 à tabela analyses
-- Estratégia: Híbrido (colunas + JSONB)

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS isf_score INTEGER CHECK (isf_score >= 0 AND isf_score <= 100),
  ADD COLUMN IF NOT EXISTS isf_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS isf_faixa TEXT CHECK (isf_faixa IN ('muito_seguro', 'seguro', 'atencao', 'alto_risco', 'critico')),
  ADD COLUMN IF NOT EXISTS isf_eixos JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS isf_explainer JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS isf_achados JSONB DEFAULT '[]'::jsonb;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_analyses_isf_score ON public.analyses (isf_score);
CREATE INDEX IF NOT EXISTS idx_analyses_isf_faixa ON public.analyses (isf_faixa);
CREATE INDEX IF NOT EXISTS idx_analyses_isf_version ON public.analyses (isf_version);
