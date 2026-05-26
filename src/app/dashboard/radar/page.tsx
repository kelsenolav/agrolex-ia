"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, ArrowLeft, Radar, AlertTriangle, Bell, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function RadarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const fetchRadarData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const propIdToActivate = searchParams.get('property_id');
      
      // Se veio da URL para ativar o radar
      if (propIdToActivate) {
        // Buscar a propriedade para calcular o preço baseado na área
        const { data: propToAct } = await supabase.from('properties').select('name, area').eq('id', propIdToActivate).single();
        if (propToAct) {
          const area = propToAct.area || 50; // default 50ha se não houver
          // Lógica de Preço V4.1: R$ 99 básico (até 300ha). Acima disso R$ 0,50/ha. Teto Máximo R$ 5000.
          let price = 99;
          if (area > 300) {
            price = 99 + ((area - 300) * 0.50);
          }
          if (price > 5000) price = 5000;
          
          const confirmMessage = `Confirmar assinatura B2B do Radar Contínuo para a propriedade "${propToAct.name}"?\n\nTamanho: ${area} hectares\nValor Mensal: R$ ${price.toFixed(2).replace('.', ',')}`;
          
          if (window.confirm(confirmMessage)) {
            setActivatingId(propIdToActivate);
            await supabase.from('properties').update({ is_monitoring: true }).eq('id', propIdToActivate);
            alert("Radar ativado com sucesso!");
          }
        }
        router.replace('/dashboard/radar'); // limpa a URL
        setActivatingId(null);
      }

      // Busca propriedades monitoradas
      const { data: props } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_monitoring', true);
      
      if (props) setProperties(props);

      // Busca alertas recentes
      const { data: radarAlerts } = await supabase
        .from('radar_alerts')
        .select('*, properties(name)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (radarAlerts) setAlerts(radarAlerts);

      setLoading(false);
    };

    fetchRadarData();
  }, [searchParams, router]);

  const handleManualScan = async () => {
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch('/api/cron/radar', {
        method: 'GET',
        headers: {
          'x-bypass-secret': 'agrolex-developer'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Varredura concluída com sucesso! Alertas novos gerados hoje: ${result.alertsGenerated || 0}`);
        
        // Recarregar os alertas
        const { data: radarAlerts } = await supabase
          .from('radar_alerts')
          .select('*, properties(name)')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (radarAlerts) setAlerts(radarAlerts);
      } else {
        alert("A varredura rodou, mas retornou um status inesperado.");
      }
    } catch (err: any) {
      alert("Erro ao disparar varredura: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-gray-900 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold">
            <Radar size={28} className="animate-pulse" />
            <span className="text-xl font-bold text-white">Radar Contínuo</span>
          </Link>
          <div className="text-sm bg-gray-800 px-4 py-2 rounded-full font-bold flex items-center gap-2 text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
            Monitoramento Ativo
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors w-fit font-medium">
            <ArrowLeft size={20} /> Voltar ao painel principal
          </Link>
          <button
            onClick={handleManualScan}
            disabled={scanning}
            className="flex items-center justify-center gap-2 bg-brand-gold text-brand-green px-5 h-[42px] rounded-lg font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-md cursor-pointer"
          >
            {scanning ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Varrendo bases...</span>
              </>
            ) : (
              <>
                <Radar size={16} />
                <span>Realizar Varredura Manual</span>
              </>
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Buscando varreduras...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Coluna Esquerda: Propriedades Monitoradas */}
            <div className="md:col-span-1 space-y-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <ShieldCheck className="text-brand-green" /> Suas Áreas Vigiadas
              </h2>
              
              {properties.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border text-center text-gray-500 text-sm">
                  Você não possui propriedades no radar.<br/><br/> Vá ao painel e clique em "Ativar Radar".
                </div>
              ) : (
                properties.map(p => (
                  <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-brand-green hover:shadow-md transition-all">
                    <h3 className="font-bold text-gray-900 truncate">{p.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-3">CPF/CNPJ: {p.cpf_cnpj || 'Não informado'}</p>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-1 rounded w-fit">
                      <CheckCircle2 size={12} /> Seguro
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Coluna Direita: Linha do Tempo de Alertas */}
            <div className="md:col-span-2 space-y-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <Bell className="text-brand-gold" /> Central de Alertas Governamentais
              </h2>

              <div className="bg-white p-6 rounded-2xl shadow-sm border min-h-[400px]">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                    <Radar size={48} className="mb-4 opacity-20" />
                    <p>Nenhuma anomalia detectada.</p>
                    <p className="text-sm mt-2">Dormindo tranquilo, o sistema vigia por você.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alerts.map(alert => {
                      const isSatellite = alert.alert_type === 'RISCO_AMBIENTAL';
                      return (
                        <div 
                          key={alert.id} 
                          className={`flex gap-4 p-5 rounded-xl border transition-all hover:shadow-md ${
                            isSatellite 
                              ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 shadow-sm' 
                              : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 shadow-sm'
                          }`}
                        >
                          <div className="flex-shrink-0 mt-1">
                            {isSatellite ? (
                              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 animate-pulse">
                                <Radar size={22} />
                              </div>
                            ) : (
                              <div className="p-2 bg-red-100 rounded-lg text-red-700">
                                <AlertTriangle size={22} />
                              </div>
                            )}
                          </div>
                          <div className="flex-grow">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${isSatellite ? 'text-emerald-900' : 'text-red-950'}`}>
                                  {alert.properties?.name}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  isSatellite 
                                    ? 'bg-emerald-200/60 text-emerald-800 border border-emerald-300/50' 
                                    : 'bg-red-200/60 text-red-800 border border-red-300/50'
                                }`}>
                                  {isSatellite ? '📡 Sentinel-2 Satélite' : '⚖️ Risco Governamental'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={12}/> {new Date(alert.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className={`text-sm leading-relaxed ${isSatellite ? 'text-emerald-850' : 'text-red-900'}`}>
                              {alert.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 text-brand-green">Carregando Radar...</div>}>
      <RadarContent />
    </Suspense>
  );
}
