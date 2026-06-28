"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Upload, Share2, Shield, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CofrePage() {
  const router = useRouter();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    const { data } = await supabase
      .from('documents')
      .select('*, properties(name)')
      .eq('user_id', session.user.id)
      .eq('is_data_room', true)
      .order('created_at', { ascending: false });

    if (data) setFiles(data);
    setLoading(false);
  };

  const handleShare = (id: string) => {
    const url = `${window.location.origin}/cofre/view/${id}`;
    navigator.clipboard.writeText(url);
    alert(`Link de Compartilhamento Seguro copiado!\n\nEnvie este link para bancos ou compradores:\n${url}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-purple-900 text-white shadow-md">
        <div className="container mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-purple-200">
            <Lock size={28} />
            <span className="text-xl font-bold text-white">Data Room Criptografado</span>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium">
            <ArrowLeft size={20} /> Voltar
          </Link>
          <Link href="/dashboard/nova-analise" className="flex items-center gap-2 bg-purple-700 text-white px-5 py-2 rounded-lg font-bold hover:bg-purple-800 transition-all shadow">
            <Upload size={18} /> Enviar documento (Nova Análise)
          </Link>
        </div>

        {/* Honestidade (Eixo 4): o armazenamento/upload seguro dedicado está em desenvolvimento.
            Hoje os documentos entram pelo fluxo real de Nova Análise. */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <Shield size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Cofre seguro dedicado — em desenvolvimento.</strong> O upload e o compartilhamento
            criptografado de documentos chegam em breve. Por enquanto, envie seus documentos pelo fluxo
            de <Link href="/dashboard/nova-analise" className="underline font-semibold">Nova Análise</Link>,
            onde já ficam armazenados com segurança.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[400px]">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
            <Shield className="text-purple-600" size={32} />
            <div>
              <h2 className="text-xl font-bold text-gray-800">Cofre de Documentos</h2>
              <p className="text-sm text-gray-500">Armazenamento blindado de contratos, ITRs, CCIRs e licenças ambientais.</p>
            </div>
          </div>

          {loading ? (
             <div className="text-center py-10 text-gray-500">Descriptografando cofre...</div>
          ) : files.length === 0 ? (
             <div className="text-center py-20 text-gray-400">
               <FileText size={48} className="mx-auto mb-4 opacity-20" />
               <p>Seu Data Room está vazio.</p>
             </div>
          ) : (
            <div className="grid gap-4">
              {files.map(file => (
                <div key={file.id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 p-3 rounded-lg text-purple-700">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{file.document_type}</h3>
                      <p className="text-xs text-gray-500">Anexado em {new Date(file.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={() => handleShare(file.id)} className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium text-sm bg-purple-50 px-4 py-2 rounded-lg">
                    <Share2 size={16} /> Gerar Link Seguro
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


