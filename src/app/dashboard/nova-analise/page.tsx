"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, UploadCloud, FileText, PlusCircle, XCircle, CreditCard, Layers, CheckCircle2, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MODULE_PRICES: Record<string, number> = {
  titulos_incra: 99.90,
  registros: 149.90,
  geoespacial: 199.90,
  nulidades: 249.90,
  forense: 299.90,
  cruzamento: 499.90,
  moratoria_soja: 249.90,
  gravames_dividas: 199.90,
  cadeia_sucessoria: 299.90,
  credito_carbono: 149.90,
};

export default function NovaAnalisePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<{file: File, type: string}[]>([]);
  const [currentDocType, setCurrentDocType] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>(['titulos_incra']);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  
  // Novos estados para separar o pagamento do início da IA
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'paid'>('idle');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Estados para Integrações GOV
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [carNumber, setCarNumber] = useState("");

  // Estado de Créditos B2B
  const [userCredits, setUserCredits] = useState(0);

  // Busca créditos iniciais
  useEffect(() => {
    const fetchCredits = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from('profiles').select('credits').eq('id', session.user.id).single();
        if (data) setUserCredits(data.credits || 0);
      }
    };
    fetchCredits();
  }, []);

  // Polling invisível na própria tela
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentStatus === 'pending' && currentAnalysisId) {
      interval = setInterval(async () => {
        const { data } = await supabase.from('analyses').select('status').eq('id', currentAnalysisId).single();
        if (data && data.status !== 'payment_pending') {
          setPaymentStatus('paid');
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [paymentStatus, currentAnalysisId]);

  const allModulesList = Object.keys(MODULE_PRICES);
  const totalPrice = selectedModules.reduce((acc, mod) => acc + (MODULE_PRICES[mod] || 0), 0);

  const toggleModule = (id: string) => {
    setSelectedModules(prev => {
      if (prev.includes(id)) {
        return prev.filter(m => m !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAll = () => {
    if (selectedModules.length === allModulesList.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(allModulesList);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (!currentDocType) {
        alert("Selecione o tipo de documento antes de anexar os arquivos.");
        return;
      }
      
      const newFiles = Array.from(e.target.files).map(f => ({ file: f, type: currentDocType }));
      setFiles([...files, ...newFiles]);
      
      // Reset doc type for next
      setCurrentDocType("");
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleStartAnalysis = async () => {
    if (!currentAnalysisId || !currentPropertyId) return;
    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        },
        body: JSON.stringify({ 
          propertyId: currentPropertyId, 
          analysisId: currentAnalysisId,
          analysisLevel: selectedModules.join(','),
          cpfCnpj,
          carNumber
        })
      });

      const resultData = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        throw new Error("Erro na IA: " + (resultData.error || "Falha na comunicação com a API."));
      }

      router.push(`/dashboard/resultado?id=${resultData.analysisId}`);
    } catch (err: any) {
      alert("Erro ao rodar IA: " + err.message);
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (files.length === 0) {
      alert('Por favor, anexe ao menos um documento.');
      return;
    }

    const formData = new FormData(e.currentTarget);

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Sua sessão expirou, faça login novamente.");
        router.push('/login');
        return;
      }
      const userId = session.user.id;

      const name = formData.get('nome') as string;
      const state = formData.get('estado') as string;
      const city = formData.get('municipio') as string;
      const area = formData.get('area') as string;

      // Simulando processamento de pagamento
      await new Promise(r => setTimeout(r, 1500));

      // 0. Garantir que o perfil do usuário existe (Evita erro de Foreign Key se o gatilho SQL falhou)
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
          area: parseFloat(area) || null,
          cpf_cnpj: cpfCnpj || null,
          car_number: carNumber || null
        })
        .select()
        .single();
      if (propError) throw new Error("Erro (1) ao salvar Propriedade no Banco (Verifique as permissões de tabela no Supabase): " + JSON.stringify(propError) + " | Detalhe: " + propError.message);

      // 2. Upload e Insert de TODOS os Documentos
      let firstDocId = null;
      for (const item of files) {
        const fileExt = item.file.name.split('.').pop();
        const filePath = `${userId}/${property.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, item.file);
        if (uploadError) throw new Error("Erro (2) de Upload no Storage (Verifique se o bucket 'documents' foi criado no Supabase): " + JSON.stringify(uploadError));

        const { data: docData, error: docError } = await supabase.from('documents')
          .insert({ property_id: property.id, user_id: userId, file_path: filePath, document_type: item.type, status: 'pending' })
          .select().single();
        if (docError) throw new Error("Erro (3) ao salvar Documento no banco: " + JSON.stringify(docError));

        if (!firstDocId) firstDocId = docData.id;
      }

      // 3. Criar Análise
      const { data: analysis, error: analysisError } = await supabase
        .from('analyses')
        .insert({
          document_id: firstDocId,
          property_id: property.id,
          user_id: userId,
          status: 'payment_pending'
        }).select().single();
      if (analysisError) throw new Error("Erro (4) ao criar Análise: " + JSON.stringify(analysisError));

      setCurrentAnalysisId(analysis.id);
      setCurrentPropertyId(property.id);
      setPaymentStatus('pending');

      if (selectedModules.length === 0) {
        alert("Selecione ao menos um módulo de auditoria.");
        setLoading(false);
        return;
      }

      // [NOVO] Lógica de Pagamento B2B via Créditos
      if (paymentMethod === "credito") {
        if (userCredits <= 0) {
          alert("Você não possui créditos corporativos suficientes. Por favor, adquira um pacote na aba 'Planos B2B'.");
          setLoading(false);
          return;
        }

        // Desconta 1 crédito
        const { error: creditError } = await supabase.from('profiles').update({ credits: userCredits - 1 }).eq('id', userId);
        if (creditError) throw new Error("Erro ao descontar crédito: " + creditError.message);

        // Atualiza a análise para processar (pulando a pendência de pagamento)
        await supabase.from('analyses').update({ status: 'processing' }).eq('id', analysis.id);
        
        setUserCredits(prev => prev - 1);
        setPaymentStatus('paid');
        setLoading(false);
        return; // Sai do submit, o botão 'Iniciar Análise' já ficará ativo!
      }

      // 4. Chamar Checkout (Para Pix e Cartão)
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amountPaid: totalPrice,
          analysisId: analysis.id,
          propertyId: property.id,
          userEmail: session.user.email,
          userName: session.user.user_metadata?.full_name || 'Usuário'
        })
      });
      const checkoutData = await checkoutRes.json();
      if (checkoutData.checkoutUrl) {
        // Redirecionar para o Mercado Pago numa nova aba (não fechar esta)
        window.open(checkoutData.checkoutUrl, '_blank');
      } else {
        throw new Error("Falha ao gerar link de pagamento.");
      }
      
    } catch (error: any) {
      console.error("Erro Completo Capturado:", error);
      
      let msgErro = error.message || "Erro desconhecido";
      if (typeof error === 'object' && Object.keys(error).length > 0) {
        msgErro = JSON.stringify(error);
      }
      
      alert('Erro ao processar (Detalhes Técnicos): ' + msgErro);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-brand-green text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold hover:scale-105 transition-transform">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">Agrilex</span>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-medium">
          <ArrowLeft size={20} /> Voltar ao painel
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-brand-gold">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Nova Auditoria Fundiária</h1>
          <p className="text-gray-600 mb-8 text-lg">Envie uma ou mais matrículas da área e selecione a profundidade da auditoria cruzada.</p>

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
                    <option value="BA">BA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Área (ha)</label>
                  <input name="area" type="number" step="0.01" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none" placeholder="0.00" />
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
                    <option value="Título INCRA">Título do INCRA</option>
                    <option value="Certidão Inteiro Teor">Certidão de Inteiro Teor</option>
                    <option value="KML">Polígono Geoespacial (KML)</option>
                    <option value="GPX">Trilha/Perímetro GPX (GPX)</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="flex-1 flex items-end">
                  <label className="w-full flex items-center justify-center h-[50px] border-2 border-brand-green border-dashed rounded-lg bg-green-50 text-brand-green font-bold cursor-pointer hover:bg-green-100 transition-colors">
                    <PlusCircle size={20} className="mr-2" />
                    Adicionar Arquivos (PDF, KML, GPX)
                    <input type="file" accept=".pdf,.kml,.gpx" multiple className="sr-only" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {files.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-inner">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Documentos Prontos para Auditoria Cruzada:</h3>
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
                  <CheckCircle2 size={16} className={selectedModules.length === allModulesList.length ? "text-brand-green" : "text-gray-400"} /> 
                  {selectedModules.length === allModulesList.length ? "Desmarcar Todos" : "Selecionar Todas as Análises"}
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                
                {/* Módulo 1 */}
                <div 
                  onClick={() => toggleModule("titulos_incra")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('titulos_incra') ? 'border-brand-green bg-green-50 shadow-md ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Auditoria de Títulos INCRA</h3>
                    {selectedModules.includes('titulos_incra') ? <CheckCircle2 className="text-brand-green flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Validação de cláusulas resolutivas, inalienabilidade e posse originária.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 99,90</div>
                </div>

                {/* Módulo 2 */}
                <div 
                  onClick={() => toggleModule("registros")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('registros') ? 'border-brand-green bg-green-50 shadow-md ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Auditoria Registral e Averbações</h3>
                    {selectedModules.includes('registros') ? <CheckCircle2 className="text-brand-green flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Detecção de fraudes cartorárias, cancelamentos e históricos divergentes.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 149,90</div>
                </div>

                {/* Módulo 3 */}
                <div 
                  onClick={() => toggleModule("geoespacial")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('geoespacial') ? 'border-brand-green bg-green-50 shadow-md ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Auditoria Geoespacial e SIGEF</h3>
                    {selectedModules.includes('geoespacial') ? <CheckCircle2 className="text-brand-green flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Sobreposições, limites, CAR e expansão artificial do perímetro.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 199,90</div>
                </div>

                {/* Módulo 4 */}
                <div 
                  onClick={() => toggleModule("nulidades")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('nulidades') ? 'border-brand-gold bg-amber-50 shadow-md ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Mapeamento de Nulidades</h3>
                    {selectedModules.includes('nulidades') ? <CheckCircle2 className="text-brand-gold flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Identificação de nulidade absoluta, violações constitucionais e base legal.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 249,90</div>
                </div>

                {/* Módulo 5 */}
                <div 
                  onClick={() => toggleModule("forense")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('forense') ? 'border-brand-gold bg-amber-50 shadow-md ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Investigação Forense</h3>
                    {selectedModules.includes('forense') ? <CheckCircle2 className="text-brand-gold flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Lavagem patrimonial, laranjas, interposição fraudulenta e simulações.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 299,90</div>
                </div>

                {/* Módulo 6 */}
                <div 
                  onClick={() => toggleModule("cruzamento")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative overflow-hidden bg-gray-900 text-white flex flex-col ${selectedModules.includes('cruzamento') ? 'border-brand-gold shadow-2xl ring-2 ring-brand-gold/50' : 'border-gray-800 hover:border-gray-700'}`}
                >
                  <div className="absolute top-0 right-0 bg-brand-gold text-brand-green text-[10px] font-black px-2 py-1 rounded-bl-lg">MASTER</div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-white leading-tight">Cruzamento Total</h3>
                    {selectedModules.includes('cruzamento') ? <CheckCircle2 className="text-brand-gold flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-600 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 mb-4 flex-grow">Cruzamento absoluto de dados: Matrículas, Processos, INCRA e ITR.</p>
                  <div className="text-xl font-black text-white mt-auto">R$ 499,90</div>
                </div>

                {/* Módulo 7: Moratória da Soja & Rastreabilidade */}
                <div 
                  onClick={() => toggleModule("moratoria_soja")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('moratoria_soja') ? 'border-brand-green bg-green-50 shadow-md ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Rastreabilidade e Moratória</h3>
                    {selectedModules.includes('moratoria_soja') ? <CheckCircle2 className="text-brand-green flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Verificação de conformidade com moratória da soja, TAC da carne e EUDR (desmatamento zero).</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 249,90</div>
                </div>

                {/* Módulo 8: Gravames e Garantias */}
                <div 
                  onClick={() => toggleModule("gravames_dividas")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('gravames_dividas') ? 'border-brand-green bg-green-50 shadow-md ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Gravames e Garantias (CPR)</h3>
                    {selectedModules.includes('gravames_dividas') ? <CheckCircle2 className="text-brand-green flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Rastreamento de CPRs, hipotecas, penhoras averbadas e endividamento patrimonial.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 199,90</div>
                </div>

                {/* Módulo 9: Cadeia Sucessória Forense */}
                <div 
                  onClick={() => toggleModule("cadeia_sucessoria")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('cadeia_sucessoria') ? 'border-brand-green bg-green-50 shadow-md ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Cadeia Sucessória Forense</h3>
                    {selectedModules.includes('cadeia_sucessoria') ? <CheckCircle2 className="text-brand-green flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Mapeamento cronológico sucessivo de proprietários e análise do trato registral.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 299,90</div>
                </div>

                {/* Módulo 10: Créditos de Carbono */}
                <div 
                  onClick={() => toggleModule("credito_carbono")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex flex-col ${selectedModules.includes('credito_carbono') ? 'border-brand-green bg-green-50 shadow-md ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-md font-bold text-gray-900 leading-tight">Viabilidade de Carbono</h3>
                    {selectedModules.includes('credito_carbono') ? <CheckCircle2 className="text-brand-green flex-shrink-0" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-4 flex-grow">Estimativa de estoque de CO2 equivalente e potencial de geração de receita florestal.</p>
                  <div className="text-xl font-black text-gray-800 mt-auto">R$ 149,90</div>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="mb-6 border border-gray-200 rounded-xl p-5 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Forma de Pagamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div 
                    onClick={() => setPaymentMethod("pix")}
                    className={`cursor-pointer rounded-lg border p-4 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === "pix" ? 'border-brand-green bg-green-100 text-brand-green ring-2 ring-brand-green/20' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                  >
                    <QrCode size={20} /> Pix
                  </div>
                  <div 
                    onClick={() => setPaymentMethod("credito")}
                    className={`cursor-pointer rounded-lg border p-4 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === "credito" ? 'border-brand-gold bg-amber-100 text-brand-dark ring-2 ring-brand-gold/50' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                  >
                    <CreditCard size={20} /> Usar Crédito ({userCredits})
                  </div>
                  <div 
                    onClick={() => setPaymentMethod("debito")}
                    className={`cursor-pointer rounded-lg border p-4 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === "debito" ? 'border-brand-green bg-green-100 text-brand-green ring-2 ring-brand-green/20' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                  >
                    <CreditCard size={20} /> Cartão de Crédito
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mt-6">
                <button 
                  disabled={loading || selectedModules.length === 0 || paymentStatus === 'paid'} 
                  type="submit" 
                  className={`flex-1 font-extrabold py-5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3 text-lg ${paymentStatus === 'paid' ? 'bg-gray-100 text-green-600 border border-green-200' : (paymentMethod === 'credito' ? 'bg-brand-dark text-brand-gold hover:brightness-110' : 'bg-brand-green text-white hover:brightness-110 disabled:opacity-50')}`}
                >
                  {paymentStatus === 'paid' ? (
                    <>Pagamento Confirmado <CheckCircle2 size={24} className="text-green-600" /></>
                  ) : paymentStatus === 'pending' ? (
                    <>Aguardando Pagamento... <Layers size={24} className="animate-spin" /></>
                  ) : loading ? 'Processando Documentos...' : (
                    paymentMethod === 'credito' ? `Descontar 1 Crédito` : `Pagar R$ ${totalPrice.toFixed(2).replace('.', ',')}`
                  )}
                </button>
                
                <button 
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={paymentStatus !== 'paid' || isAnalyzing}
                  className={`flex-1 font-extrabold py-5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3 text-lg ${paymentStatus === 'paid' ? 'bg-brand-gold text-brand-dark hover:scale-[1.02]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {isAnalyzing ? 'Auditando (Aguarde)...' : 'Iniciar Parecer com IA'}
                  <ShieldCheck size={24} />
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                <ShieldCheck size={14} /> O sistema detectará automaticamente quando o pagamento for concluído para habilitar a IA
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
