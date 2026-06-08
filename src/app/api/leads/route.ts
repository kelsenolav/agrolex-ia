import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Auth Check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Configuração do servidor ausente.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validar quem está chamando (opcional, mas recomendado para segurança)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user || user.id !== body.user_id) {
       return NextResponse.json({ error: 'Sessão inválida ou incompatível.' }, { status: 403 });
    }

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
      console.error('Erro no admin upsert:', error);
      return NextResponse.json({ 
        error: error.message || 'Erro ao salvar os dados no banco.',
        details: error.details || '',
        code: error.code || '',
        hint: error.hint || ''
      }, { status: 500 });
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
