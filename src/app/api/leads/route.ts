import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !serviceKey || !anonKey) {
      return NextResponse.json({ error: 'Configuração do servidor ausente.' }, { status: 500 });
    }

    // ─── Autenticação: cookie server client primeiro, fallback Bearer com anon key ───
    let user: any = null;

    // 1. Tentar obter o usuário usando o cliente de servidor com base em cookies
    try {
      const { createSupabaseServerClient } = await import('@/lib/supabaseServer');
      const supabaseUser = await createSupabaseServerClient();
      const { data: { user: cookieUser } } = await supabaseUser.auth.getUser();
      if (cookieUser) {
        user = cookieUser;
      }
    } catch (cookieErr) {
      // Ignorar e tentar fallback via header
    }

    // 2. Fallback resiliente: validar via cabeçalho Authorization se o cookie falhar
    if (!user) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      if (!token) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
      }

      // IMPORTANTE: Usar chave anônima pública para validar JWT de usuário comum
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
        console.warn('[Leads API] Falha ao recuperar usuário via JWT:', userError?.message);
        return NextResponse.json({ error: 'Sessão inválida ou incompatível.' }, { status: 403 });
      }
      user = headerUser;
    }

    // ─── Validação: user_id no body deve corresponder ao usuário autenticado ───
    if (user.id !== body.user_id) {
      return NextResponse.json({ error: 'Sessão inválida ou incompatível.' }, { status: 403 });
    }

    // ─── Upsert no banco usando service_role (apenas para gravação) ───
    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Apenas campos seguros
    const payload = {
      user_id: user.id,
      nome: body.nome,
      email: body.email,
      telefone: body.telefone || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      origem: body.origem || 'nova-analise',
    };

    const { error } = await supabaseAdmin
      .from('leads')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.error('Erro no admin upsert leads:', error);
      return NextResponse.json({ 
        error: error.message || 'Erro ao salvar os dados no banco.',
        details: error.details || '',
        code: error.code || '',
        hint: error.hint || ''
      }, { status: 500 });
    }

    // Integrar resilientemente com marketing_leads
    try {
      await supabaseAdmin
        .from('marketing_leads')
        .upsert({
          user_id: user.id,
          nome: payload.nome,
          email: payload.email,
          whatsapp: payload.telefone,
          origem: 'nova-analise',
          ultima_atividade: new Date().toISOString()
        }, { onConflict: 'email' });
    } catch (mktErr) {
      console.warn('Aviso fail-safe: erro ao espelhar em marketing_leads:', mktErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Erro na API leads:', err);
    return NextResponse.json({ 
      error: err.message || 'Erro interno.',
      details: err.stack || '',
      code: '',
      hint: ''
    }, { status: 500 });
  }
}