import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AUTH_ACCESS_COOKIE, AUTH_COOKIE_OPTIONS, AUTH_REFRESH_COOKIE } from '@/lib/authCookies';

function createSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuracao publica do Supabase indisponivel.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_ACCESS_COOKIE, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(AUTH_REFRESH_COOKIE, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: 'Sessao invalida.' }, { status: 400 });
    }

    const supabase = createSupabaseAuthClient();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_ACCESS_COOKIE, accessToken, { ...AUTH_COOKIE_OPTIONS, maxAge: 60 * 60 });
    response.cookies.set(AUTH_REFRESH_COOKIE, refreshToken, { ...AUTH_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch {
    return NextResponse.json({ error: 'Nao foi possivel sincronizar a sessao.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
