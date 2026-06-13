import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type Session } from '@supabase/supabase-js';
import { AUTH_ACCESS_COOKIE, AUTH_COOKIE_OPTIONS, AUTH_REFRESH_COOKIE } from '@/lib/authCookies';

function createSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(AUTH_ACCESS_COOKIE, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(AUTH_REFRESH_COOKIE, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

function setAuthCookies(response: NextResponse, session: Session) {
  response.cookies.set(AUTH_ACCESS_COOKIE, session.access_token, { ...AUTH_COOKIE_OPTIONS, maxAge: session.expires_in });
  response.cookies.set(AUTH_REFRESH_COOKIE, session.refresh_token, { ...AUTH_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 30 });
}

export async function proxy(request: NextRequest) {
  const supabase = createSupabaseAuthClient();
  if (!supabase) return redirectToLogin(request);

  const accessToken = request.cookies.get(AUTH_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(AUTH_REFRESH_COOKIE)?.value;

  if (accessToken) {
    // Corrigido: getClaims() não existe na API do Supabase JS client.
    // getUser() valida o token JWT e retorna o usuário (ou erro) corretamente.
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data?.user) return NextResponse.next();
  }

  if (refreshToken) {
    const { data: { session }, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && session) {
      const response = NextResponse.next();
      setAuthCookies(response, session);
      return response;
    }
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
};