"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Upload, Share2, Shield, Lock, Download, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DataRoomDoc {
  id: string;
  document_type: string;
  file_path: string;
  created_at: string;
}

export default function CofrePage() {
  const router = useRouter();
  const [files, setFiles] = useState<DataRoomDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    const { data } = await supabase
      .from('documents')
      .select('id, document_type, file_path, created_at')
      .eq('user_id', session.user.id)
      .eq('is_data_room', true)
      .order('created_at', { ascending: false });

    if (data) setFiles(data as DataRoomDoc[]);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ''; // permite reenviar o mesmo arquivo
    if (!file) return;

    // O bucket `documents` aceita apenas PDF (até 50MB) — valida antes de subir.
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      alert('Por enquanto o Data Room aceita apenas arquivos PDF.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('Arquivo muito grande. O limite é 50 MB.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${session.user.id}/dataroom-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: docError } = await supabase.from('documents').insert({
        user_id: session.user.id,
        file_path: filePath,
        document_type: file.name,
        is_data_room: true,
        status: 'completed',
      });
      if (docError) throw docError;

      await fetchFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Não foi possível enviar o documento: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: DataRoomDoc) => {
    setBusyId(file.id);
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(file.file_path, 3600);
      if (error || !data?.signedUrl) throw error || new Error('URL indisponível');
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch {
      alert('Não foi possível abrir o documento agora. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const handleShare = async (file: DataRoomDoc) => {
    setBusyId(file.id);
    try {
      // Link seguro com prazo de 7 dias — funciona para bancos/compradores sem login.
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(file.file_path, 604800);
      if (error || !data?.signedUrl) throw error || new Error('URL indisponível');
      await navigator.clipboard.writeText(data.signedUrl);
      alert(`Link seguro copiado! Válido por 7 dias.\n\nEnvie para bancos ou compradores:\n${data.signedUrl}`);
    } catch {
      alert('Não foi possível gerar o link agora. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (file: DataRoomDoc) => {
    if (!confirm(`Excluir "${file.document_type}" do Data Room? Esta ação não pode ser desfeita.`)) return;
    setBusyId(file.id);
    try {
      await supabase.storage.from('documents').remove([file.file_path]);
      await supabase.from('documents').delete().eq('id', file.id);
      await fetchFiles();
    } catch {
      alert('Não foi possível excluir agora. Tente novamente.');
    } finally {
      setBusyId(null);
    }
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
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-purple-700 text-white px-5 py-2 rounded-lg font-bold hover:bg-purple-800 transition-all shadow disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {uploading ? 'Enviando...' : 'Novo Documento Seguro'}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[400px]">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
            <Shield className="text-purple-600" size={32} />
            <div>
              <h2 className="text-xl font-bold text-gray-800">Cofre de Documentos</h2>
              <p className="text-sm text-gray-500">Armazenamento privado de contratos, ITRs, CCIRs e licenças (PDF, até 50 MB). Compartilhe com links seguros e temporários.</p>
            </div>
          </div>

          {loading ? (
             <div className="text-center py-10 text-gray-500 flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Carregando cofre...</div>
          ) : files.length === 0 ? (
             <div className="text-center py-20 text-gray-400">
               <FileText size={48} className="mx-auto mb-4 opacity-20" />
               <p>Seu Data Room está vazio.</p>
               <p className="text-xs mt-1">Envie um documento para guardá-lo com segurança.</p>
             </div>
          ) : (
            <div className="grid gap-4">
              {files.map(file => (
                <div key={file.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="bg-purple-100 p-3 rounded-lg text-purple-700 flex-shrink-0">
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{file.document_type}</h3>
                      <p className="text-xs text-gray-500">Anexado em {new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleDownload(file)} disabled={busyId === file.id} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-medium text-sm bg-gray-100 px-3 py-2 rounded-lg disabled:opacity-50">
                      <Download size={16} /> Abrir
                    </button>
                    <button onClick={() => handleShare(file)} disabled={busyId === file.id} className="flex items-center gap-1.5 text-purple-600 hover:text-purple-800 font-medium text-sm bg-purple-50 px-3 py-2 rounded-lg disabled:opacity-50">
                      {busyId === file.id ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Link Seguro
                    </button>
                    <button onClick={() => handleDelete(file)} disabled={busyId === file.id} className="flex items-center gap-1.5 text-red-500 hover:text-red-700 font-medium text-sm bg-red-50 px-3 py-2 rounded-lg disabled:opacity-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
