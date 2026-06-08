"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, CheckCircle2, Crown, Building2, Zap, Lock, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS, listPlans, type Plan, type PlanType } from '@/lib/commercial/plans';
import { createCommercialEvent, buildMetadataWithEvent } from '@/lib/commercial/scoring';
import InterestModal from '@/components/commercial/InterestModal';

const PLAN_FEATURES: Record<PlanType, string[]> = {
  trial: [
    'Análise de matrícula individual',
    'ISF - Índice de Segurança Fundiária',
    'Classificação de risco',
    'Prévia com até 3 alertas principais',
    'Relatório completo bloqueado',
    'Cadeia dominial bloqueada',
    'Módulos complementares bloqueados',
    'Exportação PDF bloqueada',
    'Sem compartilhamento',
  ],
  starter: [
    'Até 5 análises por mês',
    'Relatório completo desbloqueado',
    'ISF - Índice de Segurança Fundiária',
    'Classificação de risco completa',
    'Exportação PDF profissional',
    'Compartilhamento de laudo',
    'Histórico do caso',
    'Suporte por e-mail',
  ],
  profissional: [
    'Até 20 análises por mês',
    'Todos os módulos de auditoria',
    'Cadeia dominial completa',
    'Módulos complementares liberados',
    'Cruzamento de matrículas',
    'Auditoria geoespacial',
    'Mapeamento de nulidades e fraudes',
    'Suporte prioritário WhatsApp',
    'Relatório A4 profissional',
  ],
  empresarial: [
    'Análises ilimitadas',
    'Todos os módulos premium',
    'Cadeia dominial completa',
    'Módulos complementares liberados',
    'Auditoria de origem pública',
    'Multi-usuário (equipe)',
    'API de integração',
    'Suporte dedicado 24/7',
    'Treinamento onboarding',
    'Relatórios personalizados',
  ],
};

const PLAN_HIGHLIGHTS: Record<PlanType, string[]> = {
  trial: ['Grátis', '1 análise', 'Prévia limitada'],
  starter: ['Até 5 análises', 'Relatório completo', 'PDF profissional'],
  profissional: ['Até 20 análises', 'Todos os módulos', 'Suporte WhatsApp'],
  empresarial: ['Ilimitado', 'Equipe', 'API & Suporte 24/7'],
};

