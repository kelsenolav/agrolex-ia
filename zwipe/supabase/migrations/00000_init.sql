-- ==============================================================
-- ZWIPE — SCHEMA INICIAL
-- ==============================================================
-- Instruções: copie este arquivo inteiro e cole no SQL Editor
-- do seu projeto Supabase (Settings > SQL Editor > New Query > Run).

-- Perfis (1 linha por usuário, criada automaticamente no cadastro)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    whatsapp VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver qualquer perfil"
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Usuários podem atualizar o próprio perfil"
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Gatilho para criar o Perfil automaticamente ao cadastrar no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, whatsapp)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'whatsapp'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Anúncios (o que está à venda)
CREATE TABLE public.listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('Imóveis', 'Veículos', 'Máquinas e Equipamentos', 'Eletrônicos', 'Móveis e Casa', 'Outros')),
    price NUMERIC(12, 2),
    city TEXT,
    state TEXT,
    photos TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'sold')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ver anúncios ativos, dono vê os próprios sempre"
ON public.listings FOR SELECT USING (status = 'active' OR auth.uid() = seller_id);

CREATE POLICY "Usuários podem criar os próprios anúncios"
ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Usuários podem atualizar os próprios anúncios"
ON public.listings FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Usuários podem excluir os próprios anúncios"
ON public.listings FOR DELETE USING (auth.uid() = seller_id);

-- Swipes (interesse do comprador num anúncio)
CREATE TABLE public.swipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (listing_id, buyer_id)
);

ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compradores veem os próprios swipes, vendedores veem quem curtiu seus anúncios"
ON public.swipes FOR SELECT USING (
  auth.uid() = buyer_id
  OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

CREATE POLICY "Compradores podem registrar os próprios swipes"
ON public.swipes FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Compradores podem re-swipar (atualizar direção)"
ON public.swipes FOR UPDATE USING (auth.uid() = buyer_id);

-- Matches (decisão do vendedor sobre um comprador interessado)
CREATE TABLE public.matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_decision TEXT NOT NULL CHECK (seller_decision IN ('accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (listing_id, buyer_id)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comprador ou vendedor envolvidos veem o match"
ON public.matches FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Só o vendedor do anúncio cria o match"
ON public.matches FOR INSERT WITH CHECK (
  auth.uid() = seller_id
  AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

-- Segunda policy de SELECT em listings (permissivas se somam por OR): garante que o
-- comprador com match aceito continue vendo o anúncio mesmo que ele saia de 'active'
-- (vendido/pausado) depois do match.
CREATE POLICY "Compradores com match aceito continuam vendo o anúncio"
ON public.listings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.listing_id = id AND m.buyer_id = auth.uid() AND m.seller_decision = 'accepted'
  )
);

-- Storage para fotos dos anúncios (bucket público — exibição direta sem signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Usuários autenticados podem enviar fotos de anúncios"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'listing-photos' AND auth.uid() = owner
);

CREATE POLICY "Donos podem excluir as próprias fotos de anúncios"
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'listing-photos' AND auth.uid() = owner
);

CREATE POLICY "Qualquer um pode ver fotos de anúncios"
ON storage.objects FOR SELECT USING (bucket_id = 'listing-photos');
