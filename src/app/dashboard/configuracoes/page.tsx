"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Phone, Webhook, Loader2, CheckCircle2, ShieldCheck, Key } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [role, setRole] = useState('user');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      setEmail(session.user.email || '');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setName(profile.name || '');
        setWhatsapp(profile.whatsapp || '');
        setWebhookUrl(profile.webhook_url || '');
        setRole(profile.role || 'user');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      // Limpar caracteres não numéricos do WhatsApp antes de salvar
      const cleanWhatsapp = whatsapp.replace(/\D/g, '');

      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          whatsapp: cleanWhatsapp,
          webhook_url: webhookUrl
        })
        .eq('id', session.user.id);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert("Erro ao salvar configurações: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Máscara para celular (XX) XXXXX-XXXX
  const handleWhatsappChange = (val: string) => {
    const numOnly = val.replace(/\D/g, '');
    if (numOnly.length <= 11) {
      let formatted = numOnly;
      if (numOnly.length > 2) {
        formatted = `(${numOnly.slice(0, 2)}) ${numOnly.slice(2)}`;
      }
      if (numOnly.length > 7) {
        formatted = `(${numOnly.slice(0, 2)}) ${numOnly.slice(2, 7)}-${numOnly.slice(7)}`;
      }
      setWhatsapp(formatted);
    } else {
      setWhatsapp(val.slice(0, 15));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-gray-900 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">Agrilex B2B</span>
          </Link>
          <div className="text-sm bg-gray-800 px-4 py-2 rounded-full font-bold text-brand-gold">
            Configurações Enterprise
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Voltar ao painel principal
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-green to-emerald-900 p-8 text-white">
            <h1 className="text-2xl font-black mb-2">Painel de Integração & Perfil</h1>
            <p className="text-emerald-100 text-sm">Configure seus canais de notificação externa e credenciais da API Agrolex.</p>
          </div>

          <form onSubmit={handleSave} className="p-8 space-y-6">
            
            {/* Seção 1: Perfil do Usuário */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <User className="text-brand-green" size={20} /> Informações Cadastrais
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-brand-green font-medium text-gray-700"
                    placeholder="Nome do perito ou empresa"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">E-mail (Não editável)</label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-4 py-3 rounded-lg border border-gray-100 bg-gray-50 font-medium text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Integração de Notificações */}
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <Phone className="text-brand-gold" size={20} /> Canal de Alertas WhatsApp
              </h2>
              <p className="text-gray-500 text-xs leading-relaxed">
                Insira o número do celular responsável por receber os alertas críticos da IA e avisos de varreduras do Radar Fundiário.
              </p>
              
              <div className="max-w-md">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">WhatsApp para Alertas</label>
                <div className="relative">
                  <span className="absolute left-3 top-3.5 text-gray-400 font-bold text-sm">+55</span>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => handleWhatsappChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-brand-green font-medium text-gray-700"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Webhooks de Integração */}
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <Webhook className="text-purple-600" size={20} /> Webhook Web (n8n, Make, Custom)
              </h2>
              <p className="text-gray-500 text-xs leading-relaxed">
                Configure um endpoint HTTP POST próprio para receber as informações estruturadas da auditoria (JSON com status, riscos detectados e recomendações) assim que ela for concluída pela IA.
              </p>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">URL do Webhook</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-brand-green font-medium text-gray-700"
                  placeholder="https://seu-sistema.com/api/webhook/agrilex"
                />
              </div>
            </div>

            {/* Seção 4: Informações de Ambiente / Chaves */}
            <div className="space-y-4 pt-4 bg-gray-50 p-6 rounded-xl border">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Key className="text-gray-500" size={16} /> Credenciais Locais de Desenvolvedor
              </h3>
              <div className="text-xs text-gray-600 space-y-2 leading-relaxed font-mono">
                <p><strong>Configuração .env.local ativa:</strong></p>
                <p>• MERCADOPAGO_ACCESS_TOKEN: {process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ Configurado' : '⚠️ Simulador Ativo (Modo Mock)'}</p>
                <p>• RESEND_API_KEY: {process.env.RESEND_API_KEY ? '✅ Configurado' : '⚠️ E-mail Simulado'}</p>
                <p>• N8N_WEBHOOK_URL: {process.env.N8N_WEBHOOK_URL ? '✅ Configurado' : '⚠️ Não configurado'}</p>
              </div>
            </div>

            {/* Botão de Envio */}
            <div className="pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
              {success && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg font-bold border border-green-200 text-sm">
                  <CheckCircle2 size={18} /> Configurações salvas com sucesso!
                </div>
              )}
              <div className="w-full sm:w-auto ml-auto">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-4 bg-brand-gold text-brand-green font-bold rounded-xl hover:brightness-110 shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={20} /> Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={20} /> Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}
