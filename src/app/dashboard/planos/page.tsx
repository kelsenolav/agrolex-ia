"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, CheckCircle2, Zap, Gem, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data } = await supabase.from('profiles').select('credits').eq('id', session.user.id).single();
        if (data) setCredits(data.credits || 0);
      }
    };
    fetchProfile();
  }, []);

  const handleBuyCredits = async (amount: number, price: number) => {
    if (!userId) {
      router.push('/login');
      return;
    }
    
    setLoading(true);
    try {
      // Simulação de compra no Mercado Pago
      await new Promise(r => setTimeout(r, 1500));
      
      const newCredits = credits + amount;
      
      // Tenta atualizar a coluna credits. Se der erro (coluna não existe), alerta o usuário.
      const { error } = await supabase.from('profiles').update({ credits: newCredits }).eq('id', userId);
      
      if (error) {
        console.error("Erro ao atualizar créditos:", error);
        alert(`Erro! Você esqueceu de rodar o Script SQL no Supabase para criar a coluna 'credits'? Detalhe: ${error.message}`);
      } else {
        setCredits(newCredits);
        alert(`Pagamento de R$ ${price} aprovado! Você recebeu ${amount} créditos.`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold hover:scale-105 transition-transform">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">AgroLex</span>
          </Link>
          <div className="flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full font-bold">
            <Gem size={18} className="text-brand-gold" />
            <span>{credits} Créditos Restantes</span>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Voltar ao painel
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Planos Corporativos</h1>
          <p className="text-xl text-gray-600">Economize até 60% por análise comprando pacotes para o seu escritório.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Pacote Básico */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 flex flex-col hover:shadow-xl transition-shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Básico</h2>
            <p className="text-gray-500 mb-6">Para pequenos escritórios</p>
            <div className="text-4xl font-black text-gray-900 mb-6">R$ 1.990<span className="text-lg text-gray-500 font-medium">/pct</span></div>
            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-center gap-3 text-gray-700"><CheckCircle2 className="text-brand-green" size={20} /> <strong>5 Análises Completas</strong></li>
              <li className="flex items-center gap-3 text-gray-700"><CheckCircle2 className="text-brand-green" size={20} /> R$ 398 por análise</li>
              <li className="flex items-center gap-3 text-gray-700"><CheckCircle2 className="text-brand-green" size={20} /> Relatórios Ilimitados em PDF</li>
            </ul>
            <button disabled={loading} onClick={() => handleBuyCredits(5, 1990)} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Comprar 5 Créditos'}
            </button>
          </div>

          {/* Pacote Premium */}
          <div className="bg-brand-green rounded-2xl shadow-2xl p-8 flex flex-col transform md:-translate-y-4 relative">
            <div className="absolute top-0 right-0 bg-brand-gold text-brand-dark font-black px-4 py-1 rounded-bl-xl rounded-tr-xl text-sm">MAIS VENDIDO</div>
            <h2 className="text-2xl font-bold text-white mb-2">Premium</h2>
            <p className="text-gray-300 mb-6">Para bancas especializadas</p>
            <div className="text-4xl font-black text-white mb-6">R$ 3.490<span className="text-lg text-gray-400 font-medium">/pct</span></div>
            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-center gap-3 text-white"><CheckCircle2 className="text-brand-gold" size={20} /> <strong>10 Análises Completas</strong></li>
              <li className="flex items-center gap-3 text-white"><CheckCircle2 className="text-brand-gold" size={20} /> R$ 349 por análise</li>
              <li className="flex items-center gap-3 text-white"><CheckCircle2 className="text-brand-gold" size={20} /> Relatórios Ilimitados em PDF</li>
              <li className="flex items-center gap-3 text-white"><Zap className="text-brand-gold" size={20} /> Busca Ativa no Ibama/Receita</li>
            </ul>
            <button disabled={loading} onClick={() => handleBuyCredits(10, 3490)} className="w-full bg-brand-gold text-brand-dark font-black py-4 rounded-xl hover:bg-yellow-400 transition-colors shadow-lg disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Comprar 10 Créditos'}
            </button>
          </div>

          {/* Pacote Enterprise */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 flex flex-col hover:shadow-xl transition-shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enterprise</h2>
            <p className="text-gray-500 mb-6">Para corretoras e fundos (FIIs)</p>
            <div className="text-4xl font-black text-gray-900 mb-6">R$ 9.990<span className="text-lg text-gray-500 font-medium">/pct</span></div>
            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-center gap-3 text-gray-700"><CheckCircle2 className="text-brand-green" size={20} /> <strong>50 Análises Completas</strong></li>
              <li className="flex items-center gap-3 text-gray-700"><CheckCircle2 className="text-brand-green" size={20} /> R$ 199 por análise (60% OFF)</li>
              <li className="flex items-center gap-3 text-gray-700"><CheckCircle2 className="text-brand-green" size={20} /> Suporte Prioritário</li>
            </ul>
            <button disabled={loading} onClick={() => handleBuyCredits(50, 9990)} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Comprar 50 Créditos'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
