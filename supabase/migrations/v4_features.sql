-- ==============================================================
-- AGRILEX V4 - SUPER APP AGRO B2B
-- ==============================================================

-- 1. SCORE DE RISCO E FLAG DE DATA ROOM
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='risk_score') THEN
        ALTER TABLE properties ADD COLUMN risk_score INT DEFAULT 1000; -- Score inicial máximo
    END IF;

    -- Na tabela de documentos, adicionamos uma flag para identificar o que é do Cofre (Data Room)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='is_data_room') THEN
        ALTER TABLE documents ADD COLUMN is_data_room BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. TABELA DE FORNECEDORES (FRIGORÍFICOS / TRADINGS)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(20) NOT NULL, -- CPF ou CNPJ
    status VARCHAR(50) DEFAULT 'Pendente', -- 'Liberado', 'Bloqueado', 'Pendente'
    last_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE CONDICIONANTES AMBIENTAIS (CALENDÁRIO)
CREATE TABLE IF NOT EXISTS environmental_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    amount DECIMAL(10, 2) DEFAULT 0, -- Valor financeiro da obrigação
    status VARCHAR(20) DEFAULT 'Pendente', -- 'Pendente', 'Concluído', 'Atrasado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SEGURANÇA (RLS) E PERMISSÕES
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE environmental_tasks ENABLE ROW LEVEL SECURITY;

-- Garantir acesso para os usuários autenticados da API Supabase
GRANT ALL ON TABLE suppliers TO anon, authenticated, service_role;
GRANT ALL ON TABLE environmental_tasks TO anon, authenticated, service_role;

DO $$
BEGIN
    -- Fornecedores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Users can view own suppliers') THEN
        CREATE POLICY "Users can view own suppliers" ON suppliers FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Users can insert own suppliers') THEN
        CREATE POLICY "Users can insert own suppliers" ON suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Users can update own suppliers') THEN
        CREATE POLICY "Users can update own suppliers" ON suppliers FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- Tarefas
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'environmental_tasks' AND policyname = 'Users can view own tasks') THEN
        CREATE POLICY "Users can view own tasks" ON environmental_tasks FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'environmental_tasks' AND policyname = 'Users can insert own tasks') THEN
        CREATE POLICY "Users can insert own tasks" ON environmental_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'environmental_tasks' AND policyname = 'Users can update own tasks') THEN
        CREATE POLICY "Users can update own tasks" ON environmental_tasks FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;
