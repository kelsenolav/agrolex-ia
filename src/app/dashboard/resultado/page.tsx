"use client";
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, AlertTriangle, FileCheck, Info, CheckCircle2, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

import { mockResponses } from './mockData';

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
    .replace(/\n4\. (.*?)/g, '<br/><span class="text-brand-gold font-bold mr-2">4.</span> $1')
    .replace(/\n5\. (.*?)/g, '<br/><span class="text-brand-gold font-bold mr-2">5.</span> $1')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/---/g, '<hr class="my-6 border-gray-300"/>');
}

function ResultadoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [analise, setAnalise] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalise = async () => {
      const id = searchParams.get('id');
      
      if (!id || id.startsWith('mock')) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('analyses')
        .select(`
          *,
          properties (name, city, state),
          documents (document_type, file_path)
        `)
        .eq('id', id)
        .single();

      if (data) setAnalise(data);
      setLoading(false);
    };
    
    fetchAnalise();
  }, [searchParams]);

  // Polling para aguardar a IA (que agora roda assíncrona via waitUntil)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analise && analise.status === 'processing') {
      interval = setInterval(async () => {
        const { data } = await supabase.from('analyses')
          .select('*, properties(name, city, state), documents(document_type, file_path)')
          .eq('id', analise.id).single();
        
        if (data && data.status !== 'processing') {
          setAnalise(data);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [analise]);

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-brand-green" size={48} /></div>;
  }

  if (analise && analise.status === 'processing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-brand-green">
          <div className="w-20 h-20 bg-brand-green text-white rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 size={40} className="animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Agrilex em Ação...</h2>
          <p className="text-gray-600 mb-6">
            O sistema está auditando as páginas e extraindo os dados. Pode demorar até 1 minuto. Você receberá um E-mail assim que acabar, sinta-se livre para fechar ou aguardar aqui!
          </p>
        </div>
      </div>
    );
  }

  const isMock = !analise;
  const moduleParam = searchParams.get('module') || 'titulos_incra';
  const selectedModules = moduleParam.split(',');
  const propName = isMock ? "Fazenda Boa Esperança (Amostra)" : analise.properties?.name;
  const propLocation = isMock ? "Goiás, GO" : `${analise.properties?.city}, ${analise.properties?.state}`;
  const risco = isMock ? "Alto" : (analise.risk_level || "Pendente");
  
  const mockText = selectedModules
    .map(m => mockResponses[m])
    .filter(Boolean)
    .join('\n\n---\n\n');
    
  const mockHtml = parseMarkdown(mockText || mockResponses['titulos_incra']);

  let finalResumo = mockHtml;
  if (!isMock && analise.findings?.resumo) {
    // Se a IA enviou markdown, processa no frontend para ficar bonito
    finalResumo = analise.findings.isHtmlResumo ? analise.findings.resumo : parseMarkdown(analise.findings.resumo);
  }

  const findings = isMock || !analise.findings?.resumo ? {
    isHtmlResumo: true,
    resumo: mockHtml,
    problemas: [],
    recomendacoes: [],
    documentosFaltantes: [],
    linhaDoTempo: []
  } : {
    ...analise.findings,
    isHtmlResumo: true,
    resumo: finalResumo
  };

  const getRiscoStyle = (r: string) => {
    const rLower = r?.toLowerCase();
    if (rLower === 'alto') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', labelText: 'text-red-800' };
    if (rLower === 'medio' || rLower === 'médio') return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', labelText: 'text-yellow-800' };
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', labelText: 'text-green-800' };
  };
  const styles = getRiscoStyle(risco);

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Esconder a barra de navegação na impressão */}
      <nav className="bg-brand-green text-white shadow-md print:hidden">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold hover:scale-105 transition-transform">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">Agrilex</span>
          </Link>
        </div>
      </nav>

      {/* Cabeçalho exclusivo para Impressão PDF */}
      <div className="hidden print:flex justify-between items-center border-b-2 border-brand-green pb-6 mb-6">
        <div className="flex items-center gap-2 text-brand-green">
          <ShieldCheck size={36} />
          <span className="text-3xl font-bold text-gray-900">AGRILEX</span>
        </div>
        <div className="text-right text-gray-500 text-sm">
          <p>Laudo Pericial Oficial - IA</p>
          <p>Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-4xl print:py-0">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green mb-6 transition-colors w-fit font-medium print:hidden">
          <ArrowLeft size={20} /> Voltar ao painel
        </Link>

        {/* Cabeçalho */}
        <div className="bg-white p-8 rounded-t-2xl shadow-lg border border-gray-100 border-b-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:shadow-none print:border-b">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-gray-800">Auditoria Forense IA</h1>
              <span className="px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm print:shadow-none">Concluído</span>
            </div>
            <p className="text-gray-500 font-medium text-lg">{propName} • {propLocation}</p>
          </div>
          <div className={`text-center ${styles.bg} p-5 rounded-xl border ${styles.border} shadow-sm print:shadow-none print:border`}>
            <p className={`text-xs font-bold ${styles.labelText} uppercase tracking-widest mb-1`}>Grau de Risco</p>
            <div className={`flex items-center gap-2 ${styles.text} justify-center`}>
              <AlertTriangle size={28} />
              <span className="text-3xl font-black">{risco?.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Corpo do Relatório */}
        <div className="bg-white p-8 rounded-b-2xl shadow-lg border border-gray-100 space-y-10 print:shadow-none print:border-none print:p-4">
          
          {/* Resumo */}
          <section>
            <h2 className="text-2xl font-bold text-brand-dark mb-4 border-b-2 border-gray-100 pb-3 flex items-center gap-2">
              <Info className="text-brand-gold" size={28} /> Parecer Executivo
            </h2>
            {findings.isHtmlResumo ? (
              <div 
                className="text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-200 text-lg print:bg-white"
                dangerouslySetInnerHTML={{ __html: findings.resumo }} 
              />
            ) : (
              <p className="text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-200 text-lg print:bg-white whitespace-pre-wrap">
                {findings.resumo}
              </p>
            )}
          </section>

          {/* LINHA DO TEMPO (Renderizada apenas se existir) */}
          {findings.linhaDoTempo && findings.linhaDoTempo.length > 0 && (
            <section className="print:break-inside-avoid border-b-2 border-gray-100 pb-10">
              <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                <Clock className="text-brand-gold" size={28} /> Linha do Tempo Registral
              </h2>
              <div className="relative border-l-2 border-brand-green/30 ml-3 md:ml-6 space-y-8">
                {findings.linhaDoTempo.map((item: any, i: number) => (
                  <div key={i} className="relative pl-8 md:pl-10">
                    <div className="absolute -left-[9px] top-1 bg-white border-4 border-brand-green w-4 h-4 rounded-full"></div>
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow print:bg-white print:shadow-none print:border-b">
                      <span className="inline-block px-3 py-1 bg-brand-gold text-brand-green font-black text-sm rounded-md mb-2 shadow-sm print:border">{item.data}</span>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">{item.evento}</h3>
                      <p className="text-gray-600 leading-relaxed">{item.detalhe}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid md:grid-cols-2 gap-8 print:block print:space-y-8">
            <section className="print:break-inside-avoid">
              <h2 className="text-xl font-bold text-brand-dark mb-4 border-b-2 border-gray-100 pb-3 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} /> Problemas / Divergências
              </h2>
              <ul className="space-y-4">
                {findings.problemas?.map((prob: string, i: number) => (
                  <li key={i} className="flex items-start gap-4 bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm print:shadow-none print:bg-white">
                    <div className="mt-0.5 bg-red-200 rounded-full p-1.5"><AlertTriangle size={16} className="text-red-700" /></div>
                    <span className="text-red-900 font-medium">{prob}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="print:break-inside-avoid print:mt-8">
              <h2 className="text-xl font-bold text-brand-dark mb-4 border-b-2 border-gray-100 pb-3 flex items-center gap-2">
                <FileCheck className="text-orange-500" size={24} /> Documentos Faltantes
              </h2>
              <ul className="space-y-4">
                {findings.documentosFaltantes?.map((doc: string, i: number) => (
                  <li key={i} className="flex items-center gap-4 bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm print:shadow-none print:bg-white">
                    <div className="bg-orange-200 p-1.5 rounded-full"><Info size={16} className="text-orange-700" /></div>
                    <span className="text-orange-900 font-medium">{doc}</span>
                  </li>
                ))}
                {(!findings.documentosFaltantes || findings.documentosFaltantes.length === 0) && (
                   <li className="text-gray-500 italic p-4">Nenhum documento listado.</li>
                )}
              </ul>
            </section>
          </div>

          <section className="print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-brand-dark mb-4 border-b-2 border-gray-100 pb-3 flex items-center gap-2">
              <CheckCircle2 className="text-brand-green" size={28} /> Recomendações Técnicas
            </h2>
            <div className="bg-green-50 p-8 rounded-2xl border border-green-200 shadow-sm print:shadow-none print:bg-white print:border">
              <ul className="space-y-4 text-green-900 font-medium text-lg">
                {findings.recomendacoes?.map((rec: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 flex-shrink-0 text-green-600" size={20} />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* CHECKLIST DA CADEIA DOMINIAL (CAMADA 3) */}
          {findings.checklist && findings.checklist.length > 0 && (
            <section className="print:break-inside-avoid pt-4">
              <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                <ShieldCheck className="text-brand-gold" size={28} /> Auditoria da Cadeia Dominial & Princípios Registrais
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {findings.checklist.map((item: any, i: number) => {
                  const isReprovado = item.status?.toLowerCase().includes('reprovado') || item.status?.toLowerCase().includes('violado');
                  const isAlerta = item.status?.toLowerCase().includes('alerta');
                  
                  let badgeColors = "bg-green-100 text-green-800 border-green-200";
                  let Icon = CheckCircle2;
                  
                  if (isReprovado) {
                    badgeColors = "bg-red-100 text-red-800 border-red-200";
                    Icon = AlertTriangle;
                  } else if (isAlerta) {
                    badgeColors = "bg-yellow-100 text-yellow-800 border-yellow-200";
                    Icon = AlertTriangle;
                  }

                  return (
                    <div key={i} className={`p-4 rounded-xl border shadow-sm flex flex-col ${isReprovado ? 'bg-red-50' : isAlerta ? 'bg-yellow-50' : 'bg-white'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-gray-800 text-sm">{item.quesito}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border flex items-center gap-1 ${badgeColors}`}>
                          <Icon size={12} /> {item.status?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mt-auto">{item.justificativa}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* PEÇA JURÍDICA (CAMADA 4) */}
          {findings.pecaJuridica && (
            <section className="print:break-inside-avoid pt-4">
              <div className="bg-gray-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-brand-gold text-brand-green text-xs font-black px-4 py-2 rounded-bl-xl shadow-lg">PREMIUM</div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <FileCheck className="text-brand-gold" size={28} /> Solução Jurídica Gerada
                </h2>
                <p className="text-gray-300 mb-6">A Inteligência Artificial preparou uma minuta/parecer completo baseado nos apontamentos forenses desta auditoria. O documento está formatado e pronto para uso.</p>
                
                <div className="bg-white text-gray-900 p-6 rounded-xl max-h-64 overflow-y-auto mb-6 shadow-inner text-sm font-serif">
                  <div dangerouslySetInnerHTML={{ __html: findings.pecaJuridica }} />
                </div>
                
                <button onClick={() => {
                  const blob = new Blob(['\\ufeff', findings.pecaJuridica], { type: 'application/msword' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Peca_Juridica_${propName?.replace(/\s+/g, '_')}.doc`;
                  a.click();
                }} className="w-full sm:w-auto px-8 py-4 bg-brand-gold text-brand-green rounded-xl font-bold hover:brightness-110 shadow-lg transition-all flex items-center justify-center gap-2 text-lg">
                  Baixar Documento Word (.doc)
                </button>
              </div>
            </section>
          )}

          <div className="mt-8 pt-8 border-t-2 border-gray-100 flex flex-col sm:flex-row justify-end gap-4 print:hidden">
            <button onClick={handleExportPDF} className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">
              Exportar PDF
            </button>
            <Link href="/dashboard" className="px-8 py-4 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 shadow-lg transition-all flex items-center justify-center gap-2">
              Concluir <ShieldCheck size={20} className="text-brand-gold" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResultadoAnaliseWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-brand-green" size={48} /></div>}>
      <ResultadoContent />
    </Suspense>
  );
}
