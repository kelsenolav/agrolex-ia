import { NextResponse } from 'next/server';
import { createSupabaseUserClient } from '@/lib/supabaseServerUser';

export async function POST(req: Request) {
  try {
    const supabaseUser = createSupabaseUserClient(req.headers.get('Authorization'));
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const linkId = typeof body.linkId === 'string' ? body.linkId : '';

    if (!linkId) {
      return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
    }

    const { data: revokedLink, error: revokeError } = await supabaseUser
      .from('public_report_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkId)
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();

    if (revokeError || !revokedLink) {
      return NextResponse.json({ error: 'Link não encontrado ou já revogado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível revogar o link.' }, { status: 500 });
  }
}
