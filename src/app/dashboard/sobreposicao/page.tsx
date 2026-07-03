"use client";

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Layers, MapPinned, FileText, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';

const OverlapMap = dynamic(() => import('./OverlapMap'), { ssr: false, loading: () => <div className="h-[420px] bg-gray-100 rounded-xl animate-pulse" /> });

interface PropertyOption {
  id: string;
  name: string;
  car_code: string | null;
  state: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const SEVERITY_BADGE: Record<string, { label: string; cls: string }> = {
  critica: { label: 'CRÍTICA', cls: 'bg-red-100 text-red-700 border-red-200' },
  alta: { label: 'ALTA', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { label: 'MÉDIA', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  baixa: { label: 'BAIXA', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const CLASSE_LABEL: Record<string, string> = {
  terra_indigena: 'Terra Indígena',
  unidade_conservacao: 'Unidade de Conservação',
  embargo_ibama: 'Embargo IBAMA',
  car_vizinho: 'CAR vizinho',
};

const FONTE_LABEL: Record<string, string> = {
  car_imovel: 'CAR do imóvel (SICAR espelhado/IBAMA)',
  terras_indigenas: 'Terras Indígenas (FUNAI)',
  unidades_conservacao: 'UCs federais (ICMBio/INDE)',
  embargos_ibama: 'Embargos ativos (IBAMA/SISCOM)',
  cars_vizinhos: 'CARs vizinhos (SICAR espelhado)',
  incra_sigef: 'Parcelas SIGEF/assentamentos (INCRA)',
};

function SobreposicaoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [carCode, setCarCode] = useState(searchParams.get('car') ?? '');
  const [propertyId, setPropertyId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<any | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data } = await supabase
        .from('properties')
        .select('id, name, car_code, state')
        .eq('user_id', session.user.id)
        .not('car_code', 'is', null)
        .order('name');
      setProperties((data ?? []).filter(p => p.car_code));
    }
    load();
  }, [router]);

  const analisar = async () => {
    const code = carCode.trim().toUpperCase();
    if (!code) { setErro('Informe o código CAR (formato UF-CCCCCCC-HASH).'); return; }
    setLoading(true);
    setErro('');
    setResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/geo/sobreposicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ car_code: code, property_id: propertyId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro na análise'); return; }
      setResultado(data.resultado);
    } catch {
      setErro('Erro de conexão na análise. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-brand-green text-white shadow-md no-print">
        <div className="container mx-auto max-w-6xl px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2"><Logo size="sm" className="text-white" /></Link>
          <span className="text-xs bg-brand-gold/20 text-brand-gold px-3 py-1 rounded-full font-bold uppercase tracking-wider">Sobreposições</span>
        </div>
      </nav>

      <main className="container mx-auto max-w-6xl px-6 py-8">
        <Link href="/dashboard/radar" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 w-fit font-medium no-print">
          <ArrowLeft size={18} /> Voltar ao Radar
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="text-brand-green" /> Análise de Sobreposição Georreferenciada
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Cruza o polígono do imóvel (CAR) com Terras Indígenas, Unidades de Conservação, embargos do IBAMA e CARs vizinhos — com leitura jurídica por achado.
          </p>
        </div>

        {/* Entrada */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Propriedade cadastrada (com CAR)</label>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  const p = properties.find(x => x.id === e.target.value);
                  if (p?.car_code) setCarCode(p.car_code);
                }}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-brand-green focus:outline-none"
              >
                <option value="">— Escolher da minha lista —</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ou código CAR direto</label>
              <input
                value={carCode}
                onChange={(e) => setCarCode(e.target.value)}
                placeholder="TO-1721000-ABCD1234..."
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:ring-1 focus:ring-brand-green focus:outline-none"
              />
            </div>
            <button
              onClick={analisar}
              disabled={loading}
              className="bg-brand-green hover:bg-brand-green/90 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition disabled:opacity-60"
            >
              {loading ? 'Consultando bases oficiais...' : 'Analisar Sobreposições'}
            </button>
          </div>
          {erro && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{erro}</p>}
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-gray-800 flex items-center gap-2"><MapPinned size={18} className="text-brand-green" /> {resultado.car_code}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {resultado.municipio ?? 'Município não informado'} · {resultado.area_imovel_ha} ha · status CAR: {resultado.status_imovel_car ?? '—'}
                  </p>
                </div>
                <button onClick={() => window.print()} className="no-print flex items-center gap-2 border border-brand-green text-brand-green px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-green/5 transition">
                  <FileText size={16} /> Exportar PDF
                </button>
              </div>
              <OverlapMap imovel={resultado.geometria_imovel} achados={resultado.achados} bbox={resultado.bbox_imovel} />
            </div>

            {/* Achados */}
            {resultado.achados.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
                <CheckCircle2 className="text-green-600 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-green-800">Nenhuma sobreposição detectada nas camadas consultadas</p>
                  <p className="text-xs text-green-700 mt-1">Veja abaixo quais fontes foram efetivamente verificadas — ausência de achado nas fontes consultadas não alcança as fontes indisponíveis.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {resultado.achados.map((a: any, i: number) => {
                  const badge = SEVERITY_BADGE[a.severidade] ?? SEVERITY_BADGE.baixa;
                  return (
                    <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{CLASSE_LABEL[a.classe] ?? a.classe}</span>
                        {a.marginal && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">marginal (&lt;0,1 ha)</span>}
                      </div>
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <ShieldAlert size={16} className="text-gray-400" /> {a.nome}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Sobreposição de <strong>{a.area_sobreposta_ha} ha</strong> ({a.percentual_imovel}% do imóvel)
                      </p>
                      {a.leitura_juridica && (
                        <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                          <p className="font-semibold text-gray-800">{a.leitura_juridica.titulo}</p>
                          <p className="text-gray-600"><span className="font-semibold text-gray-700">Fundamento: </span>{a.leitura_juridica.fundamento}</p>
                          <p className="text-gray-600"><span className="font-semibold text-gray-700">Consequência: </span>{a.leitura_juridica.consequencia}</p>
                          <p className="text-gray-600"><span className="font-semibold text-gray-700">Recomendação: </span>{a.leitura_juridica.recomendacao}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Proveniência */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">Fontes consultadas nesta análise</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(resultado.fontes as Record<string, { status: string; erro?: string }>).map(([k, v]) => (
                  <span
                    key={k}
                    title={v.erro}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                      v.status === 'consultada' ? 'bg-emerald-100 text-emerald-800' :
                      v.status === 'falhou' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {FONTE_LABEL[k] ?? k}: {v.status}
                  </span>
                ))}
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">{resultado.disclaimer}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SobreposicaoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 text-sm">Carregando...</div>}>
      <SobreposicaoInner />
    </Suspense>
  );
}
