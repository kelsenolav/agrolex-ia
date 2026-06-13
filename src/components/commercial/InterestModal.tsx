"use client";
import { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2, Sparkles, Trophy } from 'lucide-react';
import { type TipoUsuario } from '@/lib/marketing/leadCapture';

interface InterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: string;
  userEmail?: string;
  userName?: string;
  userId?: string;
}

export default function InterestModal({
  isOpen,
  onClose,
  defaultPlan = 'Profissional',
  userEmail = '',
  userName = '',
  userId = '',
}: InterestModalProps) {
  const [nome, setNome] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [whatsapp, setWhatsapp] = useState('');
  const [perfil, setPerfil] = useState<TipoUsuario | ''>('');
  const [plano, setPlano] = useState(defaultPlan);
  const [volume, setVolume] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [started, setStarted] = useState(false);

  // Telemetria simples sem setStates
  useEffect(() => {
    if (isOpen) {
      trackEvent('interest_modal_open', { defaultPlan });
    }
  }, [isOpen]);

  const trackEvent = (type: string, meta?: Record<string, any>) => {
    if (!userId) return;
    try {
      fetch('/api/marketing/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_event',
          userId,
          email: email || userEmail,
          eventType: type,
          meta: meta || {},
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleFieldFocus = () => {
    if (!started) {
      setStarted(true);
      trackEvent('interest_form_started');
    }
  };

  const handleSelectPlan = (plan: string) => {
    setPlano(plan);
    trackEvent('interest_plan_selected', { plan });
  };

  const handleSelectVolume = (vol: string) => {
    setVolume(vol);
    trackEvent('interest_volume_selected', { volume: vol });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !whatsapp || !perfil || !plano || !volume) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/marketing/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_interest',
          nome,
          email,
          whatsapp,
          tipo_usuario: perfil,
          interest_plan: plano,
          interest_volume: volume,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        trackEvent('interest_form_completed', { plano, volume, perfil });
      } else {
        alert('Erro ao registrar interesse. Tente novamente em instantes.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão. Verifique sua rede.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-5 flex justify-between items-center border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Trophy className="text-brand-gold" size={20} />
            <h3 className="font-extrabold text-lg tracking-tight">Fila de Prioridade Comercial</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Nossos planos pagos ainda não estão liberados para faturamento imediato. Registre seu interesse para garantir prioridade e condições exclusivas de lançamento.
              </p>

              <div className="space-y-3">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    placeholder="Seu nome"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-gray-50 cursor-not-allowed"
                    placeholder="exemplo@AgrolexI.com"
                    disabled
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={whatsapp}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    placeholder="(99) 99999-9999"
                  />
                </div>

                {/* Perfil */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Seu Perfil</label>
                  <select
                    required
                    value={perfil}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setPerfil(e.target.value as TipoUsuario)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  >
                    <option value="">Selecione...</option>
                    <option value="Produtor Rural">Produtor Rural</option>
                    <option value="Advogado">Advogado</option>
                    <option value="Corretor">Corretor</option>
                    <option value="Investidor">Investidor</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {/* Plano de Interesse */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Plano de Interesse</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Usuário Ocasional', 'Profissional', 'Empresarial'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSelectPlan(p)}
                        className={`py-2 px-1 text-center text-xs font-bold rounded-lg border transition-all ${
                          plano === p
                            ? 'bg-brand-green text-white border-brand-green shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume de Uso */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Volume Mensal Estimado</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Até 5 análises/mês',
                      'Até 25 análises/mês',
                      'Até 100 análises/mês',
                      'Mais de 100 análises/mês',
                    ].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleSelectVolume(v)}
                        className={`py-2 px-2 text-left text-xs font-medium rounded-lg border transition-all ${
                          volume === v
                            ? 'bg-brand-green/10 text-brand-green border-brand-green'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-gold text-brand-green py-3.5 rounded-xl font-extrabold text-sm text-center hover:brightness-105 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Processando...
                    </>
                  ) : (
                    'Registrar Interesse'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xl font-black text-gray-800 flex items-center justify-center gap-1.5">
                  <Sparkles size={20} className="text-brand-gold" /> Interesse Registrado!
                </h4>
                <p className="text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
                  Você será avisado assim que os planos forem liberados.
                </p>
                <p className="text-xs text-brand-green font-bold bg-green-50 py-2.5 px-4 rounded-xl border border-green-200 inline-block">
                  Sua posição foi registrada na fila de prioridade comercial do AgrolexI.
                </p>
              </div>

              <div className="pt-4 max-w-xs mx-auto">
                <button
                  onClick={onClose}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
                >
                  Voltar ao Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
