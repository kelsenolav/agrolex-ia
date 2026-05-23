"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Loader2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function parseMarkdown(md: string) {
  if (!md) return '';
  return md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/### (.*?)\n/g, '<h3 class="text-xl font-bold text-gray-900 mt-6 mb-2">$1</h3>')
    .replace(/## (.*?)\n/g, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>')
    .replace(/\n\* (.*?)/g, '<br/><span class="text-brand-green font-bold mr-2">•</span> $1')
    .replace(/\n1\. (.*?)/g, '<br/><span class="text-brand-gold font-bold mr-2">1.</span> $1')
    .replace(/\n2\. (.*?)/g, '<br/><span class="text-brand-gold font-bold mr-2">2.</span> $1')
    .replace(/\n3\. (.*?)/g, '<br/><span class="text-brand-gold font-bold mr-2">3.</span> $1')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/---/g, '<hr class="my-6 border-gray-300"/>');
}

export default function AdminRelatorioPage({ params }: { params: { id: string } }) {
  const [analise, setAnalise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchReport() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sem sessão");

        const res = await fetch(`/api/admin/report?id=${params.id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const result = await res.json();
        
        if (!res.ok) throw new Error(result.error || 'Erro ao carregar relatório');
        setAnalise(result.analise);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [params.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-brand-green" size={48} /></div>;
  }

  if (error || !analise) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Erro ao carregar</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/admin" className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            Voltar ao Painel Admin
          </Link>
        </div>
      </div>
    );
  }

  const findings = analise.findings || {};
  const resumoHtml = findings.isHtmlResumo ? findings.resumo : parseMarkdown(findings.resumo);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-brand-dark text-white p-4 shadow-md">
        <div className="container mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold text-brand-gold flex items-center gap-2">
            <ShieldCheck size={24} />
            Visualização Administrativa do Parecer
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Dados do Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Nome</p>
              <p className="font-bold text-gray-800">{analise.profiles?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">WhatsApp</p>
              <p className="font-bold text-gray-800">{analise.profiles?.whatsapp || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">E-mail</p>
              <p className="font-bold text-gray-800">{analise.profiles?.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fazenda</p>
              <p className="font-bold text-gray-800">{analise.properties?.name} ({analise.properties?.state})</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Valor Pago</p>
              <p className="font-bold text-green-600">R$ {parseFloat(findings.amountPaid || '0').toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-brand-dark mb-6 border-b-2 border-gray-100 pb-3 flex items-center gap-2">
            <Info className="text-brand-gold" size={28} /> Parecer Forense Completo
          </h2>
          <div 
            className="text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-200 text-lg"
            dangerouslySetInnerHTML={{ __html: resumoHtml || 'Nenhum parecer gerado.' }} 
          />
        </div>
      </main>
    </div>
  );
}
