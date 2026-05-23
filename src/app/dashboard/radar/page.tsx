"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, ArrowLeft, Radar, AlertTriangle, Bell, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function RadarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);

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
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Voltar ao painel principal
        </Link>

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
                    {alerts.map(alert => (
                      <div key={alert.id} className="flex gap-4 p-4 rounded-lg bg-red-50 border border-red-100">
                        <div className="flex-shrink-0 mt-1">
                          <AlertTriangle className="text-red-600" size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-red-800">{alert.properties?.name}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12}/> {new Date(alert.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-red-900 leading-relaxed">{alert.message}</p>
                        </div>
                      </div>
                    ))}
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
