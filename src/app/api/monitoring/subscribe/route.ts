import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

    const body = await req.json();
    const { propertyId, activate } = body;
    if (!propertyId) return NextResponse.json({ error: 'propertyId obrigatório' }, { status: 400 });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: property } = await adminClient
      .from('properties')
      .select('id, user_id')
      .eq('id', propertyId)
      .single();

    if (!property || property.user_id !== user.id) {
      return NextResponse.json({ error: 'Propriedade não encontrada ou acesso negado' }, { status: 403 });
    }

    await adminClient.from('properties')
      .update({ is_monitoring: activate !== false })
      .eq('id', propertyId);

    return NextResponse.json({ success: true, is_monitoring: activate !== false });
  } catch (err: any) {
    console.error('[Monitoring Subscribe]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