export default function PlanosPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<PlanType>('trial');
  const [loading, setLoading] = useState(true);
  // FASE 3: lead_id para persistência de eventos
  const [leadId, setLeadId] = useState<string | null>(null);

  // Estados do Modal de Interesse Comercial
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState('Profissional');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      setUserEmail(session.user.email || '');
      setUserId(session.user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, plan_type')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        if (profile.name) setUserName(profile.name);
        if (profile.plan_type && profile.plan_type in PLANS) {
          setCurrentPlan(profile.plan_type as PlanType);
        }
      }

      // FASE 3: buscar lead para persistência de eventos
      const { data: lead } = await supabase
        .from('leads')
        .select('id, metadata')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (lead) {
        setLeadId(lead.id);
        
        // SPRINT P0.3: Telemetria de visualização da página de planos
        try {
          fetch('/api/marketing/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'track_event',
              userId: session.user.id,
              email: session.user.email,
              eventType: 'plans_page_view',
              meta: { origem: 'dashboard_planos' }
            })
          });
        } catch (e) {
          console.error(e);
        }
      }

      setLoading(false);
    };
    fetchProfile();
  }, [router]);

  /**
   * FASE 3 — Registra evento plan_clicked no metadata do lead.
   * Falha silenciosamente se não houver lead ou campo metadata.
   * TODO: Requer coluna JSONB `metadata` na tabela `leads` (migration pendente).
   */
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
      {/* Navbar */}
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
            Escolha o plano ideal para mitigar riscos, validar documentos e garantir a segurança jurídica de suas operações.
          </p>
        </div>

        {/* Grid de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const features = PLAN_FEATURES[plan.id] || [];
            const highlights = PLAN_HIGHLIGHTS[plan.id] || [];
            const isTrial = plan.id === 'trial';
            const isPremium = plan.id === 'empresarial';

            // Custom labels and descriptions for Sprint P0.3 Conversão Persuasiva
            let displayLabel = plan.label;
            let displayDescription = plan.description;

            if (plan.id === 'trial') {
              displayLabel = 'Acesso Experimental';
              displayDescription = 'Ideal para testar a plataforma com uma análise simples.';
            } else if (plan.id === 'starter') {
              displayLabel = 'Usuário Ocasional';
              displayDescription = 'Ideal para quem analisa poucos imóveis.';
            } else if (plan.id === 'profissional') {
              displayLabel = 'Profissional';
              displayDescription = 'Ideal para advogados, corretores e consultores.';
            } else if (plan.id === 'empresarial') {
              displayLabel = 'Empresarial';
              displayDescription = 'Ideal para operações recorrentes.';
            }

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
                <div className={`p-6 pb-4 text-center rounded-t-2xl ${isPremium ? 'bg-gradient-to-b from-gray-900 to-gray-800 text-white' : ''}`}>
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
                  <h3 className={`text-xl font-extrabold ${isPremium ? 'text-white' : 'text-gray-800'}`}>{displayLabel}</h3>
                  <p className={`text-sm mt-1 ${isPremium ? 'text-gray-300' : 'text-gray-500'}`}>{displayDescription}</p>
                </div>

                {/* Preço */}
                <div className={`px-6 py-5 text-center border-b ${isPremium ? 'border-gray-700' : 'border-gray-100'}`}>
                  {plan.price === null ? (
                    <div>
                      <span className={`text-4xl font-black ${isPremium ? 'text-white' : 'text-gray-800'}`}>Grátis</span>
                      <p className={`text-xs mt-1 ${isPremium ? 'text-gray-400' : 'text-gray-400'}`}>7 dias de teste</p>
                    </div>
                  ) : (
                    <div>
                      <span className={`text-4xl font-black ${isPremium ? 'text-white' : 'text-gray-800'}`}>
                        R$ {plan.price.toFixed(2).replace('.', ',')}
                      </span>
                      <p className={`text-xs mt-1 ${isPremium ? 'text-gray-400' : 'text-gray-400'}`}>/mês</p>
                    </div>
                  )}
                </div>

                {/* Highlights */}
                <div className="px-6 py-3 flex flex-wrap gap-1.5 justify-center">
                  {highlights.map((h, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      isPremium ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30' : 'bg-brand-green/10 text-brand-green'
                    }`}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Features */}
                <div className="p-6 flex-grow">
                  <ul className="space-y-3">
                    {features.map((feature, i) => {
                      const isLocked = feature.toLowerCase().includes('bloquead');
                      return (
                        <li key={i} className="flex items-start gap-2">
                          {isLocked ? (
                            <Lock size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <CheckCircle2 size={14} className={`mt-0.5 flex-shrink-0 ${isPremium ? 'text-brand-gold' : 'text-brand-green'}`} />
                          )}
                          <span className={`text-xs leading-tight ${isLocked ? 'text-red-500' : isPremium ? 'text-gray-200' : 'text-gray-700'}`}>
                            {feature}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* CTA */}
                <div className="p-6 pt-0">
                  {isCurrent ? (
                    <div className="w-full py-3 rounded-xl text-center font-bold text-sm bg-green-50 text-brand-green border border-brand-green/20">
                      Seu plano atual
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        // FASE 3: registrar evento plan_clicked e plans_cta_click antes de navegar
                        registrarPlanClicked(plan.id);
                        try {
                          supabase.auth.getSession().then(({ data: { session } }) => {
                            if (session) {
                              fetch('/api/marketing/leads', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'track_event',
                                  userId: session.user.id,
                                  email: session.user.email,
                                  eventType: 'plans_cta_click',
                                  meta: { planId: plan.id }
                                })
                              });
                            }
                          });
                        } catch (e) {
                          console.error(e);
                        }

                        // Para os planos starter, pro, premium, empresarial, inicia o checkout Mercado Pago
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
                          } catch (e: any) {
                            alert('Falha na requisição de pagamento');
                          }
                        };
                        
                        let planKey: string = plan.id;
                        if (planKey === 'profissional') planKey = 'pro';
                        if (planKey === 'empresarial') planKey = 'enterprise';
                        if (planKey === 'trial') {
                          router.push('/dashboard/nova-analise');
                          return;
                        }

                        iniciarCheckout(planKey);
                      }}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
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

        {/* Footer informativo */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>Pagamentos processados via Mercado Pago. Cancele a qualquer momento.</p>
          <p className="mt-1">Dúvidas? Entre em contato pelo WhatsApp: (63) 9 9999-9999</p>
        </div>
      </main>
    </div>
  );
}