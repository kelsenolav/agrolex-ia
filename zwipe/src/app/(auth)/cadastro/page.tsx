"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flame, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CadastroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const whatsapp = formData.get('whatsapp') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, whatsapp } },
    });

    if (error) {
      setError(error.message === 'User already registered' ? 'Este e-mail já está cadastrado.' : error.message);
      setLoading(false);
    } else {
      router.push('/app');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-10">
      <Link href="/" className="flex items-center gap-2 text-brand-pink mb-8">
        <Flame size={32} fill="currentColor" />
        <span className="text-2xl font-black tracking-tight">Zwipe</span>
      </Link>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#151521] border border-white/10 rounded-3xl p-8 space-y-5"
      >
        <h1 className="text-xl font-bold text-center">Criar conta</h1>

        {error && (
          <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-white/50">Nome</label>
          <input
            type="text"
            name="name"
            required
            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-white/50">WhatsApp</label>
          <input
            type="tel"
            name="whatsapp"
            placeholder="(11) 99999-9999"
            required
            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-white/50">E-mail</label>
          <input
            type="email"
            name="email"
            required
            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-white/50">Senha</label>
          <input
            type="password"
            name="password"
            minLength={6}
            required
            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-brand-pink text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Criar conta'}
        </button>

        <p className="text-center text-sm text-white/50">
          Já tem conta?{' '}
          <Link href="/login" className="text-brand-pink font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
