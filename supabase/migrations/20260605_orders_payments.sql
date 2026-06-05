-- Migration: Tabelas de Orders e Payments para FASE 4 (Checkout Modular)
-- Data: 05/06/2026
-- Descrição: Cria tabelas orders e payments para rastrear transações
-- de pagamento via Mercado Pago (sandbox inicialmente).

-- Tabela de Orders (pedidos de pagamento)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    analysis_id UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
    payment_method TEXT,
    preference_id TEXT,
    payment_id TEXT,
    sandbox BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS em Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver os próprios pedidos"
ON public.orders FOR SELECT USING (auth.uid() = user_id);

-- Tabela de Payments (registro de transações do provedor)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'mercadopago',
    provider_payment_id TEXT,
    status TEXT,
    status_detail TEXT,
    payment_type_id TEXT,
    installments INT DEFAULT 1,
    raw_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver os próprios pagamentos"
ON public.payments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = payments.order_id
        AND orders.user_id = auth.uid()
    )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_analysis_id ON public.orders(analysis_id);
CREATE INDEX IF NOT EXISTS idx_orders_preference_id ON public.orders(preference_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);