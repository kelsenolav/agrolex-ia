-- Habilita extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criação da tabela de Perfis (Profiles)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver o próprio perfil" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar o próprio perfil" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Criação da tabela de Propriedades (Fazendas)
CREATE TABLE public.properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    area DECIMAL(10, 2), -- em hectares
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em Properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver as próprias propriedades" 
ON public.properties FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir as próprias propriedades" 
ON public.properties FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar as próprias propriedades" 
ON public.properties FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar as próprias propriedades" 
ON public.properties FOR DELETE USING (auth.uid() = user_id);

-- Criação da tabela de Documentos (Documents)
CREATE TABLE public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    document_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver os próprios documentos" 
ON public.documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir os próprios documentos" 
ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar os próprios documentos" 
ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- Criação da tabela de Análises da IA (Analyses)
CREATE TABLE public.analyses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    risk_level TEXT CHECK (risk_level IN ('baixo', 'medio', 'alto')),
    findings JSONB DEFAULT '{}'::jsonb,
    raw_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em Analyses
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver as próprias análises" 
ON public.analyses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir as próprias análises" 
ON public.analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Criação da tabela de Relatórios (Reports)
CREATE TABLE public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    summary TEXT,
    recommendations TEXT,
    missing_docs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver os próprios relatórios" 
ON public.reports FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir os próprios relatórios" 
ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gatilho para criar Perfil automaticamente ao cadastrar usuário no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Configuração do Storage para os PDFs
-- (Esses comandos precisam ser rodados ou configurados manualmente na interface do Supabase em alguns casos, mas deixamos aqui como referência/SQL)
-- OBS: A tabela auth e storage não devem ser alteradas diretamente, mas em buckets do Supabase.
-- Abaixo um exemplo simplificado de criação do bucket via SQL caso haja suporte na versão atual.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS do Storage
CREATE POLICY "Usuários podem fazer upload em documents" 
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'documents' AND auth.uid() = owner
);

CREATE POLICY "Usuários podem ler seus documentos" 
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'documents' AND auth.uid() = owner
);
