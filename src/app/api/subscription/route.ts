import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSubscription } from '@/lib/subscriptions';

export async function GET(req: Request) {
  try {
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
       return NextResponse.json({ error: 'Sessão inválida.' }, { status: 403 });
    }

    const subscription = await getUserSubscription(user.id);

    return NextResponse.json(subscription);
  } catch (err) {
    console.error('Erro na API de subscription:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
