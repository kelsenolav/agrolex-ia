"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, CheckCircle2, Crown, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS, listPlans, type Plan, type PlanType, EXTRA_PACKS, toBillingPlanKey } from '@/lib/commercial/plans';
import { createCommercialEvent, buildMetadataWithEvent } from '@/lib/commercial/scoring';

const PLAN_FEATURES: Record<PlanType, string[]> = {
  trial: [
    'Até 10 páginas processadas',
    'ISF - Índice de Segurança Fundiária',
    'Classificação de risco',
    'Prévia com até 3 alertas principais',
    'Relatório completo bloqueado',
    'Cadeia dominial bloqueada',
    'Exportação PDF bloqueada',
    'Sem compartilhamento',
  ],
  starter: [
    'Até 150 páginas por mês',
    'Relatório completo desbloqueado',
    'ISF - Índice de Segurança Fundiária',
    'Classificação de risco completa',
    'Exportação PDF profissional',
    'Compartilhamento de laudo',
    'Histórico do caso',
  ],
  profissional: [
    'Até 1.000 páginas por mês',
    'Tudo do plano Start',
    'Todos os módulos de auditoria',
    'Cadeia dominial completa',
    'Módulos complementares liberados',
    'Relatório A4 profissional',
  ],
  business: [
    'Até 5.000 páginas por mês',
    'Tudo do plano Profissional',
    'Cruzamento de matrículas',
    'Auditoria geoespacial',
    'Multi-usuário (equipe)',
    'Suporte prioritário',
  ],
  enterprise: [
    'Volume de páginas sob consulta',
    'API de integração',
    'Suporte dedicado 24/7',
    'Treinamento onboarding',
    'Relatórios personalizados',
  ],
  internal_test: [
    'Até 999.999 páginas',
    'Acesso irrestrito',
    'Todos os recursos liberados',
  ],
};

const PLAN_HIGHLIGHTS: Record<PlanType, string[]> = {
  trial: ['Grátis', '10 páginas', 'Prévia limitada'],
  starter: ['150 páginas/mês', 'Relatório completo', 'PDF profissional'],
  profissional: ['1.000 páginas/mês', 'Todos os módulos', 'Cadeia dominial'],
  business: ['5.000 páginas/mês', 'Geoespacial', 'Suporte VIP'],
  enterprise: ['Customizado', 'API', 'Suporte 24/7'],
  internal_test: ['Teste interno', 'Sem limites'],
};

