import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSubscription } from '@/lib/subscriptions';

export async function GET(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Configuração do servidor ausente.' }, { status: 500 });
    }

    let user: any = null;
    let supabaseClient: any = null;

    // 1. Tentar obter o usuário usando o cliente de servidor com base em cookies
    try {
      const { createSupabaseServerClient } = await import('@/lib/supabaseServer');
      const supabaseUser = await createSupabaseServerClient();
      const { data: { user: cookieUser } } = await supabaseUser.auth.getUser();
      if (cookieUser) {
        user = cookieUser;
        supabaseClient = supabaseUser;
      }
    } catch (cookieErr) {
      // Ignorar e tentar fallback via header
    }

    // 2. Fallback resiliente: validar via cabeçalho Authorization se o cookie falhar/não existir
    if (!user) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        console.log('[Subscription API] Cabeçalho Authorization ausente.');
        return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      if (!token) {
        console.log('[Subscription API] Token Bearer ausente ou vazio.');
        return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
      }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) {
        return NextResponse.json({ error: 'Configuração do cliente ausente.' }, { status: 500 });
      }

      // IMPORTANTE: Criamos o cliente usando a chave anônima pública para validar o token JWT de usuário
      const supabaseUserClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });

      const { data: { user: headerUser }, error: userError } = await supabaseUserClient.auth.getUser();
      if (userError || !headerUser) {
        console.warn('[Subscription API] Falha ao recuperar usuário via JWT:', userError?.message);
        return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
      }
      user = headerUser;
      supabaseClient = supabaseUserClient;
      console.log('[Subscription API] Usuário autenticado com sucesso via Token Bearer.');
    }

    const subscription = await getUserSubscription(user.id, supabaseClient);

    return NextResponse.json(subscription);
  } catch (err) {
    console.error('Erro na API de subscription:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
