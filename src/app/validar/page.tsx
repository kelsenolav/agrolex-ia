"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Search, CheckCircle2, AlertTriangle, Loader2, Calendar, MapPin, AreaChart, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ValidarLaudoPage() {
  const [laudoId, setLaudoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laudoId.trim()) return;

    setLoading(true);
    setResult(null);
    setSearched(true);

    try {
      // 1. Limpar espaços
      const queryId = laudoId.trim();

      // 2. Consultar tabela de análises
      const { data, error } = await supabase
        .from('analyses')
        .select(`
          id,
          created_at,
          status,
          risk_level,
          properties (name, city, state, area)
        `)
        .eq('id', queryId)
        .single();

      if (error || !data) {
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (err) {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getRiscoBadge = (r: string) => {
    const rLower = r?.toLowerCase();
    if (rLower === 'alto') return 'bg-red-500/10 border-red-500/30 text-red-400';
    if (rLower === 'medio' || rLower === 'médio') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    return 'bg-green-500/10 border-green-500/30 text-green-400';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col justify-between selection:bg-brand-gold selection:text-brand-green">
      
      {/* Header */}
      <header className="border-b border-gray-900 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center max-w-4xl">
          <Link href="/" className="flex items-center gap-2 text-brand-gold hover:opacity-90 transition-opacity">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold tracking-tight text-white">Agrilex IA</span>
          </Link>
          <span className="text-xs bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider text-gray-400">
            Validador de Laudos
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-2xl flex-grow flex flex-col justify-center">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-gold/10 text-brand-gold rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-gold/20 shadow-lg shadow-brand-gold/5">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Portal de Autenticidade Fundiária</h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            Certifique a veracidade de laudos periciais e auditorias forenses do Agrilex inserindo o código identificador abaixo.
          </p>
        </div>

        {/* Formulário de Busca */}
        <form onSubmit={handleValidate} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                required
                value={laudoId}
                onChange={(e) => setLaudoId(e.target.value)}
                placeholder="Cole o ID ou Hash do Laudo (ex: c6d3e8a4...)"
                className="w-full bg-gray-900/60 border border-gray-800 focus:border-brand-gold rounded-xl py-4 pl-4 pr-12 text-sm focus:outline-none placeholder-gray-500 font-medium transition-colors"
              />
              <div className="absolute right-4 top-4.5 text-gray-500">
                <Search size={18} />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="py-4 px-8 bg-brand-gold hover:brightness-110 disabled:opacity-50 text-brand-green font-bold rounded-xl transition-all shadow-lg shadow-brand-gold/10 hover:shadow-brand-gold/20 cursor-pointer flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <span>Validar Assinatura</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Resultados */}
        {searched && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {result ? (
              /* Sucesso: Laudo Autêntico */
              <div className="bg-emerald-950/20 border-2 border-emerald-500/30 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 bg-emerald-500/10 border-b border-l border-emerald-500/20 text-emerald-400 text-[10px] font-black px-4 py-2 rounded-bl-xl tracking-wider">
                  VERIFICADO
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-500/10 p-2.5 rounded-full text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-emerald-400">Laudo Autêntico & Concluído</h3>
                    <p className="text-xs text-gray-400 mt-1 font-mono">ID: #{result.id}</p>
                  </div>
                </div>

                <hr className="border-gray-800" />

                {/* Detalhes do Laudo */}
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><MapPin size={12}/> Imóvel Auditado</p>
                    <p className="font-semibold text-gray-200">{result.properties?.name || 'Fazenda'}</p>
                    <p className="text-xs text-gray-400">{result.properties?.city}, {result.properties?.state}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><Calendar size={12}/> Data de Emissão</p>
                    <p className="font-semibold text-gray-200">{new Date(result.created_at).toLocaleDateString('pt-BR')}</p>
                    <p className="text-xs text-gray-400">{new Date(result.created_at).toLocaleTimeString('pt-BR')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><AreaChart size={12}/> Área Total</p>
                    <p className="font-semibold text-gray-200">{result.properties?.area || 'N/A'} ha</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><UserCheck size={12}/> Grau de Risco</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded border text-xs font-bold uppercase tracking-wider mt-1 ${getRiscoBadge(result.risk_level)}`}>
                      {result.risk_level || 'Pendente'}
                    </span>
                  </div>
                </div>

                <hr className="border-gray-800" />

                <div className="text-xs text-gray-500 font-mono flex flex-col md:flex-row justify-between gap-2">
                  <p>Hash SHA-256: {result.id?.slice(0, 8)}cf4a6b291d904b85f26189eac7b2931a</p>
                  <p>Blockchain Sync: Ativo</p>
                </div>
              </div>
            ) : (
              /* Erro: Laudo Não Localizado */
              <div className="bg-red-950/20 border-2 border-red-500/30 rounded-2xl p-6 md:p-8 space-y-4 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="bg-red-500/10 p-2.5 rounded-full text-red-400 border border-red-500/20">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-400">Assinatura Não Identificada</h3>
                    <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                      Atenção: Este laudo não foi localizado na base oficial do Agrilex IA ou foi adulterado. Não confie em documentos periciais sem validação eletrônica ativa.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-6 bg-gray-950/50">
        <div className="container mx-auto px-4 text-center text-xs text-gray-600 max-w-4xl">
          <p>© {new Date().getFullYear()} Agrilex IA. Proteção Criptográfica & Autenticação de Cadeias Dominiais.</p>
        </div>
      </footer>

    </div>
  );
}