export default function PlanosPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<PlanType>('trial');
  const [loading, setLoading] = useState(true);
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_type')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        if (profile.plan_type && profile.plan_type in PLANS) {
          setCurrentPlan(profile.plan_type as PlanType);
        }
      }

      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (lead) {
        setLeadId(lead.id);
      }

      setLoading(false);
    };
    fetchProfile();
  }, [router]);

  const registrarPlanClicked = async (planId: string) => {
    if (!leadId) return;
    try {
      const { data: leadData } = await supabase
        .from('leads')
        .select('metadata')
        .eq('id', leadId)
        .maybeSingle();
      const currentMetadata = (leadData?.metadata as Record<string, unknown> | null) ?? null;
      const novoEvento = createCommercialEvent('plan_clicked', { plan_id: planId });
      const metadataAtualizado = buildMetadataWithEvent(currentMetadata, novoEvento);
      await supabase.from('leads').update({ metadata: metadataAtualizado }).eq('id', leadId);
    } catch {
      // Falha silenciosa
    }
  };

  const plans = listPlans();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">AgroLex</span>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-8 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Voltar ao painel
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-3">Proteja sua próxima decisão fundiária</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Você paga pelo volume processado, não pela quantidade de imóveis. Escolha o plano ideal para suas operações.
          </p>
        </div>

        {/* Grid de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const features = PLAN_FEATURES[plan.id] || [];
            const highlights = PLAN_HIGHLIGHTS[plan.id] || [];
            const isTrial = plan.id === 'trial';
            const isEnterprise = plan.id === 'enterprise';
            const isPremium = plan.id === 'business' || plan.id === 'enterprise';

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-lg border-2 transition-all flex flex-col ${
                  isCurrent
                    ? 'border-brand-green ring-2 ring-brand-green/20'
                    : isPremium
                      ? 'border-brand-gold'
                      : 'border-gray-100 hover:border-brand-gold/30 hover:shadow-xl'
                }`}
              >
                {/* Header */}
                <div className={`p-5 pb-3 text-center rounded-t-2xl ${isPremium ? 'bg-gradient-to-b from-gray-900 to-gray-800 text-white' : ''}`}>
                  {isCurrent && (
                    <span className="inline-block px-3 py-1 bg-brand-green text-white text-[10px] font-bold uppercase rounded-full mb-3">
                      Plano Atual
                    </span>
                  )}
                  {isPremium && (
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Crown size={16} className="text-brand-gold" />
                      <span className="text-brand-gold text-[10px] font-bold uppercase tracking-widest">Premium</span>
                    </div>
                  )}
                  <h3 className={`text-lg font-extrabold ${isPremium ? 'text-white' : 'text-gray-800'}`}>{plan.label}</h3>
                  <p className={`text-xs mt-1 h-10 ${isPremium ? 'text-gray-300' : 'text-gray-500'}`}>{plan.description}</p>
                </div>

                {/* Preço */}
                <div className={`px-5 py-4 text-center border-b ${isPremium ? 'border-gray-700' : 'border-gray-100'}`}>
                  {isTrial ? (
                    <div>
                      <span className={`text-3xl font-black ${isPremium ? 'text-white' : 'text-gray-800'}`}>Grátis</span>
                      <p className={`text-xs mt-1 ${isPremium ? 'text-gray-400' : 'text-gray-400'}`}>10 páginas inclusas</p>
                    </div>
                  ) : isEnterprise ? (
                    <div>
                      <span className={`text-2xl font-black ${isPremium ? 'text-white' : 'text-gray-800'}`}>Sob Consulta</span>
                      <p className={`text-[10px] mt-1 ${isPremium ? 'text-gray-400' : 'text-gray-400'}`}>Fale com especialista</p>
                    </div>
                  ) : (
                    <div>
                      <span className={`text-3xl font-black ${isPremium ? 'text-white' : 'text-gray-800'}`}>
                        R$ {plan.price?.toFixed(2).replace('.', ',')}
                      </span>
                      <p className={`text-xs mt-1 ${isPremium ? 'text-gray-400' : 'text-gray-400'}`}>/mês</p>
                    </div>
                  )}
                </div>

                {/* Highlights */}
                <div className="px-5 py-2 flex flex-wrap gap-1 justify-center">
                  {highlights.map((h, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      isPremium ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30' : 'bg-brand-green/10 text-brand-green'
                    }`}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Features */}
                <div className="p-5 flex-grow">
                  <ul className="space-y-2">
                    {features.map((feature, i) => {
                      const isLocked = feature.toLowerCase().includes('bloquead');
                      return (
                        <li key={i} className="flex items-start gap-1.5">
                          {isLocked ? (
                            <Lock size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <CheckCircle2 size={12} className={`mt-0.5 flex-shrink-0 ${isPremium ? 'text-brand-gold' : 'text-brand-green'}`} />
                          )}
                          <span className={`text-[11px] leading-tight ${isLocked ? 'text-red-500' : isPremium ? 'text-gray-200' : 'text-gray-700'}`}>
                            {feature}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* CTA */}
                <div className="p-5 pt-0">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl text-center font-bold text-xs bg-green-50 text-brand-green border border-brand-green/20">
                      Seu plano atual
                    </div>
                  ) : isEnterprise ? (
                    <button
                      onClick={() => {
                        window.open('https://wa.me/5563999999999?text=Gostaria%20de%20saber%20mais%20sobre%20o%20plano%20Enterprise', '_blank');
                      }}
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-brand-gold text-brand-green hover:brightness-110 shadow-lg transition-all"
                    >
                      Falar com especialista
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        registrarPlanClicked(plan.id);
                        
                        const iniciarCheckout = async (pId: string) => {
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) {
                              router.push('/login');
                              return;
                            }
                            
                            const res = await fetch('/api/checkout', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                              },
                              body: JSON.stringify({ planType: pId })
                            });

                            if (!res.ok) {
                              const err = await res.json();
                              alert('Erro ao iniciar assinatura: ' + (err.error || 'Erro interno'));
                              return;
                            }

                            const data = await res.json();
                            if (data.checkoutUrl) {
                              window.location.href = data.checkoutUrl;
                            } else {
                              alert('Assinatura ativada com sucesso!');
                              window.location.href = '/dashboard';
                            }
                          } catch (e) {
                            alert('Falha na requisição de pagamento');
                          }
                        };
                        
                        let planKey = toBillingPlanKey(plan.id);
                        if (planKey === 'trial') {
                          router.push('/dashboard/nova-analise');
                          return;
                        }

                        iniciarCheckout(planKey);
                      }}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                        isPremium
                          ? 'bg-brand-gold text-brand-green hover:brightness-110 shadow-lg'
                          : isTrial
                            ? 'bg-brand-green text-white hover:brightness-110 shadow'
                            : 'bg-brand-green text-white hover:brightness-110 shadow'
                      }`}
                    >
                      {isTrial ? 'Começar Grátis' : 'Escolher Plano'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Seção Páginas Extras */}
        <div className="max-w-4xl mx-auto mt-12 bg-white rounded-3xl p-8 shadow-md border border-gray-100">
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 bg-brand-gold/10 text-brand-green text-[10px] font-bold uppercase tracking-wider rounded-full mb-3">
              Demanda adicional?
            </span>
            <h2 className="text-2xl font-extrabold text-gray-800">Créditos Extras de Páginas</h2>
            <p className="text-sm text-gray-500 mt-2">
              Adquira pacotes avulsos de páginas para processar documentos excedentes no seu plano atual.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {EXTRA_PACKS.map((pack) => (
              <div key={pack.id} className="border border-gray-100 rounded-2xl p-6 flex flex-col items-center bg-gray-50/50 hover:border-brand-gold/30 hover:shadow-lg transition-all">
                <span className="font-extrabold text-gray-800 text-sm">{pack.label}</span>
                <span className="text-2xl font-black text-brand-green mt-3">R$ {pack.price.toFixed(2).replace('.', ',')}</span>
                <span className="text-xs text-gray-400 mt-1">{pack.pages} páginas avulsas</span>
                <button
                  onClick={() => {
                    const iniciarCheckoutAvulso = async () => {
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                          router.push('/login');
                          return;
                        }
                        const res = await fetch('/api/checkout', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                          },
                          body: JSON.stringify({ planType: pack.id })
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          alert('Erro ao iniciar compra: ' + (err.error || 'Erro interno'));
                          return;
                        }
                        const data = await res.json();
                        if (data.checkoutUrl) {
                          window.location.href = data.checkoutUrl;
                        } else {
                          alert('Créditos ativados com sucesso!');
                          window.location.href = '/dashboard';
                        }
                      } catch (e) {
                        alert('Falha na requisição de pagamento');
                      }
                    };
                    iniciarCheckoutAvulso();
                  }}
                  className="w-full mt-5 py-2 rounded-xl font-bold text-xs bg-brand-green text-white hover:brightness-110 shadow transition-all"
                >
                  Comprar {pack.pages} págs
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 text-sm text-gray-500">
          <p>Pagamentos processados via Mercado Pago. Cancele a qualquer momento.</p>
          <p className="mt-1">Dúvidas? Entre em contato pelo WhatsApp: (63) 9 9999-9999</p>
        </div>
      </main>
    </div>
  );
}