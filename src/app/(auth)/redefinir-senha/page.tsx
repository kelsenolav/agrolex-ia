"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';

type LinkState = 'checking' | 'ready' | 'invalid';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // O link de recuperação chega com tokens no fragmento da URL; o supabase-js
    // (detectSessionInUrl) cria a sessão sozinho — aqui só esperamos ela existir.
    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) { setLinkState('ready'); return; }
      // Dá tempo do supabase-js processar o hash antes de declarar inválido
      setTimeout(async () => {
        if (cancelled) return;
        const { data: { session: retry } } = await supabase.auth.getSession();
        setLinkState(retry ? 'ready' : 'invalid');
      }, 1500);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setLinkState('ready');
    });

    check();
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirm = formData.get('confirm') as string;

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    const { data, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError || !data.user) {
      setError('Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.');
      setLoading(false);
      return;
    }

    // Sincroniza o cookie httpOnly (mesmo fluxo do login) e entra direto
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: session.access_token, refreshToken: session.refresh_token }),
      }).catch(() => {});
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-brand-light flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="flex justify-center items-center gap-2 text-brand-green mb-6 hover:scale-105 transition-transform">
          <Logo size="lg" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Definir nova senha
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border-t-4 border-brand-green">
          {linkState === 'checking' && (
            <p className="text-center text-sm text-gray-500">Validando link de recuperação...</p>
          )}

          {linkState === 'invalid' && (
            <div className="text-center space-y-3">
              <p className="text-sm font-medium text-red-600">
                Link inválido ou expirado.
              </p>
              <Link href="/recuperar-senha" className="inline-block text-sm font-medium text-brand-gold hover:text-brand-green transition-colors">
                Solicitar um novo link →
              </Link>
            </div>
          )}

          {linkState === 'ready' && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Nova senha
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-green focus:border-brand-green sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                  Confirmar nova senha
                </label>
                <div className="mt-1">
                  <input
                    id="confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-green focus:border-brand-green sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-brand-green hover:bg-brand-green/90 focus:outline-none transition-colors disabled:opacity-60"
                >
                  {loading ? 'Salvando...' : 'Salvar nova senha e entrar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
