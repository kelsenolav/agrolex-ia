"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  ArrowLeft, 
  UploadCloud, 
  FileText, 
  Lock, 
  ChevronRight, 
  HardDrive, 
  Download, 
  Trash2, 
  Plus,
  Compass,
  AlertTriangle,
  Layers,
  History
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import DocumentFolderCard from '@/components/dataroom/DocumentFolderCard';
import AlertsPanel, { ExpirationAlert } from '@/components/dataroom/AlertsPanel';
import { Bell } from 'lucide-react';

interface MockDocument {
  id: string;
  name: string;
  category: string;
  uploadedAt: string;
  fileSize: string;
  status: 'auditado' | 'pendente';
  riskScore?: number;
}

export default function DataRoomPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Profissional");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Categorias de Elite do AgroLex
  const folders = [
    {
      id: 'matriculas',
      title: 'Matrículas e Cadeia Dominial',
      description: 'Certidões de inteiro teor, cadeias dominiais completas e históricos de registros públicos de imóveis.',
      fileCount: 4,
      riskLevel: 'Médio' as const,
      lastUpdated: '08/06/2026'
    },
    {
      id: 'ambientais',
      title: 'Cadastros Ambientais e Defesas',
      description: 'Inscrições no CAR, relatórios de desmatamento, defesas de infrações e termos de compromisso ambiental.',
      fileCount: 2,
      riskLevel: 'Baixo' as const,
      lastUpdated: '05/06/2026'
    },
    {
      id: 'certidoes',
      title: 'Certidões Fundiárias e Possessórias',
      description: 'CCIR, comprovantes de ITR, certificações do SIGEF, memoriais descritivos e certidões de posse.',
      fileCount: 3,
      riskLevel: 'Baixo' as const,
      lastUpdated: '07/06/2026'
    },
    {
      id: 'litigios',
      title: 'Pasta de Litígios e Ações Judiciais',
      description: 'Processos possessórios, execuções de dívidas civis, notificações judiciais e contestações ativas.',
      fileCount: 1,
      riskLevel: 'Crítico' as const,
      lastUpdated: '08/06/2026'
    }
  ];

  // Documentos mockados estruturados
  const [documents, setDocuments] = useState<MockDocument[]>([
    {
      id: 'doc-1',
      name: 'Matricula_Fazenda_Sao_Jorge_R02.pdf',
      category: 'matriculas',
      uploadedAt: '08/06/2026 14:15',
      fileSize: '4.2 MB',
      status: 'auditado',
      riskScore: 78
    },
    {
      id: 'doc-2',
      name: 'Certidao_Vintenaria_Cadeia_Dominial.pdf',
      category: 'matriculas',
      uploadedAt: '08/06/2026 14:18',
      fileSize: '8.7 MB',
      status: 'auditado',
      riskScore: 82
    },
    {
      id: 'doc-3',
      name: 'Memorial_Descritivo_Palmas_TO.pdf',
      category: 'certidoes',
      uploadedAt: '07/06/2026 09:30',
      fileSize: '1.8 MB',
      status: 'auditado',
      riskScore: 95
    },
    {
      id: 'doc-4',
      name: 'Recibo_Inscricao_CAR_Fazenda_Completo.pdf',
      category: 'ambientais',
      uploadedAt: '05/06/2026 16:45',
      fileSize: '2.5 MB',
      status: 'auditado',
      riskScore: 92
    },
    {
      id: 'doc-5',
      name: 'Notificacao_Interdito_Proibitorio_Comarca.pdf',
      category: 'litigios',
      uploadedAt: '08/06/2026 11:20',
      fileSize: '3.1 MB',
      status: 'auditado',
      riskScore: 25
    }
  ]);

  // Alertas Preventivos de Vencimento de Elite
  const [alerts, setAlerts] = useState<ExpirationAlert[]>([
    {
      id: 'alert-1',
      documentName: 'Certidao_Onus_Fazenda_Sao_Jorge.pdf',
      documentType: 'Certidão de Ônus (Matrícula)',
      expirationDate: '12/06/2026',
      daysRemaining: 4,
      urgency: 'critico',
      warningMessage: 'Aviso: Certidões de matrícula com mais de 30 dias de expedição são recusadas por cartórios e instituições financeiras. Atualize imediatamente para evitar atrasos em transações ou renegociações.'
    },
    {
      id: 'alert-2',
      documentName: 'CCIR_Exercicio_2025.pdf',
      documentType: 'Certificado de Cadastro de Imóvel Rural (CCIR)',
      expirationDate: '28/06/2026',
      daysRemaining: 20,
      urgency: 'atencao',
      warningMessage: 'Aviso: A ausência de CCIR atualizado e quitado impede a lavratura de escrituras públicas de compra e venda, o desmembramento do imóvel e a contratação de novos créditos agrícolas (CPR).'
    },
    {
      id: 'alert-3',
      documentName: 'Recibo_Inscricao_CAR_Sema.pdf',
      documentType: 'Cadastro Ambiental Rural (CAR)',
      expirationDate: '15/09/2026',
      daysRemaining: 99,
      urgency: 'regular',
      warningMessage: 'Status Regular: O cadastro ambiental está ativo e em conformidade. O monitoramento contínuo evita surpresas com novas multas ou embargos de áreas consolidadas.'
    }
  ]);

  const handleUpdateDocument = (docType: string) => {
    showToast(`Redirecionando para atualização da auditoria do tipo: ${docType}`, "info");
    setTimeout(() => {
      router.push('/dashboard/nova-analise');
    }, 1500);
  };

  const handleNotifyWhatsApp = (alert: ExpirationAlert) => {
    showToast(`Disparando notificação preventiva no WhatsApp para o cliente...`, "success");
    // Simula envio de mensagem com template estruturado
    console.log(`[WhatsApp Simulado] Alerta de Vencimento: ${alert.documentType} vence em ${alert.expirationDate}. Risco: ${alert.urgency.toUpperCase()}. Mensagem: ${alert.warningMessage}`);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const name = session.user.user_metadata?.full_name;
      if (name) setUserName(name.split(' ')[0]);
      setLoading(false);
    };
    checkUser();
  }, [router]);

  const handleUpload = () => {
    setUploading(true);
    showToast("Preparando canal criptografado para o Data Room...", "info");
    
    setTimeout(() => {
      setUploading(false);
      showToast("Este é um protótipo funcional. O upload seguro via Storage estará disponível no próximo sprint.", "success");
    }, 1500);
  };

  const handleDelete = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    showToast("Documento removido da gaveta local com sucesso.", "success");
  };

  const activeDocuments = selectedFolder 
    ? documents.filter(d => d.category === selectedFolder)
    : documents;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Autenticando cofre seguro...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold hover:scale-105 transition-transform">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">AgroLex</span>
          </Link>
          <div className="flex gap-4 items-center">
            <span className="text-sm font-medium">Olá, {userName}</span>
            <Link href="/dashboard" className="text-sm text-brand-gold hover:underline font-bold">Voltar ao Painel</Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Link */}
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Painel Principal
        </Link>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lock size={20} className="text-brand-gold" />
              <span className="text-brand-green font-bold text-xs uppercase tracking-wider">Cofre de Segurança Criptografado</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
              Data Room Forense
              {alerts.filter(a => a.urgency === 'critico').length > 0 && (
                <span className="flex items-center gap-1 bg-red-100 text-red-800 border border-red-200 text-xs px-2.5 py-1 rounded-full font-black animate-pulse">
                  <Bell size={12} className="text-red-700" />
                  {alerts.filter(a => a.urgency === 'critico').length} Alerta Crítico
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-1">Gestão de ativos documentais, certidões ambientais e peças de litígios.</p>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 bg-brand-gold text-brand-green px-5 py-3 rounded-lg font-bold hover:brightness-110 transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50"
          >
            <UploadCloud size={20} />
            {uploading ? 'Carregando...' : 'Adicionar Novo Documento'}
          </button>
        </div>

        {/* Visão de Pastas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {folders.map((folder) => (
            <DocumentFolderCard
              key={folder.id}
              title={folder.title}
              description={folder.description}
              fileCount={documents.filter(d => d.category === folder.id).length}
              riskLevel={folder.riskLevel}
              lastUpdated={folder.lastUpdated}
              onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
            />
          ))}
        </div>

        {/* Central de Alertas Preventivos de Vencimento */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-10">
          <div className="flex items-center gap-2 mb-6">
            <Bell size={22} className="text-brand-green" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">Central de Alertas Preventivos</h2>
              <p className="text-xs text-gray-500">Monitoramento ativo da validade de cadastros e certidões essenciais.</p>
            </div>
          </div>

          <AlertsPanel 
            alerts={alerts}
            onUpdateDocument={handleUpdateDocument}
            onNotifyWhatsApp={handleNotifyWhatsApp}
          />
        </div>

        {/* Painel do Data Room / Gaveta de Arquivos */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <HardDrive size={20} className="text-brand-green" />
              <h2 className="text-lg font-bold text-gray-800">
                {selectedFolder 
                  ? `Gaveta: ${folders.find(f => f.id === selectedFolder)?.title}`
                  : 'Todos os Arquivos Auditados'
                }
              </h2>
            </div>
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-xs text-brand-gold hover:underline font-bold"
              >
                Limpar filtro / Mostrar todos
              </button>
            )}
          </div>

          {activeDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">Nenhum documento anexado nesta pasta jurídica.</p>
              <p className="text-gray-400 text-xs mt-1">Utilize o botão de upload acima para inserir certidões ou arquivos.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeDocuments.map((doc) => (
                <div key={doc.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 bg-gray-100 text-gray-500 rounded-lg flex-shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 mt-1 font-medium">
                        <span>{doc.fileSize}</span>
                        <span>•</span>
                        <span>Gaveta: {folders.find(f => f.id === doc.category)?.title}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <History size={12} /> Enviado em {doc.uploadedAt}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end">
                    {doc.riskScore !== undefined && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                        doc.riskScore >= 70 ? 'bg-green-50 text-green-700 border-green-200' :
                        doc.riskScore >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        ISF {doc.riskScore}
                      </span>
                    )}

                    <button 
                      onClick={() => showToast(`Baixando ${doc.name} de forma segura...`, "success")}
                      className="p-2 text-gray-400 hover:text-brand-green hover:bg-gray-100 rounded-lg transition-colors"
                      title="Download do documento seguro"
                    >
                      <Download size={18} />
                    </button>
                    
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover documento"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Copy de Alta Autoridade */}
        <div className="mt-8 p-5 bg-gradient-to-r from-brand-green/5 to-brand-green/10 rounded-2xl border border-brand-green/10 flex items-start gap-4">
          <ShieldCheck size={28} className="text-brand-green flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-gray-800 mb-1">Governança e Criptografia do Data Room Forense</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Todos os documentos armazenados no AgroLex são processados por meio de canais de criptografia de ponta a ponta (AES-256) e armazenados com redundância sistêmica. As informações de risco extraídas das peças ambientais e certidões auxiliam na consolidação jurídica do seu imóvel para fins de herança, garantias bancárias ou diligência de compra e venda.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
