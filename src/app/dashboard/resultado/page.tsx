"use client";
import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, AlertTriangle, FileCheck, Info, CheckCircle2, Loader2, Clock, ArrowUpRight, FileText, MapPin, Scale, Landmark, ChevronRight, TrendingUp, AlertCircle, XCircle, Search, FileSignature } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Analysis, AnalysisFindings, ReportProblem, TimelineEvent, ChecklistItem } from '@/types/analise';
import { calcularScoreAgroLex } from '@/types/analise';
import ScoreAgroLex from '@/components/ScoreAgroLex';
import DOMPurify from 'dompurify';

const POLLING_MAX_RETRIES = 30;
const POLLING_INTERVAL_MS = 4000;

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

function matrizRiscoGrid() {
  const cells: Array<{ row: number; col: number; risco: string }> = [];
  const niveis = ['baixo', 'baixo', 'medio', 'alto', 'critico'];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = Math.min(row + col, 4);
      cells.push({ row, col, risco: niveis[idx] });
    }
  }
  return cells;
}

function ResultadoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [analise, setAnalise] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingCountRef = useRef(0);

  useEffect(() => {
    const fetchAnalise = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const id = searchParams.get('id');
      if (!id) {
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

      if (data) setAnalise(data as unknown as Analysis);
      setLoading(false);
    };
    
    fetchAnalise();
  }, [searchParams, router]);

  // Polling para aguardar a IA — com teto de tentativas
  useEffect(() => {
    let interval: NodeJS.Timeout;
    pollingCountRef.current = 0;

    if (analise && (analise.status === 'processing' || analise.status === 'analisando')) {
      interval = setInterval(async () => {
        pollingCountRef.current += 1;

        if (pollingCountRef.current >= POLLING_MAX_RETRIES) {
          clearInterval(interval);
          return;
        }

        const { data } = await supabase.from('analyses')
          .select('*, properties(name, city, state), documents(document_type, file_path)')
          .eq('id', analise.id).single();
        
        if (data && data.status !== 'processing' && data.status !== 'analisando') {
          setAnalise(data as unknown as Analysis);
          clearInterval(interval);
        }
      }, POLLING_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [analise]);

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-brand-green" size={48} /></div>;
  }

  if (!analise) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Dossiê não encontrado</h2>
          <p className="text-gray-600 mb-6">O dossiê técnico solicitado não foi localizado em nossa base de dados.</p>
          <Link href="/dashboard" className="inline-block bg-brand-green text-white px-6 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all">
            Retornar ao Centro de Inteligência
          </Link>
        </div>
      </div>
    );
  }

  const rawStatus = (analise.status || '').toLowerCase().trim();
  const isAnalisando = ['processing', 'analisando', 'pending', 'payment_pending'].includes(rawStatus);
  const isCompleted = ['completed', 'done', 'concluido'].includes(rawStatus);
  const isError = ['error', 'failed'].includes(rawStatus);

  if (isAnalisando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-brand-green">
          <div className="w-20 h-20 bg-brand-green text-white rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 size={40} className="animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Auditoria em processamento</h2>
          <p className="text-gray-600 mb-6">
            O sistema está auditando as páginas e extraindo os dados. Em instantes o dossiê técnico será disponibilizado.
          </p>
          <Link href="/dashboard" className="text-sm font-semibold text-brand-green hover:underline">
            Retornar ao Centro de Inteligência
          </Link>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Dossiê técnico indisponível</h2>
          <p className="text-gray-600 mb-6">Ocorreu um erro no processamento deste documento. Por favor, reenvie o arquivo.</p>
          <Link href="/dashboard" className="inline-block bg-brand-green text-white px-6 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all">
            Retornar ao Centro de Inteligência
          </Link>
        </div>
      </div>
    );
  }

  const findings = analise.findings as AnalysisFindings | undefined;
  const hasParecer = findings?.resumo && String(findings.resumo).trim().length > 0;

  if (!isCompleted || !hasParecer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-amber-500">
          <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Anomalia: parecer não localizado</h2>
          <p className="text-gray-600 mb-6">O processamento consta como concluído, mas o parecer descritivo não pôde ser localizado.</p>
          <Link href="/dashboard" className="inline-block bg-brand-green text-white px-6 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all">
            Retornar ao Centro de Inteligência
          </Link>
        </div>
      </div>
    );
  }

  // ─── SAFE NORMALIZATIONS ──────────────────────
  // Blindagem contra dados legados onde o campo existe mas não é array
  const safeDocuments = Array.isArray(analise.documents) ? analise.documents : [];
  const safeProblemas = Array.isArray(findings!.problemas) ? findings!.problemas : [];
  const safeDocumentosFaltantes = Array.isArray(findings!.documentosFaltantes) ? findings!.documentosFaltantes : [];
  const safeRecomendacoes = Array.isArray(findings!.recomendacoes) ? findings!.recomendacoes : [];
  const safeLinhaDoTempo = Array.isArray(findings!.linhaDoTempo) ? findings!.linhaDoTempo : [];
  const safeChecklist = Array.isArray((findings as any)?.checklist) ? (findings as any).checklist : [];

  const propName = analise.properties?.name || 'Propriedade';
  const propLocation = `${analise.properties?.city || ''}, ${analise.properties?.state || ''}`;
  const risco = analise.risk_level || "Pendente";
  
  let finalResumo = findings!.isHtmlResumo ? findings!.resumo : parseMarkdown(findings!.resumo);
  const sanitizedResumo = DOMPurify.sanitize(finalResumo);

  const scoreData = calcularScoreAgroLex(findings, analise.risk_level);

  const getRiscoStyle = (r: string) => {
    const rLower = r?.toLowerCase();
    if (rLower === 'alto' || rLower === 'critico') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', labelText: 'text-red-800' };
    if (rLower === 'medio' || rLower === 'médio') return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', labelText: 'text-yellow-800' };
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', labelText: 'text-green-800' };
  };
  const styles = getRiscoStyle(risco);

  // Contagem de achados por criticidade
  const problemas = safeProblemas as ReportProblem[];
  const achadosCriticos = problemas.filter(p => String(p.criticidade || '').toLowerCase().includes('critico')).length;
  const achadosAltos = problemas.filter(p => {
    const c = String(p.criticidade || '').toLowerCase();
    return c.includes('alto') && !c.includes('critico');
  }).length;
  const achadosMedios = problemas.filter(p => {
    const c = String(p.criticidade || '').toLowerCase();
    return c.includes('medio') || c.includes('médio');
  }).length;

  // ─── CADEIA DOMINIAL VISUAL ──────────────────────
  const linhaDoTempo = safeLinhaDoTempo as TimelineEvent[];
  
  function renderCadeiaDominial() {
    if (!linhaDoTempo || linhaDoTempo.length === 0) return null;
    return (
      <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
        <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
          <Landmark className="text-brand-gold" size={24} /> Cadeia Dominial Visual
        </h2>
        <div className="cadeia-dominial-flow">
          {linhaDoTempo.map((item: TimelineEvent, i: number) => {
            const isUltimo = i === linhaDoTempo.length - 1;
            const anoMatch = item.data?.match(/\d{4}/);
            const ano = anoMatch ? anoMatch[0] : item.data || '';
            return (
              <div key={i} className="cadeia-dominial-node">
                <div className="cadeia-dominial-timeline">
                  <div className="cadeia-dominial-dot">{i + 1}</div>
                  {!isUltimo && <div className="cadeia-dominial-connector" />}
                </div>
                <div className="cadeia-dominial-card">
                  <span className="cadeia-ano">{ano}</span>
                  <span className="cadeia-evento">{item.evento}</span>
                  {item.detalhe && <span className="cadeia-detalhe">{item.detalhe}</span>}
                </div>
              </div>
            );
          })}
          {/* Node final — Proprietário Atual */}
          <div className="cadeia-dominial-node">
            <div className="cadeia-dominial-timeline">
              <div className="cadeia-dominial-dot">{linhaDoTempo.length + 1} </div>
            </div>
            <div className="cadeia-dominial-card border-brand-green/40 bg-green-50/40">
              <span className="cadeia-ano">Atual</span>
              <span className="cadeia-evento">Proprietário Atual</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── RADAR DE RISCO ────────────────────────────
  function calcularNivelRisco(valor: number): { nivel: string; pct: number } {
    if (valor <= 25) return { nivel: 'baixo', pct: 20 };
    if (valor <= 50) return { nivel: 'medio', pct: 45 };
    if (valor <= 75) return { nivel: 'alto', pct: 70 };
    return { nivel: 'critico', pct: 95 };
  }

  function gerarRadarRisco() {
    const scoreValor = scoreData.score;
    const riscoDominial = calcularNivelRisco(scoreValor < 40 ? 95 : scoreValor < 60 ? 70 : scoreValor < 80 ? 45 : 15);
    const riscoRegistral = calcularNivelRisco(scoreValor < 40 ? 90 : scoreValor < 60 ? 65 : scoreValor < 80 ? 40 : 10);
    const riscoProcessual = calcularNivelRisco(scoreValor < 40 ? 80 : scoreValor < 60 ? 55 : scoreValor < 80 ? 30 : 5);
    const riscoCartorial = calcularNivelRisco(scoreValor < 40 ? 85 : scoreValor < 60 ? 60 : scoreValor < 80 ? 35 : 8);
    const riscoINCRA = calcularNivelRisco(scoreValor < 40 ? 75 : scoreValor < 60 ? 50 : scoreValor < 80 ? 25 : 5);

    const riscos = [
      { label: 'Risco Dominial', data: riscoDominial },
      { label: 'Risco Registral', data: riscoRegistral },
      { label: 'Risco Processual', data: riscoProcessual },
      { label: 'Risco Cartorial', data: riscoCartorial },
      { label: 'Risco INCRA', data: riscoINCRA },
    ];

    return (
      <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
        <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
          <Search className="text-brand-gold" size={24} /> Radar de Risco AgroLex
        </h2>
        <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm print:shadow-none print:bg-white print:border">
          <div className="space-y-4">
            {riscos.map((r, i) => (
              <div key={i} className="radar-risco-bar">
                <span className="radar-risco-label">{r.label}</span>
                <div className="radar-risco-track">
                  <div className={`radar-risco-fill ${r.data.nivel}`} style={{ width: `${r.data.pct}%` }} />
                </div>
                <span className={`radar-risco-badge ${r.data.nivel}`}>{r.data.nivel.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ─── CHECKLIST INTELIGENTE ─────────────────────
  const documentosBase = [
    { nome: 'Matrícula', chave: 'matricula' },
    { nome: 'Cadeia Dominial', chave: 'cadeia_dominial' },
    { nome: 'Escritura', chave: 'escritura' },
    { nome: 'CAR', chave: 'car' },
    { nome: 'CCIR', chave: 'ccir' },
    { nome: 'SIGEF', chave: 'sigef' },
    { nome: 'Processo Administrativo', chave: 'processo_administrativo' },
  ];

  function verificarDocumento(chave: string): { presente: boolean; indicio: boolean } {
    const docsRecebidos = safeDocuments.map(d => (d.document_type || d.file_path || '').toLowerCase()) || [];
    const docsFaltantes = safeDocumentosFaltantes.map(d => d.toLowerCase());
    const problemasTexto = safeProblemas.map(p => (p.titulo || p.descricao || '').toLowerCase()).join(' ');

    // Verifica se o documento foi recebido (document_type ou file_path)
    const foiRecebido = docsRecebidos.some(d => d.includes(chave.replace(/_/g, '')) || d.includes(chave));
    // Se não está na lista de faltantes, pode ser um indício
    const naoFaltante = !docsFaltantes.some(d => d.includes(chave.replace(/_/g, '')) || d.includes(chave));
    // Verifica se há menção nos problemas
    const mencionado = problemasTexto.includes(chave.replace(/_/g, ' ')) || problemasTexto.includes(chave);

    if (foiRecebido) return { presente: true, indicio: false };
    if (mencionado && naoFaltante) return { presente: false, indicio: true };
    return { presente: false, indicio: false };
  }

  function renderChecklist() {
    return (
      <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
        <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
          <FileSignature className="text-brand-gold" size={24} /> Checklist Documental
        </h2>
        <div className="space-y-3">
          {documentosBase.map((doc, i) => {
            const { presente, indicio } = verificarDocumento(doc.chave);
            let statusClass = 'ausente';
            let iconText = '✗';
            let statusText = 'Ausente';

            if (presente) {
              statusClass = 'presente';
              iconText = '✓';
              statusText = 'Presente';
            } else if (indicio) {
              statusClass = 'indicio';
              iconText = '?';
              statusText = 'Indício';
            }

            return (
              <div key={i} className="checklist-item">
                <div className={`checklist-icon ${statusClass}`}>{iconText}</div>
                <span className="checklist-nome">{doc.nome}</span>
                <span className={`checklist-status ${statusClass}`}>{statusText}</span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Navbar */}
      <nav className="bg-brand-green text-white shadow-md print:hidden">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold hover:scale-105 transition-transform">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white">AgroLex</span>
          </Link>
        </div>
      </nav>

      {/* CAPA PREMIUM — exclusiva para impressão PDF */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-between print:min-h-[270mm] print:w-full print:px-16 print:py-12 cover-page">
        {/* TOPO — Logo + Marca (25-35% altura) */}
        <div className="flex flex-col items-center justify-center flex-1 min-h-[30vh]">
          <div className="w-44 h-44 bg-brand-green rounded-[32px] flex items-center justify-center shadow-2xl shadow-brand-green/20">
            <ShieldCheck size={108} className="text-brand-gold" />
          </div>
          <h1 className="text-5xl font-black text-gray-900 mt-8 tracking-tight">AgroLex</h1>
          <p className="text-xl text-brand-green font-semibold mt-2 tracking-wider">Inteligência Fundiária</p>
        </div>

        <div className="border-t-2 border-brand-gold w-32 mx-auto my-6" />

        {/* TÍTULO DO DOCUMENTO */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-800 leading-snug">
            Dossiê Técnico<br/>de Auditoria Fundiária
          </h2>
        </div>

        {/* DADOS DO IMÓVEL */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xl text-gray-700 font-medium flex items-center justify-center gap-2">
            <MapPin size={20} className="text-brand-gold" />
            {propName} • {propLocation}
          </p>
          <p className="text-base text-gray-500">
            {new Date().toLocaleDateString('pt-BR')}
          </p>
          <p className="text-sm text-gray-400 font-mono">
            Ref: ALX-{analise.id?.slice(0, 8).toUpperCase() || '00000000'}
          </p>
        </div>

        {/* SCORE + RISCO */}
        <div className="mt-8 flex items-center gap-8">
          <ScoreAgroLex findings={findings} riskLevel={analise.risk_level} size="md" />
          <div className={`${styles.bg} px-6 py-4 rounded-xl border ${styles.border} min-w-[140px] text-center`}>
            <p className={`text-[10px] font-bold ${styles.labelText} uppercase tracking-widest mb-1`}>Grau de Risco</p>
            <div className={`flex items-center gap-2 ${styles.text} justify-center`}>
              <AlertTriangle size={22} />
              <span className="text-2xl font-black">{risco?.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* RODAPÉ INSTITUCIONAL */}
        <div className="w-full mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            AgroLex Inteligência Fundiária • CNPJ: XX.XXX.XXX/XXXX-XX<br/>
            Documento confidencial e de uso interno • Protegido por LGPD
          </p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-4xl print:py-0">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-brand-green transition-colors w-fit font-medium print:hidden">
            <ArrowLeft size={20} /> Centro de Inteligência
          </Link>
          <div className="flex gap-3">
            <button onClick={handleExportPDF} className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors text-sm flex items-center gap-2">
              <FileText size={16} /> Exportar PDF
            </button>
          </div>
        </div>

        {/* Card Principal do Dossiê */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden print:shadow-none print:border print:rounded-none">
          
          {/* HEADER PROFISSIONAL */}
          <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:border-b bg-gradient-to-r from-gray-50 to-white">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800">Dossiê Técnico de Auditoria Fundiária</h1>
                <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm print:shadow-none flex items-center gap-1">
                  <CheckCircle2 size={12} /> Parecer Final
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1"><MapPin size={14} className="text-brand-gold" /> {propName} • {propLocation}</span>
                <span className="flex items-center gap-1"><Clock size={14} className="text-brand-gold" /> {new Date().toLocaleDateString('pt-BR')}</span>
                <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-brand-gold" /> ALX-{analise.id?.slice(0, 8).toUpperCase() || '00000000'}</span>
              </div>
            </div>
            <div className={`text-center ${styles.bg} p-4 rounded-xl border ${styles.border} shadow-sm print:shadow-none print:border min-w-[130px]`}>
              <p className={`text-[10px] font-bold ${styles.labelText} uppercase tracking-widest mb-1`}>Grau de Risco</p>
              <div className={`flex items-center gap-2 ${styles.text} justify-center`}>
                <AlertTriangle size={22} />
                <span className="text-2xl font-black">{risco?.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* CORPO DO DOSSIÊ */}
          <div className="p-8 space-y-10 print:p-4 report-text">

            {/* 1. SCORE AGROLEX + RESUMO EXECUTIVO */}
            <section className="print:break-inside-avoid">
              <div className="grid md:grid-cols-5 gap-8 items-start mb-8 print:flex print:flex-col print:items-center print:gap-4">
                <div className="md:col-span-2 flex justify-center print:w-full print:max-w-sm">
                  <ScoreAgroLex findings={findings} riskLevel={analise.risk_level} size="lg" />
                </div>
                <div className="md:col-span-3 print:w-full">
                  <h2 className="text-2xl font-bold text-brand-dark mb-4 border-b-2 border-gray-100 pb-3 flex items-center gap-2">
                    <FileText className="text-brand-gold" size={24} /> Resumo Executivo
                  </h2>
                  {findings!.isHtmlResumo ? (
                    <div 
                      className="text-gray-700 leading-relaxed text-base print:bg-white text-justify"
                      dangerouslySetInnerHTML={{ __html: sanitizedResumo }} 
                    />
                  ) : (
                    <p className="text-gray-700 leading-relaxed text-base print:bg-white whitespace-pre-line text-justify hyphens-auto">
                      {findings!.resumo}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 2. ACHADOS CRÍTICOS — Indicadores */}
            <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
              <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} /> Achados Críticos
              </h2>
              
              {/* Cards de resumo de criticidade */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-red-50 rounded-xl p-4 border border-red-200 text-center">
                  <p className="text-3xl font-black text-red-600">{achadosCriticos}</p>
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider mt-1">Crítico</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 text-center">
                  <p className="text-3xl font-black text-orange-600">{achadosAltos}</p>
                  <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wider mt-1">Alto</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 text-center">
                  <p className="text-3xl font-black text-yellow-600">{achadosMedios}</p>
                  <p className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider mt-1">Médio</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                  <p className="text-3xl font-black text-green-600">{problemas.length}</p>
                  <p className="text-[11px] font-bold text-green-700 uppercase tracking-wider mt-1">Total</p>
                </div>
              </div>

              {/* Matriz de Risco Visual */}
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Matriz de Risco</h3>
                  <div className="matriz-risco">
                    {matrizRiscoGrid().map((cell, i) => (
                      <div key={i} className={`matriz-risco-cell risco-${cell.risco}`} title={`${cell.risco.charAt(0).toUpperCase() + cell.risco.slice(1)} — Probabilidade ${cell.col + 1}, Impacto ${cell.row + 1}`} />
                    ))}
                  </div>
                  <div className="flex gap-4 mt-3 text-[10px] text-gray-500 font-medium">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-200 inline-block" /> Baixo</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-200 inline-block" /> Médio</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-200 inline-block" /> Alto</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> Crítico</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Distribuição por Criticidade</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
                        <span>Crítico</span>
                        <span>{achadosCriticos}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${problemas.length > 0 ? (achadosCriticos / problemas.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
                        <span>Alto</span>
                        <span>{achadosAltos}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${problemas.length > 0 ? (achadosAltos / problemas.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
                        <span>Médio</span>
                        <span>{achadosMedios}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${problemas.length > 0 ? (achadosMedios / problemas.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de Achados */}
              <ul className="space-y-4">
                {problemas.map((prob: ReportProblem, i: number) => {
                  const titulo = prob.titulo || prob.descricao || 'Problema identificado';
                  const descricao = prob.descricao && prob.descricao !== prob.titulo ? prob.descricao : null;
                  const c = (prob.criticidade || '').toLowerCase();

                  let cardBg = 'bg-green-50 border-green-200';
                  let badgeBg = 'bg-green-200 text-green-900';
                  let semaforo = 'bg-green-500';
                  let Icon = CheckCircle2;

                  if (c.includes('critico')) {
                    cardBg = 'bg-red-50 border-red-200';
                    badgeBg = 'bg-red-200 text-red-900';
                    semaforo = 'bg-red-500';
                    Icon = AlertTriangle;
                  } else if (c.includes('alto')) {
                    cardBg = 'bg-orange-50 border-orange-200';
                    badgeBg = 'bg-orange-200 text-orange-900';
                    semaforo = 'bg-orange-500';
                    Icon = AlertCircle;
                  } else if (c.includes('medio') || c.includes('médio')) {
                    cardBg = 'bg-yellow-50 border-yellow-200';
                    badgeBg = 'bg-yellow-200 text-yellow-900';
                    semaforo = 'bg-yellow-500';
                    Icon = AlertCircle;
                  }

                  return (
                    <li key={i} className={`${cardBg} p-4 rounded-xl border shadow-sm print:shadow-none print:bg-white`}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${badgeBg}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-gray-900 leading-tight">{titulo}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${badgeBg}`}>
                              <span className={`w-1 h-1 rounded-full ${semaforo}`} />
                              {prob.criticidade}
                            </span>
                          </div>
                          {descricao && (
                            <p className="text-sm text-gray-600 mt-1">{descricao}</p>
                          )}
                        </div>
                      </div>
                      <div className="ml-9 space-y-1.5">
                        {prob.baseDocumental && (
                          <div className="flex items-start gap-2 text-xs">
                            <span className="font-bold text-gray-500 flex-shrink-0">Base:</span>
                            <span className="text-gray-600">{prob.baseDocumental}</span>
                          </div>
                        )}
                        {prob.documentoNecessario && (
                          <div className="flex items-start gap-2 text-xs">
                            <span className="font-bold text-gray-500 flex-shrink-0">Documento:</span>
                            <span className="text-gray-600">{prob.documentoNecessario}</span>
                          </div>
                        )}
                        {prob.recomendacao && (
                          <div className="flex items-start gap-2 text-xs">
                            <span className="font-bold text-gray-500 flex-shrink-0">Recomendação:</span>
                            <span className="text-gray-600">{prob.recomendacao}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* 3. TIMELINE */}
            {safeLinhaDoTempo.length > 0 && (
              <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
                <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                  <Clock className="text-brand-gold" size={24} /> Timeline Registral
                </h2>
                <div className="timeline-premium">
                  {safeLinhaDoTempo.map((item: TimelineEvent, i: number) => (
                    <div key={i} className="timeline-premium-item">
                      <div className="timeline-premium-dot"></div>
                      <div className="timeline-premium-content">
                        <span className="inline-block px-2.5 py-1 bg-brand-gold text-brand-green font-black text-xs rounded-md mb-2 shadow-sm">{item.data}</span>
                        <h3 className="text-base font-bold text-gray-800 mb-1">{item.evento}</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">{item.detalhe}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. RECOMENDAÇÕES TÉCNICAS */}
            <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
              <h2 className="text-2xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-brand-green" size={24} /> Recomendações Técnicas
              </h2>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200 shadow-sm print:shadow-none print:bg-white print:border">
                <ul className="space-y-4">
                  {safeRecomendacoes.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 size={14} className="text-green-700" />
                      </div>
                      <span className="text-gray-800 font-medium">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 5. DOCUMENTOS FALTANTES */}
            <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
              <h2 className="text-2xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                <FileText className="text-orange-500" size={24} /> Documentos Necessários
              </h2>
              <ul className="space-y-3">
                {safeDocumentosFaltantes.map((doc: string, i: number) => (
                  <li key={i} className="flex items-center gap-4 bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm print:shadow-none print:bg-white">
                    <div className="w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-orange-700" />
                    </div>
                    <span className="text-orange-900 font-medium">{doc}</span>
                  </li>
                ))}
                {(safeDocumentosFaltantes.length === 0) && (
                   <li className="text-gray-500 italic p-4">Nenhum documento pendente identificado.</li>
                )}
              </ul>
            </section>

            {/* 5b. CADEIA DOMINIAL VISUAL — Fluxo Visual Law */}
            {renderCadeiaDominial()}

            {/* 5c. RADAR DE RISCO AGROLEX */}
            {gerarRadarRisco()}

            {/* 5d. CHECKLIST DOCUMENTAL INTELIGENTE */}
            {renderChecklist()}

            {/* 6. CHECKLIST DA CADEIA DOMINIAL */}
            {safeChecklist.length > 0 && (
              <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
                <h2 className="text-2xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                  <Scale className="text-brand-gold" size={24} /> Auditoria da Cadeia Dominial
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {safeChecklist.map((item: ChecklistItem, i: number) => {
                    const isReprovado = item.status?.toLowerCase().includes('reprovado') || item.status?.toLowerCase().includes('violado');
                    const isAlerta = item.status?.toLowerCase().includes('alerta');
                    
                    let badgeColors = "bg-green-100 text-green-800 border-green-200";
                    let Icon = CheckCircle2;
                    let semaforo = 'bg-green-500';
                    
                    if (isReprovado) {
                      badgeColors = "bg-red-100 text-red-800 border-red-200";
                      Icon = AlertTriangle;
                      semaforo = 'bg-red-500';
                    } else if (isAlerta) {
                      badgeColors = "bg-yellow-100 text-yellow-800 border-yellow-200";
                      Icon = AlertTriangle;
                      semaforo = 'bg-yellow-500';
                    }

                    return (
                      <div key={i} className={`p-4 rounded-xl border shadow-sm flex flex-col ${isReprovado ? 'bg-red-50' : isAlerta ? 'bg-yellow-50' : 'bg-white'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-gray-800 text-sm">{item.quesito}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border flex items-center gap-1 ${badgeColors}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${semaforo}`} />
                            {item.status?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mt-auto">{item.justificativa}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 7. PEÇA JURÍDICA */}
            {findings!.pecaJuridica && (
              <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
                <div className="bg-gray-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-brand-gold text-brand-green text-xs font-black px-4 py-2 rounded-bl-xl shadow-lg">PREMIUM</div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Scale className="text-brand-gold" size={24} /> Peça Jurídica
                  </h2>
                  <p className="text-gray-300 mb-6">A Inteligência Artificial preparou uma minuta/parecer completo baseado nos apontamentos forenses desta auditoria.</p>
                  
                  <div className="bg-white text-gray-900 p-6 rounded-xl max-h-64 overflow-y-auto mb-6 shadow-inner text-sm font-serif">
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(findings!.pecaJuridica) }} />
                  </div>
                  
                  <button onClick={() => {
                    const blob = new Blob(['\ufeff', findings!.pecaJuridica || ''], { type: 'application/msword' });
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

            {/* 8. HISTÓRICO DO CASO */}
            {(findings as any)?.parent_findings_summary || (findings as any)?.complementary_children ? (
              <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
                <h2 className="text-2xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                  <ShieldCheck className="text-brand-gold" size={24} /> Histórico do Caso
                </h2>

                {(findings as any)?.parent_findings_summary && (
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-4">
                    <p className="text-sm font-bold text-gray-700 mb-1">Análise Principal</p>
                    <p className="text-sm text-gray-600">
                      {(findings as any)?.parent_findings_summary?.original_modules?.length > 0
                        ? `Módulos: ${(findings as any).parent_findings_summary.original_modules.join(', ')}`
                        : 'Análise original'}
                    </p>
                    <span className="mt-2 inline-block px-2 py-0.5 bg-brand-green/10 text-brand-green text-[10px] font-bold uppercase rounded">
                      Análise principal
                    </span>
                  </div>
                )}

                {(findings as any)?.complementary_children && Array.isArray((findings as any).complementary_children) && (findings as any).complementary_children.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700 mb-1">Análises Complementares</p>
                    {(findings as any).complementary_children.map((child: any, idx: number) => (
                      <div key={idx} className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">
                            Análise complementar {idx + 1}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            Complementar {idx + 1}
                          </span>
                        </div>
                        {child.modules?.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">Módulos: {child.modules.join(', ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(findings as any)?.analysis_depth > 1 && !(findings as any)?.parent_findings_summary && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <p className="text-sm text-gray-700">
                      Esta é uma <strong>análise complementar</strong> (profundidade {(findings as any).analysis_depth}).
                    </p>
                  </div>
                )}
              </section>
            ) : null}

            {/* 9. RODAPÉ / PRÓXIMOS PASSOS */}
            <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
              <h2 className="text-2xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                <TrendingUp className="text-brand-gold" size={24} /> Próximos Passos
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Link
                  href="/dashboard"
                  className="flex items-center justify-between p-5 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 transition-all shadow-md group"
                >
                  <span>Retornar ao Centro de Inteligência</span>
                  <ArrowUpRight size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center justify-between p-5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm group"
                >
                  <span>Exportar Dossiê em PDF</span>
                  <FileText size={20} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </section>

          </div>

          {/* RODAPÉ INSTITUCIONAL */}
          <div className="border-t border-gray-100 bg-gray-50 p-6 print:bg-white print:border-t">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-gold" />
                <span className="font-bold text-gray-700">AgroLex Inteligência Fundiária</span>
              </div>
              <div className="text-center md:text-right">
                <p>CNPJ: XX.XXX.XXX/XXXX-XX</p>
                <p className="mt-0.5">Este documento é confidencial e de uso interno. Protegido por LGPD.</p>
              </div>
            </div>
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