import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do servidor ausente.' }, { status: 500 });
    }

    // Authenticate user via Server Client (cookies)
    const supabaseUser = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    // Fallback: try authorization header if cookie is missing
    let finalUser = user;
    if (authError || !user) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const tempClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: { user: headerUser } } = await tempClient.auth.getUser(token);
        if (headerUser) {
          finalUser = headerUser;
        }
      }
    }

    if (!finalUser) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
    }

    const body = await req.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'ID da análise não informado.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch the analysis to check ownership and get property_id
    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from('analyses')
      .select('id, user_id, property_id')
      .eq('id', analysisId)
      .maybeSingle();

    if (fetchError || !analysis) {
      return NextResponse.json({ error: 'Análise não encontrada.' }, { status: 404 });
    }

    // Verify ownership
    if (analysis.user_id !== finalUser.id) {
      return NextResponse.json({ error: 'Acesso negado: a análise não pertence a você.' }, { status: 403 });
    }

    // Deleting the property cascades and deletes both analyses and documents securely!
    if (analysis.property_id) {
      const { error: deleteError } = await supabaseAdmin
        .from('properties')
        .delete()
        .eq('id', analysis.property_id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    } else {
      // Fallback: delete analysis directly if no property is linked
      const { error: deleteError } = await supabaseAdmin
        .from('analyses')
        .delete()
        .eq('id', analysisId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro ao excluir análise:', err);
    return NextResponse.json({ error: 'Erro interno ao excluir análise: ' + err.message }, { status: 500 });
  }
}
