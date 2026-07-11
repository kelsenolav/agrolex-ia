-- ==============================================================
-- ZWIPE — BUSCAS DE COMPRA (CRUZAMENTO AUTOMÁTICO)
-- ==============================================================
-- Em vez do comprador navegar por todos os anúncios, ele cadastra o que
-- procura (categoria + região) e o sistema mostra só os anúncios que batem
-- com essa busca. Rode este arquivo depois do 00000_init.sql.

CREATE TABLE public.buy_intents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Imóveis', 'Veículos', 'Máquinas e Equipamentos', 'Eletrônicos', 'Móveis e Casa', 'Outros')),
    city TEXT,
    state TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.buy_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compradores veem as próprias buscas"
ON public.buy_intents FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Compradores cadastram as próprias buscas"
ON public.buy_intents FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Compradores excluem as próprias buscas"
ON public.buy_intents FOR DELETE USING (auth.uid() = buyer_id);
