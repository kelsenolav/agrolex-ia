"use client";
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, ArrowLeft, AlertTriangle, FileCheck, Info, CheckCircle2, Loader2, Clock, Share2, Copy, XCircle, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

import { mockResponses } from './mockData';

const PROCESSING_WARNING_MS = 2 * 60 * 1000;

function parseMarkdown(md: string) {
  if (!md) return '';
  return md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^# (.*?)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>')
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

function normalizeResumoForDisplay(resumo: string) {
  return resumo.replace(
    /PARECER FORENSE E AN[ÁA]LISE REGISTRAL JUR[ÍI]DICO[- ]LAND/gi,
    'PARECER TÉCNICO FORENSE DE AUDITORIA REGISTRAL-FUNDIÁRIA'
  );
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function cleanResumoItem(item: string) {
  return item
    .replace(/^#+\s*/, '')
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitResumoItem(item: string) {
  return item.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.slice(0, 3).join(' ').trim() || item;
}

function uniqueResumoItems(items: string[], limit: number) {
  const seen = new Set<string>();

  return items.filter(item => {
    const key = normalizeForMatch(item);
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function extractResumoCandidates(resumo: string) {
  if (!resumo) return [];

  return resumo
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map(cleanResumoItem)
    .filter(Boolean);
}

function extractProblemas(resumo: string) {
  const ignoredPrefixes = [
    'o presente parecer',
    'o imovel consiste',
    'procedeu-se ao cruzamento',
    'para a regularizacao',
    'baseando-me exclusivamente',
    'a auditoria dos titulos',
    'a investigacao forense',
    'o cruzamento sistemico',
    'a analise dos documentos revela',
    'recomendacao',
    'recomendacoes',
    'necessidade',
    'conclusao'
  ];
  const problemPatterns = [
    /inconsist/,
    /diverg/,
    /irregular/,
    /ausencia/,
    /anomalia/,
    /alerta/,
    /omissao/,
    /nao possui/,
    /nao foi localizado/,
    /impede/,
    /viola/,
    /pendencia/,
    /datas futuras/,
    /georreferenciamento/,
    /sigef/,
    /ccir/,
    /incra/
  ];

  const items = extractResumoCandidates(resumo)
    .filter(item => item.length >= 20)
    .filter(item => !/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9\s:/-]+$/.test(item))
    .filter(item => {
      const normalized = normalizeForMatch(item);
      return !ignoredPrefixes.some(prefix => normalized.startsWith(prefix))
        && problemPatterns.some(pattern => pattern.test(normalized));
    })
    .map(limitResumoItem);

  return uniqueResumoItems(items, 6);
}

function extractDocumentosFaltantes(resumo: string) {
  const normalized = normalizeForMatch(resumo);
  const items: string[] = [];

  if (/certidao de inteiro teor|inteiro teor da matricula/.test(normalized)) {
    items.push('Certidão de inteiro teor atualizada da matrícula');
  }
  if (/certidao de onus|onus e acoes/.test(normalized)) {
    items.push('Certidão de ônus e ações atualizada da matrícula');
  }
  if (/memorial descritivo georreferenciado/.test(normalized)) {
    items.push('Memorial descritivo georreferenciado');
  }
  if (/certificacao sigef|codigo de certificacao sigef/.test(normalized)) {
    items.push('Certificação SIGEF / georreferenciamento homologado');
  }
  if (/ccir atualizado|reemissao do ccir|verificar ccir|situacao cadastral.+ccir/.test(normalized)) {
    items.push('CCIR atualizado, quitado e validado junto ao INCRA');
  }
  if (/numero da matricula/.test(normalized)) {
    items.push('Número da matrícula do imóvel');
  }

  return uniqueResumoItems(items, 5);
}

function extractRecomendacoes(resumo: string) {
  const actionPatterns = [
    /^(recomenda-se|obter|verificar|coletar|buscar|requisitar|aprofundar|retificar|regularizar|realizar|submeter|averbar|atualizar|validar|reemitir|contratar)/,
    /\bdeve-se\b/,
    /\bé (essencial|imprescindivel|imperativo|vital) obter\b/
  ];

  const items = extractResumoCandidates(resumo)
    .filter(item => item.length >= 20)
    .filter(item => !/^(recomendacao|recomendacoes|providencias)( urgentes)?\s*:?\s*$/i.test(item))
    .filter(item => {
      const normalized = normalizeForMatch(item);
      return actionPatterns.some(pattern => pattern.test(normalized));
    })
    .map(limitResumoItem);

  return uniqueResumoItems(items, 6);
}

function getFormattedDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime())
    ? 'Data não informada'
    : date.toLocaleDateString('pt-BR');
}

function ResultadoContent() {
  const searchParams = useSearchParams();
  const [analise, setAnalise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedWhatsAppMessage, setCopiedWhatsAppMessage] = useState(false);
  const [shareLink, setShareLink] = useState<{ id: string; url: string; expiresAt: string } | null>(null);
  const [processingTakingLong, setProcessingTakingLong] = useState(false);

  useEffect(() => {
    const fetchAnalise = async () => {
      const id = searchParams.get('id');
      
      if (!id || id === 'mock-1') {
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

      if (data) {
        setProcessingTakingLong(false);
        setAnalise(data);
      }
      setLoading(false);
    };
    
    fetchAnalise();
  }, [searchParams]);

  // Polling para aguardar a IA (que agora roda assíncrona via waitUntil)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analise && analise.status === 'processing' && !processingTakingLong) {
      interval = setInterval(async () => {
        const { data } = await supabase.from('analyses')
          .select('*, properties(name, city, state), documents(document_type, file_path)')
          .eq('id', analise.id).single();
        
        if (data && data.status !== 'processing') {
          setProcessingTakingLong(false);
          setAnalise(data);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [analise, processingTakingLong]);

  useEffect(() => {
    if (!analise || analise.status !== 'processing') {
      return;
    }

    const createdAt = new Date(analise.created_at).getTime();
    const elapsed = Number.isNaN(createdAt) ? 0 : Date.now() - createdAt;
    const timeout = setTimeout(
      () => setProcessingTakingLong(true),
      Math.max(0, PROCESSING_WARNING_MS - elapsed)
    );
    return () => clearTimeout(timeout);
  }, [analise]);

  const handleExportPDF = () => {
    window.print();
  };

  const handleGenerateShareLink = async () => {
    setShareLoading(true);
    setShareError('');
    setCopiedShareLink(false);
    setCopiedWhatsAppMessage(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para compartilhar o laudo.');

      const response = await fetch('/api/laudos/share', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ analysisId: analise.id })
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Não foi possível criar o link.');

      setShareLink({
        id: result.linkId,
        url: result.url,
        expiresAt: result.expiresAt
      });
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Não foi possível criar o link.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink.url);
    setCopiedShareLink(true);
  };

  const handleCopyWhatsAppMessage = async () => {
    if (!whatsAppMessage) return;
    await navigator.clipboard.writeText(whatsAppMessage);
    setCopiedWhatsAppMessage(true);
  };

  const handleOpenWhatsApp = () => {
    if (!whatsAppMessage) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`, '_blank', 'noopener,noreferrer');
  };

  const handleRevokeShareLink = async () => {
    if (!shareLink) return;
    setShareLoading(true);
    setShareError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para revogar o link.');

      const response = await fetch('/api/laudos/share/revoke', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ linkId: shareLink.id })
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Não foi possível revogar o link.');

      setShareLink(null);
      setCopiedShareLink(false);
      setCopiedWhatsAppMessage(false);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Não foi possível revogar o link.');
    } finally {
      setShareLoading(false);
    }
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">AgroLex em Ação...</h2>
          <p className="text-gray-600 mb-6">
            {processingTakingLong
              ? 'A análise está demorando mais que o esperado. Tente reprocessar ou contate o suporte.'
              : 'O sistema está auditando as páginas e extraindo os dados. Pode demorar até 1 minuto. Você receberá um E-mail assim que acabar, sinta-se livre para fechar ou aguardar aqui!'}
          </p>
        </div>
      </div>
    );
  }

  const analysisId = searchParams.get('id');
  const isMock = analysisId === 'mock-1';

  if (!isMock && !analise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xl w-full text-center border-t-4 border-brand-green">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Parecer não encontrado</h2>
          <p className="text-gray-600 mb-6">
            Parecer não encontrado para esta análise. Verifique se a análise foi concluída ou refaça a consulta.
          </p>
          <Link href="/dashboard" className="inline-flex px-6 py-3 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 transition-all">
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  const hasResumo = typeof analise?.findings?.resumo === 'string' && analise.findings.resumo.trim().length > 0;
  const isCompleted = ['completed', 'concluido', 'concluído'].includes(analise?.status?.toLowerCase());

  if (!isMock && (analise.status === 'error' || (isCompleted && !hasResumo))) {
    const errorMessage = analise.status === 'error'
      ? (analise.findings?.error_message || 'Não foi possível concluir a geração do parecer técnico. Reprocesse a análise.')
      : 'Análise inconsistente: status concluído sem parecer técnico salvo. Reprocesse a análise.';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xl w-full text-center border-t-4 border-red-500">
          <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Parecer técnico indisponível</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <Link href="/dashboard" className="inline-flex px-6 py-3 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 transition-all">
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  const moduleParam = searchParams.get('module') || 'titulos_incra';
  const selectedModules = moduleParam.split(',');
  const propName = isMock ? "Fazenda Boa Esperança (Amostra)" : analise.properties?.name;
  const propLocation = isMock ? "Goiás, GO" : `${analise.properties?.city}, ${analise.properties?.state}`;
  const risco = isMock ? "Alto" : (analise.risk_level || "Pendente");
  
  const mockText = selectedModules
    .map(m => mockResponses[m])
    .filter(Boolean)
    .join('\n\n---\n\n');
    
  const mockHtml = parseMarkdown(normalizeResumoForDisplay(mockText || mockResponses['titulos_incra']));

  let finalResumo = isMock
    ? mockHtml
    : parseMarkdown('Esta análise está marcada como concluída, mas o parecer detalhado não foi localizado no armazenamento local/API.');
  if (!isMock && analise.findings?.resumo) {
    // Se a IA enviou markdown, processa no frontend para ficar bonito
    const normalizedResumo = normalizeResumoForDisplay(analise.findings.resumo);
    finalResumo = analise.findings.isHtmlResumo ? normalizedResumo : parseMarkdown(normalizedResumo);
  }

  const resumoOriginal = normalizeResumoForDisplay(isMock ? mockText : (analise.findings?.resumo || ''));
  const problemasDoResumo = extractProblemas(resumoOriginal);
  const documentosDoResumo = extractDocumentosFaltantes(resumoOriginal);
  const recomendacoesDoResumo = extractRecomendacoes(resumoOriginal);

  const findings = isMock || !analise.findings?.resumo ? {
    isHtmlResumo: true,
    resumo: finalResumo,
    problemas: problemasDoResumo,
    recomendacoes: recomendacoesDoResumo,
    documentosFaltantes: documentosDoResumo,
    linhaDoTempo: []
  } : {
    ...analise.findings,
    isHtmlResumo: true,
    resumo: finalResumo,
    problemas: analise.findings.problemas?.length ? analise.findings.problemas : problemasDoResumo,
    recomendacoes: analise.findings.recomendacoes?.length ? analise.findings.recomendacoes : recomendacoesDoResumo,
    documentosFaltantes: analise.findings.documentosFaltantes?.length ? analise.findings.documentosFaltantes : documentosDoResumo
  };
  const dataEmissao = getFormattedDate(isMock ? undefined : (analise.completed_at || analise.updated_at || analise.created_at));
  const canShare = !isMock && isCompleted && hasResumo;
  const whatsAppMessage = shareLink
    ? `Olá.

Segue o laudo técnico preliminar AgroLex referente ao imóvel “${propName}”.

Grau de risco identificado: ${risco}.

Acesse o laudo pelo link seguro abaixo:
${shareLink.url}

Você poderá visualizar o relatório e, se desejar, utilizar a opção “Exportar PDF”.

Observação: este laudo é uma análise técnica preliminar com base nos documentos enviados e pode exigir conferência documental complementar, certidões atualizadas e validação jurídica final.

Fico à disposição.`
    : '';

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
            <span className="text-xl font-bold text-white">AgroLex</span>
          </Link>
        </div>
      </nav>

      {/* Cabeçalho exclusivo para Impressão PDF */}
      <div className="hidden print:flex justify-between items-center border-b-2 border-brand-green pb-6 mb-6">
        <div className="flex items-center gap-2 text-brand-green">
          <ShieldCheck size={36} />
          <span className="text-3xl font-bold text-gray-900">AgroLex</span>
        </div>
        <div className="text-right text-gray-500 text-sm">
          <p>Laudo Pericial Oficial - IA</p>
          <p>Emitido em: {dataEmissao}</p>
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
              <h1 className="text-3xl font-extrabold text-gray-800">PARECER TÉCNICO FORENSE DE AUDITORIA REGISTRAL-FUNDIÁRIA</h1>
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
                className="text-gray-700 text-justify [&_h2]:text-left [&_h3]:text-left leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-200 text-lg print:bg-white"
                dangerouslySetInnerHTML={{ __html: findings.resumo }} 
              />
            ) : (
              <p className="text-gray-700 text-justify leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-200 text-lg print:bg-white whitespace-pre-wrap">
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
                {(!findings.problemas || findings.problemas.length === 0) && (
                  <li className="text-gray-500 italic p-4">Não foram identificadas divergências estruturadas no parecer gerado.</li>
                )}
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
                   <li className="text-gray-500 italic p-4">Nenhum documento faltante identificado de forma expressa no parecer gerado.</li>
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
                {(!findings.recomendacoes || findings.recomendacoes.length === 0) && (
                  <li className="text-gray-500 italic">Não foram identificadas recomendações estruturadas no parecer gerado.</li>
                )}
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

          {canShare && (shareLink || shareError) && (
            <section className="rounded-xl border border-green-200 bg-green-50 p-5 print:hidden">
              <h2 className="mb-2 flex items-center gap-2 font-bold text-brand-dark">
                <Share2 size={20} className="text-brand-green" /> Compartilhamento seguro do laudo
              </h2>
              {shareLink && (
                <>
                  <p className="mb-3 text-sm text-gray-600">Link válido até {getFormattedDate(shareLink.expiresAt)}. Somente o parecer compartilhado ficará visível.</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input readOnly value={shareLink.url} className="min-w-0 flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-gray-700" />
                    <button type="button" onClick={handleCopyShareLink} className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-green px-4 py-2 font-bold text-brand-green transition-colors hover:bg-green-100">
                      <Copy size={18} /> {copiedShareLink ? 'Copiado' : 'Copiar link'}
                    </button>
                    <button type="button" onClick={handleRevokeShareLink} disabled={shareLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60">
                      <XCircle size={18} /> Revogar
                    </button>
                  </div>
                  <div className="mt-5 rounded-xl border border-green-200 bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-2 font-bold text-brand-dark">
                      <MessageCircle size={19} className="text-brand-green" /> Mensagem para WhatsApp
                    </h3>
                    <textarea
                      readOnly
                      value={whatsAppMessage}
                      rows={12}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-700"
                    />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={handleCopyWhatsAppMessage} className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-green px-4 py-2 font-bold text-brand-green transition-colors hover:bg-green-100">
                        <Copy size={18} /> {copiedWhatsAppMessage ? 'Mensagem copiada!' : 'Copiar mensagem para WhatsApp'}
                      </button>
                      <button type="button" onClick={handleOpenWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-2 font-bold text-white transition-all hover:brightness-110">
                        <MessageCircle size={18} /> Abrir WhatsApp
                      </button>
                    </div>
                  </div>
                </>
              )}
              {shareError && <p className="mt-3 text-sm font-medium text-red-700">{shareError}</p>}
            </section>
          )}

          <div className="mt-8 pt-8 border-t-2 border-gray-100 flex flex-col sm:flex-row justify-end gap-4 print:hidden">
            {canShare && (
              <button type="button" onClick={handleGenerateShareLink} disabled={shareLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-green px-8 py-4 font-bold text-brand-green transition-colors hover:bg-green-50 disabled:opacity-60">
                {shareLoading ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
                Compartilhar Laudo
              </button>
            )}
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
