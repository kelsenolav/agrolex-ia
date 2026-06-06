"use client";

import { useState, useRef } from "react";
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, UploadCloud, FileText, PlusCircle, XCircle, Layers, CheckCircle2, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AUDIT_MODULES, getModulePrice, buildDocumentProfile, getModuleCompatibility, calculateAuditModulesTotal } from "@/lib/auditModules";
import { createInitialCaseFile, type CaseFileDocument } from "@/lib/caseFile";

// ─── Constantes de validação documental ────────────────────────────────────
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILE_COUNT = 10;

/**
 * Valida um único arquivo PDF antes do envio ao pipeline.
 * Retorna null se o arquivo for válido, ou uma string com a mensagem de erro.
 */
async function validateFile(file: File): Promise<string | null> {
  // 1. Arquivo vazio
  if (file.size === 0) {
    return "O arquivo enviado está vazio.";
  }

  // 2. Tipo MIME inválido
  if (file.type !== "application/pdf") {
    return "Formato não suportado. Apenas arquivos PDF são aceitos.";
  }

  // 3. Arquivo maior que limite configurado
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `O documento excede o limite permitido de ${MAX_FILE_SIZE_MB} MB.`;
  }

  // 4. PDF corrompido — verifica magic bytes "%PDF" nos primeiros 5 bytes
  try {
    const buffer = await file.slice(0, 5).arrayBuffer();
    const header = new Uint8Array(buffer);
    const magicBytes = String.fromCharCode(...header);
    if (!magicBytes.startsWith("%PDF")) {
      return "O PDF parece corrompido.";
    }
  } catch {
    return "Não foi possível verificar o arquivo PDF.";
  }

  // 5. PDF sem páginas — lê os primeiros 8 KB e procura "/Type"
  //    (PDFs válidos sempre contêm ao menos um dicionário /Type)
  try {
    const sampleSize = Math.min(file.size, 8192);
    const sampleBuffer = await file.slice(0, sampleSize).arrayBuffer();
    const sampleBytes = new Uint8Array(sampleBuffer);
    const sampleText = new TextDecoder("utf-8", { fatal: false }).decode(sampleBytes);
    // PDFs sem páginas não contêm /Type no início do arquivo
    if (!sampleText.includes("/Type")) {
      return "O PDF não contém páginas válidas.";
    }
  } catch {
    return "Não foi possível verificar o conteúdo do PDF.";
  }

  return null;
}

