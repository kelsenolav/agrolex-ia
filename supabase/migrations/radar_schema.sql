-- ==============================================================
-- AGRILEX V3 - SCRIPT DO RADAR FUNDIÁRIO CONTÍNUO (CORREÇÃO)
-- ==============================================================
-- Instruções: Copie este código e cole no SQL Editor do seu Supabase.
-- Ele garantirá que todas as colunas sejam criadas corretamente.

DO $$ 
BEGIN 
    -- 1. Cria is_monitoring
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='is_monitoring') THEN
        ALTER TABLE properties ADD COLUMN is_monitoring BOOLEAN DEFAULT FALSE;
    END IF;

    -- 2. Cria cpf_cnpj
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='cpf_cnpj') THEN
        ALTER TABLE properties ADD COLUMN cpf_cnpj VARCHAR(20);
    END IF;

    -- 3. Cria car_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='car_number') THEN
        ALTER TABLE properties ADD COLUMN car_number VARCHAR(100);
    END IF;
END $$;

-- 4. CRIAR A TABELA DE ALERTAS DO RADAR
CREATE TABLE IF NOT EXISTS radar_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'Alto',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Segurança) na nova tabela
ALTER TABLE radar_alerts ENABLE ROW LEVEL SECURITY;

-- Política: Usuário só pode ver seus próprios alertas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'radar_alerts' AND policyname = 'Users can view own alerts') THEN
        CREATE POLICY "Users can view own alerts" ON radar_alerts FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'radar_alerts' AND policyname = 'Users can insert own alerts') THEN
        CREATE POLICY "Users can insert own alerts" ON radar_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
