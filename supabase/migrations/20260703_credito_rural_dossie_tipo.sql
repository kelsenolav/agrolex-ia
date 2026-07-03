-- Dossiê de Conformidade CMN 5.193 (aposta 2): novo tipo de análise persistida.

ALTER TABLE public.credito_rural_analises
  DROP CONSTRAINT IF EXISTS credito_rural_analises_tipo_check;
ALTER TABLE public.credito_rural_analises
  ADD CONSTRAINT credito_rural_analises_tipo_check
  CHECK (tipo IN ('elegibilidade', 'defesa', 'ambiental', 'dossie'));
