-- Migration: Adiciona suporte a análises complementares (FASE 2)
-- Data: 05/06/2026
-- Descrição: Permite que análises filhas sejam vinculadas a uma análise pai,
-- formando uma cadeia de aprofundamento (parent_analysis_id).
-- Também adiciona analysis_depth para rastrear profundidade e
-- complementary_modules para armazenar quais módulos foram adicionados.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS parent_analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS analysis_depth INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS complementary_modules TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_analyses_parent ON analyses(parent_analysis_id);