function parseDeclaredAreaHa(value: string | null): number | null {
  const normalizedValue = (value || "").trim().replace(/\s+/g, "");
  if (!normalizedValue) return null;

  const lastComma = normalizedValue.lastIndexOf(",");
  const lastDot = normalizedValue.lastIndexOf(".");
  let numericText = normalizedValue;

  if (lastComma >= 0 && lastDot >= 0) {
    numericText = lastComma > lastDot
      ? normalizedValue.replace(/\./g, "").replace(",", ".")
      : normalizedValue.replace(/,/g, "");
  } else if (lastComma >= 0) {
    numericText = normalizedValue.replace(",", ".");
  }

  const parsed = Number.parseFloat(numericText);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function NovaAnalisePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<{file: File, type: string}[]>([]);
  const [currentDocType, setCurrentDocType] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };
  
  // Estados para Integrações GOV
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [carNumber, setCarNumber] = useState("");

  const allModulesList = AUDIT_MODULES.map(m => m.id);

  // Computar perfil documental e compatibilidade de módulos
  const fileItemsForProfile = files.map(f => ({ name: f.file.name, type: f.type }));
  const docProfile = buildDocumentProfile(fileItemsForProfile);
  const compatibilitySummary = (() => {
    if (docProfile.totalDocuments === 0) {
      return "Nenhum documento anexado. Anexe documentos para habilitar os módulos compatíveis.";
    }

    const messages = [
      `Detectamos ${docProfile.totalDocuments} documento(s) anexado(s), incluindo ${docProfile.totalMatriculas} matrícula(s).`
    ];

    if (docProfile.hasMatricula) {
      messages.push("Recomendamos Análise de Matrícula Individual.");
    }
    if (!docProfile.hasMultipleMatriculas) {
      messages.push("Cruzamento de Matrículas exige duas ou mais matrículas.");
    }
    if (!docProfile.hasGeospatialDocument) {
      messages.push("Auditoria Geoespacial exige CAR, SIGEF, memorial, planta ou coordenadas.");
    }

    return messages.join(" ");
  })();

  const retainCompatibleModules = (modules: string[], nextFiles: { file: File, type: string }[]) => {
    const nextProfile = buildDocumentProfile(nextFiles.map(f => ({ name: f.file.name, type: f.type })));
    return modules.filter(modId => getModuleCompatibility(modId, nextProfile).enabled);
  };

  // Calcular preço sem aplicar teto automático geral
  // Regra:
  // - Se cruzamento_total está selecionado: R$ 499,90
  // - Caso contrário: soma dos módulos individuais sem teto
  const calculateTotalPrice = (modules: string[]) => {
    return calculateAuditModulesTotal(modules);
  };

  const totalPrice = calculateTotalPrice(selectedModules);

  const toggleModule = (id: string) => {
    const comp = getModuleCompatibility(id, docProfile);
    if (!comp.enabled) return;

    setSelectedModules(prev => {
      let next;
      
      // Implementar exclusividade de cruzamento_total
      if (id === "cruzamento_total") {
        // Se clicou em cruzamento_total, desseleciona todos os outros (módulo exclusivo)
        if (prev.includes(id)) {
          // Se já está selecionado, desseleciona
          next = prev.filter(m => m !== id);
        } else {
          // Se não está selecionado, seleciona apenas ele
          next = [id];
        }
      } else {
        // Se clicou em outro módulo
        if (prev.includes(id)) {
          // Se já está selecionado, desseleciona
          next = prev.filter(m => m !== id);
        } else {
          // Se não está selecionado, adiciona e remove cruzamento_total se estiver
          next = [...prev.filter(m => m !== "cruzamento_total"), id];
        }
      }
      
      return next;
    });
  };

  const selectAll = () => {
    // Selecionar apenas os módulos recomendados (não todos os habilitados).
    // EXCLUSÃO: Nunca selecionar cruzamento_total automaticamente; é um pacote exclusivo que deve ser selecionado manualmente.
    const recommendedModules = AUDIT_MODULES.filter(m => 
      m.id !== "cruzamento_total" && getModuleCompatibility(m.id, docProfile).recommended
    ).map(m => m.id);
    setSelectedModules(recommendedModules);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (!currentDocType) {
        showToast("Selecione o tipo de documento antes de anexar os arquivos.", 'error');
        return;
      }

      // Validação 6: Quantidade máxima de arquivos
      if (files.length + e.target.files.length > MAX_FILE_COUNT) {
        showToast(`Limite máximo de ${MAX_FILE_COUNT} arquivos atingido. Remova arquivos antes de adicionar novos.`, 'error');
        return;
      }

      const newFiles: { file: File; type: string }[] = [];

      for (const f of Array.from(e.target.files)) {
        const errorMsg = await validateFile(f);
        if (errorMsg) {
          showToast(errorMsg, 'error');
          return;
        }
        newFiles.push({ file: f, type: currentDocType });
      }

      const nextFiles = [...files, ...newFiles];
      setFiles(nextFiles);
      setSelectedModules(prev => retainCompatibleModules(prev, nextFiles));

      // Reset doc type for next
      setCurrentDocType("");
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    setSelectedModules(prev => retainCompatibleModules(prev, newFiles));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (files.length === 0) {
      showToast('Por favor, anexe ao menos um documento.', 'error');
      return;
    }

    if (selectedModules.length === 0) {
      showToast("Selecione ao menos um módulo de auditoria.", 'error');
      return;
    }

    // Pré-validação documental: re-validar todos os arquivos antes do envio
    for (const item of files) {
      const errorMsg = await validateFile(item.file);
      if (errorMsg) {
        showToast(errorMsg, 'error');
        return;
      }
    }

    // Validação de compatibilidade extra antes do envio
    const incompatible = selectedModules.some(id => !getModuleCompatibility(id, docProfile).enabled);
    if (incompatible) {
      showToast("Sua seleção de módulos contém itens incompatíveis com os documentos anexados. Ajuste antes de enviar.", 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Sua sessão expirou, faça login novamente.", 'error');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }
      const userId = session.user.id;

      const name = formData.get('nome') as string;
      const state = formData.get('estado') as string;
      const city = formData.get('municipio') as string;
      const area = formData.get('area') as string;
      const declaredAreaHa = parseDeclaredAreaHa(area);

      // 0. Garantir que o perfil do usuário existe
      await supabase.from('profiles').upsert({ 
        id: userId, 
        email: session.user.email,
        name: session.user.user_metadata?.full_name || 'Usuário'
      }, { onConflict: 'id' });

      // 1. Salvar Propriedade
      const { data: property, error: propError } = await supabase
        .from('properties')
        .insert({ 
          user_id: userId, 
          name, 
          state, 
          city, 
          area: declaredAreaHa,
          cpf_cnpj: cpfCnpj || null,
          car_number: carNumber || null
        })
        .select()
        .single();
      if (propError) throw new Error("Erro ao salvar Propriedade no Banco: " + propError.message);

      // 2. Upload e Insert de TODOS os Documentos
      let firstDocId = null;
      const uploadedDocuments: CaseFileDocument[] = [];
      const intakeCreatedAt = new Date().toISOString();
      for (const item of files) {
        const fileExt = item.file.name.split('.').pop();
        const filePath = `${userId}/${property.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, item.file);
        if (uploadError) throw new Error("Erro de Upload no Storage: " + uploadError.message);

        const { data: docData, error: docError } = await supabase.from('documents')
          .insert({ property_id: property.id, user_id: userId, file_path: filePath, document_type: item.type, status: 'pending' })
          .select().single();
        if (docError) throw new Error("Erro ao salvar Documento no banco: " + docError.message);

        if (!firstDocId) firstDocId = docData.id;
        uploadedDocuments.push({
          name: item.file.name,
          type: item.type,
          storage_path: filePath,
          size: item.file.size ?? null,
          uploaded_at: intakeCreatedAt
        });
      }

      // 3. Criar Análise com findings básicos estruturados
      const findingsJson = {
        intake_status: "created",
        selected_modules: selectedModules,
        estimated_total: totalPrice,
        current_step: "Análise criada e aguardando liberação para processamento.",
        case_file: createInitialCaseFile({
          now: intakeCreatedAt,
          property: {
            name,
            state,
            city,
            car_number: carNumber || null,
            declared_area_ha: declaredAreaHa,
            owner_document: cpfCnpj || null
          },
          documents: uploadedDocuments
        })
      };

      const { data: analysis, error: analysisError } = await supabase
        .from('analyses')
        .insert({
          document_id: firstDocId,
          property_id: property.id,
          user_id: userId,
          status: 'payment_pending',
          findings: findingsJson
        }).select().single();
      if (analysisError) throw new Error("Erro ao criar Análise: " + analysisError.message);

      showToast("Auditoria criada com sucesso! Redirecionando...", 'success');
      setTimeout(() => router.push('/dashboard'), 1500);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro Completo Capturado:", error);
      showToast('Erro ao criar auditoria: ' + errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

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

      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold hover:scale-105 transition-transform">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">AgroLex</span>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Voltar ao painel
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-brand-gold">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Nova Auditoria Fundiária</h1>
          <p className="text-gray-600 mb-8 text-lg">Envie uma ou mais matrículas da área e selecione a profundidade da auditoria.</p>

          {/* Caixa de Compatibilidade Documental Informativa */}
          <div className="mb-8 p-5 bg-gray-50 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Info size={16} className="text-brand-gold"/> Compatibilidade Documental</h3>
            <p className="text-xs text-gray-600">
              {files.length === 0 ? (
                compatibilitySummary
              ) : (
                `${compatibilitySummary} Módulos recomendados foram destacados em verde. Itens incompatíveis com a documentação foram suspensos.`
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Dados Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Propriedade / Fazenda</label>
                <input name="nome" type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none" placeholder="Ex: Fazenda São Jorge" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Estado</label>
                  <select name="estado" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white">
                    <option value="">Selecione</option>
                    <option value="TO">TO</option>
                    <option value="MT">MT</option>
                    <option value="GO">GO</option>
                    <option value="MS">MS</option>
                    <option value="MG">MG</option>
                    <option value="BA">BA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Área declarada (ha) - opcional</label>
                  <input name="area" type="text" inputMode="decimal" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none" placeholder="Ex.: 122,54 - deixe em branco se não souber" />
                  <p className="text-xs text-gray-500 mt-1">Se não souber a área, deixe em branco. O sistema poderá extrair ou comparar a área a partir dos documentos enviados.</p>
                </div>
              </div>

              {/* [NOVO] Integração Governamental */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2 border-t pt-6 mt-2">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">CPF ou CNPJ do Proprietário (Opcional)</label>
                  <input 
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    type="text" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none" 
                    placeholder="Busca automática IBAMA e Receita Federal" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Número do CAR (Opcional)</label>
                  <input 
                    value={carNumber}
                    onChange={(e) => setCarNumber(e.target.value)}
                    type="text" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none" 
                    placeholder="MT-5103403-1E5A..." 
                  />
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Município</label>
              <input name="municipio" type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none" placeholder="Ex: Palmas" />
            </div>

            {/* Upload de Múltiplos Arquivos */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText className="text-brand-gold"/> Documentos da Área (Envie múltiplas matrículas se houver)</h2>
              
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Selecione o Tipo do Documento</label>
                  <select value={currentDocType} onChange={e => setCurrentDocType(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white">
                    <option value="">Selecione para anexar...</option>
                    <option value="Matrícula">Matrícula (Atual ou Antiga)</option>
                    <option value="CAR">CAR</option>
                    <option value="CCIR">CCIR</option>
                    <option value="SIGEF">SIGEF</option>
                    <option value="Memorial">Memorial Descritivo</option>
                    <option value="Planta">Planta</option>
                    <option value="Coordenadas">Coordenadas</option>
                    <option value="Documento Geoespacial">Documento Geoespacial</option>
                    <option value="Título INCRA">Título do INCRA</option>
                    <option value="Certidão Inteiro Teor">Certidão de Inteiro Teor</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="flex-1 flex items-end">
                  <label className="w-full flex items-center justify-center h-[50px] border-2 border-brand-green border-dashed rounded-lg bg-green-50 text-brand-green font-bold cursor-pointer hover:bg-green-100 transition-colors">
                    <PlusCircle size={20} className="mr-2" />
                    Adicionar Arquivos (PDF)
                    <input type="file" accept=".pdf" multiple className="sr-only" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {files.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-inner">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Documentos Prontos para Auditoria:</h3>
                  <ul className="space-y-3">
                    {files.map((item, index) => (
                      <li key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-100 p-2 rounded text-brand-green"><FileText size={20} /></div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{item.type}</p>
                            <p className="text-xs text-gray-500 font-medium truncate max-w-xs">{item.file.name}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeFile(index)} className="text-red-400 hover:text-red-600 transition-colors p-2 bg-red-50 rounded-full hover:bg-red-100">
                          <XCircle size={20} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Seleção de Módulos Específicos e Checkout */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Layers className="text-brand-gold"/> Selecione o Foco da Auditoria Forense
                </h2>
                <button 
                  type="button" 
                  onClick={selectAll}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors border border-gray-300 text-sm flex items-center gap-2"
                >
                  <CheckCircle2 size={16} /> 
                  Selecionar recomendados
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                
                {AUDIT_MODULES.map((mod) => {
                  const isSelected = selectedModules.includes(mod.id);
                  const isMaster = mod.id === "cruzamento_total";
                  const compatibility = getModuleCompatibility(mod.id, docProfile);
                  
                  return (
                    <div 
                      key={mod.id}
                      onClick={() => toggleModule(mod.id)}
                      className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative overflow-hidden flex flex-col ${
                        !compatibility.enabled
                          ? "opacity-45 border-gray-200 bg-gray-50/50 cursor-not-allowed text-gray-400 select-none pointer-events-none"
                          : isMaster 
                            ? isSelected
                              ? "bg-gray-900 text-white border-brand-gold shadow-2xl ring-2 ring-brand-gold/50"
                              : "bg-gray-900/90 text-gray-100 border-gray-800 hover:border-gray-700"
                            : isSelected
                              ? "border-brand-green bg-green-50 shadow-md ring-2 ring-green-100 text-gray-900"
                              : "border-gray-200 hover:border-gray-300 text-gray-900"
                      }`}
                    >
                      {isMaster && compatibility.enabled && (
                        <div className="absolute top-0 right-0 bg-brand-gold text-brand-green text-[10px] font-black px-2 py-1 rounded-bl-lg">
                          MASTER
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`text-md font-bold leading-tight ${!compatibility.enabled ? "text-gray-400" : isMaster ? "text-white" : "text-gray-900"}`}>
                          {mod.name}
                        </h3>
                        {isSelected && compatibility.enabled ? (
                          <CheckCircle2 className={isMaster ? "text-brand-gold flex-shrink-0" : "text-brand-green flex-shrink-0"} size={24} />
                        ) : (
                          <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ${!compatibility.enabled ? "border-gray-200" : isMaster ? "border-gray-600" : "border-gray-300"}`}></div>
                        )}
                      </div>
                      
                      <p className={`text-xs mt-1 mb-4 flex-grow ${!compatibility.enabled ? "text-gray-300" : isMaster ? "text-gray-400" : "text-gray-500"}`}>
                        {mod.description}
                      </p>

                      {/* Notificações e Razões de Incompatibilidade */}
                      {!compatibility.enabled && compatibility.reason && (
                        <div className="text-[11px] text-red-500 font-bold mb-3 flex items-center gap-1">
                          <ShieldAlert size={14} /> {compatibility.reason}
                        </div>
                      )}

                      {/* Ressalvas e Alertas de Limitação */}
                      {compatibility.enabled && compatibility.warning && (
                        <div className="text-[10px] text-amber-600 font-semibold mb-3 leading-normal border-l-2 border-amber-300 pl-2 bg-amber-50/50 py-1">
                          {compatibility.warning}
                        </div>
                      )}
                      
                      <div className={`text-xl font-black mt-auto ${!compatibility.enabled ? "text-gray-300" : isMaster ? "text-white" : "text-gray-800"}`}>
                        R$ {mod.price.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            <div className="pt-6">
              <div className="mb-6 border border-gray-200 rounded-xl p-5 bg-gray-50 text-center">
                <p className="text-gray-700 font-bold text-lg">Valor estimado da auditoria: R$ {totalPrice.toFixed(2).replace('.', ',')}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Após a confirmação, a análise será criada como pendente. Realize o pagamento para liberar o processamento.
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mt-6">
                <button 
                  disabled={loading || selectedModules.length === 0} 
                  type="submit" 
                  className="flex-1 font-extrabold py-5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3 text-lg bg-brand-green text-white hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? 'Processando Documentos...' : 'Enviar Documentos para Auditoria'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
