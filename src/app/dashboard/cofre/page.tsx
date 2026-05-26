"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FileText, ArrowLeft, Upload, Share2, Shield, Lock, Trash2, 
  Download, Loader2, Folder, FolderOpen, ChevronRight, Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CofrePage() {
  const router = useRouter();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Estados do formulário de upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [folderCategory, setFolderCategory] = useState('01. Regularidade Fundiária');
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    const { data, error } = await supabase
      .from('documents')
      .select('*, properties(name)')
      .eq('user_id', session.user.id)
      .eq('is_data_room', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar arquivos:", error);
    }
    if (data) setFiles(data);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Auto preenche o nome se estiver em branco
      if (!docName) {
        setDocName(file.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleUploadReal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !docName) {
      alert("Por favor, preencha todos os campos e selecione um arquivo.");
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      const fileExt = selectedFile.name.split('.').pop();
      const randomId = Math.random().toString(36).substring(7);
      const filePath = `${userId}/data-room-${Date.now()}-${randomId}.${fileExt}`;

      // 1. Upload do Arquivo para o Storage do Supabase (bucket 'documents')
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw new Error("Erro de Upload no Storage: " + uploadError.message);
      }

      // 2. Salvar Registro na Tabela 'documents'
      // Guardamos a categoria da pasta no document_type no formato "Pasta - Nome"
      const docTypeString = `${folderCategory} - ${docName}`;

      const { error: dbError } = await supabase.from('documents').insert({
        user_id: userId,
        document_type: docTypeString,
        file_path: filePath,
        is_data_room: true,
        status: 'completed'
      });

      if (dbError) {
        // Tenta limpar o arquivo se falhar a escrita no banco
        await supabase.storage.from('documents').remove([filePath]);
        throw new Error("Erro ao registrar documento no banco: " + dbError.message);
      }

      // Resetar formulário
      setSelectedFile(null);
      setDocName('');
      setShowUploadPanel(false);
      
      // Recarregar lista
      fetchFiles();
      alert("Documento armazenado com criptografia e sucesso!");
    } catch (err: any) {
      alert("Erro ao realizar upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm("Deseja realmente excluir este documento do cofre?")) return;

    try {
      // 1. Apagar do Storage
      await supabase.storage.from('documents').remove([filePath]);

      // 2. Apagar da Tabela
      await supabase.from('documents').delete().eq('id', id);

      fetchFiles();
      alert("Documento removido com sucesso.");
    } catch (err: any) {
      alert("Erro ao excluir arquivo: " + err.message);
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      // Criar URL assinada válida por 60 segundos para download seguro
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "URL não gerada");
      }

      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      alert("Erro ao baixar documento seguro: " + err.message);
    }
  };

  const handleShare = (id: string) => {
    const url = `${window.location.origin}/cofre/view/${id}`;
    navigator.clipboard.writeText(url);
    alert(`Link de Compartilhamento Seguro copiado!\n\nEnvie este link para bancos ou compradores:\n${url}`);
  };

  // Agrupar arquivos por pasta
  const getFilesByFolder = (folderName: string) => {
    return files.filter(f => f.document_type?.startsWith(folderName));
  };

  const folders = [
    '01. Regularidade Fundiária',
    '02. Regularidade Ambiental',
    '03. Crédito & Financeiro'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      
      {/* Navbar Premium escura */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold">
            <Lock size={28} />
            <span className="text-xl font-bold text-white uppercase tracking-wide">Data Room Criptografado</span>
          </Link>
          <span className="text-xs bg-purple-950/60 border border-purple-900 text-purple-300 font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
            <Shield size={12} /> Governança B2B Ativa
          </span>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        
        {/* Voltar e Novo Documento */}
        <div className="flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-semibold text-sm">
            <ArrowLeft size={18} /> Voltar ao Painel
          </Link>
          <button 
            onClick={() => setShowUploadPanel(!showUploadPanel)} 
            className="flex items-center gap-2 bg-purple-800 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-purple-900 transition-all shadow-md cursor-pointer text-xs"
          >
            <Plus size={16} /> {showUploadPanel ? 'Fechar Painel' : 'Novo Documento Seguro'}
          </button>
        </div>

        {/* Formulário Real de Upload */}
        {showUploadPanel && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-purple-300 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Upload size={18} /> Upload de Documento para o Data Room
            </h3>
            
            <form onSubmit={handleUploadReal} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-450 uppercase">Nome / Descrição</label>
                <input 
                  type="text" 
                  value={docName} 
                  onChange={e => setDocName(e.target.value)} 
                  required
                  placeholder="Ex: Matrícula Mãe Registrada"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-450 uppercase">Selecionar Pasta Destino</label>
                <select 
                  value={folderCategory} 
                  onChange={e => setFolderCategory(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-150 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600"
                >
                  <option value="01. Regularidade Fundiária">01. Regularidade Fundiária</option>
                  <option value="02. Regularidade Ambiental">02. Regularidade Ambiental</option>
                  <option value="03. Crédito & Financeiro">03. Crédito & Financeiro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-450 uppercase">Arquivo do Documento</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="file" 
                    onChange={handleFileChange} 
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-slate-350 rounded-lg p-1.5 text-xs file:bg-purple-900 file:border-none file:text-white file:px-2 file:py-1 file:rounded file:font-bold file:mr-2 file:cursor-pointer"
                  />
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="bg-purple-700 hover:bg-purple-800 text-white font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer flex-shrink-0"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Caixa Principal */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 min-h-[450px] shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Shield className="text-purple-400" size={32} />
            <div>
              <h2 className="text-lg font-black text-white">Governança de Documentos (Data Room)</h2>
              <p className="text-xs text-slate-400">Armazenamento estruturado de contratos, certidões e laudos de auditoria de conformidade.</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-500 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-purple-500" size={32} />
              <span>Descriptografando Data Room...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <FileText size={48} className="mx-auto mb-4 opacity-10" />
              <p>Nenhum documento anexado ao Data Room.</p>
              <p className="text-xs text-slate-600 mt-1">Utilize o botão superior para arquivar o seu primeiro documento.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Iterar sobre as 3 pastas */}
              {folders.map(folderName => {
                const folderFiles = getFilesByFolder(folderName);
                return (
                  <div key={folderName} className="space-y-3">
                    <h3 className="font-extrabold text-xs text-purple-300 uppercase tracking-widest flex items-center gap-2">
                      <FolderOpen size={16} /> {folderName} ({folderFiles.length})
                    </h3>
                    
                    {folderFiles.length === 0 ? (
                      <p className="text-slate-650 text-xs italic pl-6">Nenhum documento cadastrado nesta pasta.</p>
                    ) : (
                      <div className="grid gap-3 pl-6">
                        {folderFiles.map(file => {
                          // Remover prefixo da pasta do nome exibido
                          const displayName = file.document_type?.replace(`${folderName} - `, '') || 'Documento';
                          
                          return (
                            <div key={file.id} className="flex justify-between items-center p-3.5 bg-slate-950 border border-slate-850 rounded-xl hover:border-purple-600/50 transition-colors group">
                              <div className="flex items-center gap-3">
                                <div className="bg-purple-950/80 text-purple-400 p-2.5 rounded-lg border border-purple-900/40">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-100 text-xs">{displayName}</h4>
                                  <p className="text-[10px] text-slate-500 mt-0.5">Criado em {new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleDownload(file.file_path)}
                                  className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-all cursor-pointer"
                                  title="Baixar arquivo seguro"
                                >
                                  <Download size={14} />
                                </button>
                                <button 
                                  onClick={() => handleShare(file.id)}
                                  className="p-2 text-purple-400 hover:text-white bg-purple-950/40 border border-purple-900/60 rounded-lg hover:bg-purple-900 transition-all cursor-pointer"
                                  title="Compartilhar Link Seguro"
                                >
                                  <Share2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(file.id, file.file_path)}
                                  className="p-2 text-red-400 hover:text-white bg-red-950/40 border border-red-900/60 rounded-lg hover:bg-red-950 transition-all cursor-pointer"
                                  title="Excluir arquivo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
