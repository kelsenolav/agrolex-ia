"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, ArrowRight, UploadCloud, FileText, XCircle, Layers, CheckCircle2, ShieldAlert, ChevronDown, ChevronUp, Info } from 'lucide-react';
import Logo from '@/components/Logo';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AUDIT_MODULES, getModulePrice, buildDocumentProfile, getModuleCompatibility, calculateAuditModulesTotal } from "@/lib/auditModules";
import { createInitialCaseFile, type CaseFileDocument } from "@/lib/caseFile";
import { getCommercialAccess, canStartTrialAnalysis, getTrialBlockReason, type TrialProfile } from '@/lib/commercial/trial';
import { montarLeadPayload, validarNome, validarEmail, validarWhatsApp, validarCidade, validarEstado, type LeadPayload } from '@/lib/commercial/lead';

// ─── Constantes ─────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILE_COUNT = 10;

const DOC_TYPES = [
  { value: 'Matrícula', label: 'Matrícula' },
  { value: 'CAR', label: 'CAR' },
  { value: 'CCIR', label: 'CCIR' },
  { value: 'SIGEF', label: 'SIGEF' },
  { value: 'Memorial', label: 'Memorial' },
  { value: 'Planta', label: 'Planta' },
  { value: 'Certidão Inteiro Teor', label: 'Certidão' },
  { value: 'Título INCRA', label: 'Título INCRA' },
  { value: 'Outro', label: 'Outro' },
];

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

async function validateFile(file: File): Promise<string | null> {
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.type !== "application/pdf") return "Apenas arquivos PDF são aceitos.";
  if (file.size > MAX_FILE_SIZE_BYTES) return `O PDF excede o limite de ${MAX_FILE_SIZE_MB} MB.`;
  try {
    const buffer = await file.slice(0, 5).arrayBuffer();
    if (!String.fromCharCode(...new Uint8Array(buffer)).startsWith("%PDF")) return "PDF corrompido.";
  } catch { return "Não foi possível verificar o arquivo."; }
  try {
    const sample = await file.slice(0, 8192).arrayBuffer();
    const text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(sample));
    if (!text.includes("/Type")) return "PDF sem páginas válidas.";
  } catch { return "Não foi possível verificar o conteúdo."; }
  return null;
}

function parseDeclaredAreaHa(value: string | null): number | null {
  const v = (value || "").trim().replace(/\s+/g, "");
  if (!v) return null;
  const lc = v.lastIndexOf(","), ld = v.lastIndexOf(".");
  let t = v;
  if (lc >= 0 && ld >= 0) t = lc > ld ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  else if (lc >= 0) t = v.replace(",", ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

// ─── Step Indicator ─────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = ['Propriedade', 'Documentos', 'Auditoria'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all ${
                done ? 'bg-brand-green border-brand-green text-white' :
                active ? 'bg-white border-brand-green text-brand-green shadow-md' :
                'bg-white border-gray-200 text-gray-400'
              }`}>
                {done ? <CheckCircle2 size={16} /> : n}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wide whitespace-nowrap ${active ? 'text-brand-green' : done ? 'text-brand-green/60' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-16 mx-1 mb-4 transition-all ${done ? 'bg-brand-green' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NovaAnalisePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Etapa 1 — Propriedade
  const [propName, setPropName] = useState('');
  const [propState, setPropState] = useState('');
  const [propCity, setPropCity] = useState('');
  const [propArea, setPropArea] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [showOptional, setShowOptional] = useState(false);

  // Etapa 2 — Documentos
  const [files, setFiles] = useState<{ file: File; type: string }[]>([]);
  const [currentDocType, setCurrentDocType] = useState('Matrícula');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Etapa 3 — Módulos
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // UI state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Comercial
  const [trialProfile, setTrialProfile] = useState<TrialProfile | null>(null);
  const [trialBlocked, setTrialBlocked] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ nome: '', email: '', telefone: '', cidade: '', estado: '' });
  const [leadErrors, setLeadErrors] = useState<Record<string, string[]>>({});
  const [leadSaving, setLeadSaving] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pagesBlockInfo, setPagesBlockInfo] = useState<{ available: number; required: number; shortage: number } | null>(null);
  const [credits, setCredits] = useState(0);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  // ═══ VERIFICAÇÃO INICIAL ═══
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      let fetchedCredits = 0;
      try {
        const res = await fetch('/api/subscription', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
        if (res.ok) { const sub = await res.json(); fetchedCredits = sub.credits_available; setCredits(fetchedCredits); }
      } catch {}

      const trackLeadEvent = async (eventType: string, meta?: any) => {
        try {
          await fetch('/api/marketing/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'track_event', userId: session.user.id, email: session.user.email, eventType, meta }) });
        } catch {}
      };

      let tp: TrialProfile = { subscription_status: 'trial', plan_type: 'trial', trial_used: false, trial_analysis_id: null, trial_started_at: null, trial_ends_at: null, lead_id: null };
      try {
        const { data: profile } = await supabase.from('profiles')
          .select('subscription_status, plan_type, trial_used, trial_analysis_id, trial_started_at, trial_ends_at, lead_id')
          .eq('id', session.user.id).single();
        if (profile) tp = { subscription_status: profile.subscription_status, plan_type: profile.plan_type, trial_used: profile.trial_used, trial_analysis_id: profile.trial_analysis_id, trial_started_at: profile.trial_started_at, trial_ends_at: profile.trial_ends_at, lead_id: profile.lead_id };
      } catch {}
      setTrialProfile(tp);

      if (fetchedCredits <= 0) {
        setTrialBlocked(true);
        setPageReady(true);
        await trackLeadEvent('trial_blocked', { origem: 'nova-analise' });
        await trackLeadEvent('upgrade_cta_view', { origem: 'bloqueio_frontend_nova_analise' });
        return;
      }

      const userEmail = session.user.email || '';
      const userNameMeta = session.user.user_metadata?.full_name || '';
      const { data: existingLead } = await supabase.from('leads')
        .select('lead_id, nome, email, telefone, cidade, estado').eq('user_id', session.user.id).maybeSingle();

      if (existingLead) {
        const missing: string[] = [];
        if (!existingLead.nome || existingLead.nome.trim().length < 2) missing.push('nome');
        if (!existingLead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existingLead.email)) missing.push('email');
        const authMeta = session.user.user_metadata || {};
        const needsSync = (!existingLead.cidade && authMeta.cidade) || (!existingLead.estado && authMeta.estado) || (!existingLead.telefone && authMeta.whatsapp);
        if (needsSync) {
          fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ user_id: session.user.id, nome: existingLead.nome, email: existingLead.email, telefone: existingLead.telefone || authMeta.whatsapp || null, cidade: existingLead.cidade || authMeta.cidade || null, estado: existingLead.estado || authMeta.estado || null, origem: 'nova-analise-sync' }) }).catch(() => {});
        }
        if (missing.length > 0) {
          setLeadForm({ nome: existingLead.nome || userNameMeta, email: existingLead.email || userEmail, telefone: existingLead.telefone || authMeta.whatsapp || '', cidade: existingLead.cidade || authMeta.cidade || '', estado: existingLead.estado || authMeta.estado || '' });
          setLeadModalOpen(true);
        }
      } else {
        const authMeta = session.user.user_metadata || {};
        if (userNameMeta && userEmail && authMeta.cidade && authMeta.estado) {
          fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ user_id: session.user.id, nome: userNameMeta, email: userEmail, telefone: authMeta.whatsapp || null, cidade: authMeta.cidade, estado: authMeta.estado, origem: 'nova-analise-auto' }) }).catch(() => {});
        } else {
          setLeadForm({ nome: userNameMeta, email: userEmail, telefone: authMeta.whatsapp || '', cidade: authMeta.cidade || '', estado: authMeta.estado || '' });
          setLeadModalOpen(true);
        }
      }
      setPageReady(true);
    };
    init();
  }, [router]);

  const handleLeadSubmit = async () => {
    setLeadSaving(true);
    setLeadErrors({});
    const { payload, errors } = montarLeadPayload(leadForm);
    if (!payload) { setLeadErrors(errors); setLeadSaving(false); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showToast('Sessão expirada.', 'error'); router.push('/login'); return; }
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: session.user.id, nome: payload.nome, email: payload.email, telefone: payload.telefone || null, cidade: payload.cidade || null, estado: payload.estado || null, origem: 'nova-analise' }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e?.error || 'Erro ao salvar dados.', 'error'); setLeadSaving(false); return; }
      await supabase.from('profiles').update({ lead_id: session.user.id }).eq('id', session.user.id);
      setLeadModalOpen(false);
    } catch { showToast('Erro de conexão. Tente novamente.', 'error'); }
    setLeadSaving(false);
  };

  // ── Módulos ──────────────────────────────────────────────────────────────
  const fileItemsForProfile = files.map(f => ({ name: f.file.name, type: f.type }));
  const docProfile = buildDocumentProfile(fileItemsForProfile);

  const retainCompatibleModules = (modules: string[], nextFiles: { file: File; type: string }[]) => {
    const nextProfile = buildDocumentProfile(nextFiles.map(f => ({ name: f.file.name, type: f.type })));
    return modules.filter(modId => getModuleCompatibility(modId, nextProfile).enabled);
  };

  const totalPrice = calculateAuditModulesTotal(selectedModules);

  const toggleModule = (id: string) => {
    const comp = getModuleCompatibility(id, docProfile);
    if (!comp.enabled) return;
    setSelectedModules(prev => {
      if (id === "cruzamento_total") return prev.includes(id) ? prev.filter(m => m !== id) : [id];
      return prev.includes(id) ? prev.filter(m => m !== id) : [...prev.filter(m => m !== "cruzamento_total"), id];
    });
  };

  const selectRecommended = () => {
    setSelectedModules(AUDIT_MODULES.filter(m => m.id !== "cruzamento_total" && getModuleCompatibility(m.id, docProfile).recommended).map(m => m.id));
  };

  // ── Upload / Drag-and-drop ────────────────────────────────────────────────
  const processFiles = useCallback(async (rawFiles: File[]) => {
    if (files.length + rawFiles.length > MAX_FILE_COUNT) {
      showToast(`Limite de ${MAX_FILE_COUNT} arquivos atingido.`, 'error');
      return;
    }
    const newItems: { file: File; type: string }[] = [];
    for (const f of rawFiles) {
      const err = await validateFile(f);
      if (err) { showToast(err, 'error'); return; }
      newItems.push({ file: f, type: currentDocType });
    }
    const nextFiles = [...files, ...newItems];
    setFiles(nextFiles);
    setSelectedModules(prev => retainCompatibleModules(prev, nextFiles));
  }, [files, currentDocType]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (dropped.length === 0) { showToast('Apenas PDFs são aceitos.', 'error'); return; }
    processFiles(dropped);
  }, [processFiles]);

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const next = [...files];
    next.splice(index, 1);
    setFiles(next);
    setSelectedModules(prev => retainCompatibleModules(prev, next));
  };

  // ── Validações por etapa ─────────────────────────────────────────────────
  const goNext = () => {
    if (step === 1) {
      if (!propName.trim()) { showToast('Informe o nome da propriedade.', 'error'); return; }
      if (!propState) { showToast('Selecione o estado.', 'error'); return; }
      if (!propCity.trim()) { showToast('Informe o município.', 'error'); return; }
    }
    if (step === 2) {
      if (files.length === 0) { showToast('Anexe ao menos um documento.', 'error'); return; }
    }
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (selectedModules.length === 0) { showToast('Selecione ao menos um módulo.', 'error'); return; }
    for (const item of files) {
      const err = await validateFile(item.file);
      if (err) { showToast(err, 'error'); return; }
    }
    const incompatible = selectedModules.some(id => !getModuleCompatibility(id, docProfile).enabled);
    if (incompatible) { showToast('Módulos incompatíveis com os documentos.', 'error'); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showToast('Sessão expirada.', 'error'); setTimeout(() => router.push('/login'), 1500); return; }
      const userId = session.user.id;
      const declaredAreaHa = parseDeclaredAreaHa(propArea);

      const { data: property, error: propError } = await supabase.from('properties')
        .insert({ user_id: userId, name: propName, state: propState, city: propCity, area: declaredAreaHa, cpf_cnpj: cpfCnpj || null, car_number: carNumber || null })
        .select().single();
      if (propError) throw new Error("Erro ao salvar propriedade: " + propError.message);

      let firstDocId = null;
      const uploadedDocuments: CaseFileDocument[] = [];
      const intakeCreatedAt = new Date().toISOString();
      for (const item of files) {
        const ext = item.file.name.split('.').pop();
        const filePath = `${userId}/${property.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, item.file);
        if (uploadError) throw new Error("Erro de upload: " + uploadError.message);
        const { data: docData, error: docError } = await supabase.from('documents')
          .insert({ property_id: property.id, user_id: userId, file_path: filePath, document_type: item.type, status: 'pending' })
          .select().single();
        if (docError) throw new Error("Erro ao salvar documento: " + docError.message);
        if (!firstDocId) firstDocId = docData.id;
        uploadedDocuments.push({ name: item.file.name, type: item.type, storage_path: filePath, size: item.file.size ?? null, uploaded_at: intakeCreatedAt });
      }

      const findingsJson = {
        intake_status: "created",
        selected_modules: selectedModules,
        estimated_total: totalPrice,
        current_step: "Análise criada e aguardando processamento.",
        case_file: createInitialCaseFile({ now: intakeCreatedAt, property: { name: propName, state: propState, city: propCity, car_number: carNumber || null, declared_area_ha: declaredAreaHa, owner_document: cpfCnpj || null }, documents: uploadedDocuments })
      };

      const { data: analysis, error: analysisError } = await supabase.from('analyses')
        .insert({ document_id: firstDocId, property_id: property.id, user_id: userId, status: 'ready_for_processing', findings: findingsJson })
        .select().single();
      if (analysisError) throw new Error("Erro ao criar análise: " + analysisError.message);

      const analyzeRes = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ analysisId: analysis.id }) });

      if (analyzeRes.status === 403) {
        const data = await analyzeRes.json();
        const updatedFindings = { ...findingsJson, required_pages: data.blockInfo?.required || 0, shortage_pages: data.blockInfo?.shortage || 0 };
        await supabase.from('analyses').update({ status: 'payment_pending', findings: updatedFindings }).eq('id', analysis.id);
        if (data.blockInfo) { setPagesBlockInfo(data.blockInfo); } else { showToast(data.error || 'Saldo insuficiente.', 'error'); }
        return;
      }
      if (!analyzeRes.ok) { const e = await analyzeRes.json().catch(() => ({})); throw new Error(e.error || "Erro no processamento"); }

      showToast("Auditoria iniciada! Redirecionando...", 'success');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (error: unknown) {
      showToast('Erro: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const isTrialFree = trialProfile?.plan_type === 'trial' && !trialProfile?.trial_used;

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold transition-all max-w-sm ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-brand-green text-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo size="sm" className="text-white" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 font-bold flex items-center gap-1.5 text-brand-gold">
              <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
              {credits} pág(s)
            </span>
            <Link href="/dashboard" className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-sm font-medium">
              <ArrowLeft size={16} /> Voltar
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8 max-w-4xl pb-32">

        {/* ═══ BLOQUEIO DE SALDO ═══ */}
        {trialBlocked ? (
          <div className="bg-white p-10 rounded-2xl shadow-xl border-t-4 border-amber-500 text-center mt-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={40} className="text-amber-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-800 mb-3">Saldo Insuficiente</h1>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">Para continuar processando matrículas, adquira créditos ou assine um plano.</p>
            <Link href="/dashboard/planos" className="inline-flex items-center gap-2 bg-brand-gold text-brand-green px-8 py-4 rounded-xl font-extrabold text-lg hover:brightness-110 transition-all shadow-lg">
              Ver Planos <ArrowRight size={20} />
            </Link>
          </div>
        ) : pagesBlockInfo ? (
          <div className="bg-white p-10 rounded-2xl shadow-xl border-t-4 border-red-500 text-center mt-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Layers size={40} className="text-red-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-800 mb-3">Saldo Insuficiente</h1>
            <p className="text-red-600 text-base font-bold mb-6 max-w-md mx-auto">
              O documento excede seu saldo ({pagesBlockInfo.available} páginas disponíveis).
            </p>
            <div className="bg-gray-50 rounded-xl p-6 max-w-md mx-auto mb-8 border border-gray-200 text-sm">
              <p className="text-gray-700 mb-1">Páginas necessárias: <strong>{pagesBlockInfo.required}</strong></p>
              <p className="text-gray-700 mb-1">Seu saldo: <strong>{pagesBlockInfo.available}</strong></p>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-red-600 font-bold">Faltam {pagesBlockInfo.shortage} páginas</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard/planos" className="inline-flex items-center justify-center gap-2 bg-brand-gold text-brand-green px-6 py-3 rounded-xl font-bold text-lg hover:brightness-110 transition-all shadow-md w-full sm:w-auto">
                Comprar páginas
              </Link>
              <Link href="/dashboard/planos" className="inline-flex items-center justify-center gap-2 bg-brand-green text-white px-6 py-3 rounded-xl font-bold text-lg hover:bg-green-800 transition-all shadow-md w-full sm:w-auto">
                Fazer upgrade
              </Link>
            </div>
            <button onClick={() => setPagesBlockInfo(null)} className="mt-6 text-gray-500 hover:text-gray-800 underline transition-colors">
              Voltar e editar
            </button>
          </div>
        ) : (
          <>
            {/* ═══ HEADER ═══ */}
            <div className="text-center mb-8 mt-4">
              <div className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border border-brand-green/20">
                <ShieldCheck size={14} /> Auditoria Fundiária
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-2">
                Nova Auditoria Fundiária
              </h1>
              <p className="text-gray-500 text-base">
                {isTrialFree ? '🎁 Sua primeira análise é gratuita · ' : ''}3 etapas · ~2 minutos de cadastro · resultado em até 5 min
              </p>
            </div>

            {/* ═══ STEP INDICATOR ═══ */}
            <StepIndicator step={step} />

            {/* ─────────── ETAPA 1: PROPRIEDADE ─────────── */}
            {step === 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                <h2 className="text-xl font-extrabold text-gray-800 mb-1">Dados da Propriedade</h2>
                <p className="text-sm text-gray-500 mb-6">Identifique a área que será auditada.</p>

                <div className="space-y-5">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      Nome da Propriedade / Fazenda <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={propName}
                      onChange={e => setPropName(e.target.value)}
                      type="text"
                      placeholder="Ex: Fazenda São Jorge"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none text-gray-900 text-base transition-all"
                    />
                  </div>

                  {/* Estado + Município */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">
                        Estado <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={propState}
                        onChange={e => setPropState(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none bg-white text-gray-900 transition-all"
                      >
                        <option value="">Selecione</option>
                        {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">
                        Município <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={propCity}
                        onChange={e => setPropCity(e.target.value)}
                        type="text"
                        placeholder="Ex: Palmas"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none text-gray-900 transition-all"
                      />
                    </div>
                  </div>

                  {/* Dados Opcionais (colapsável) */}
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowOptional(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-2"><Info size={14} className="text-brand-gold" /> Dados complementares (opcional)</span>
                      {showOptional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showOptional && (
                      <div className="px-4 pb-4 pt-2 space-y-4 bg-gray-50/50">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Área declarada (hectares)</label>
                          <input
                            value={propArea}
                            onChange={e => setPropArea(e.target.value)}
                            type="text"
                            inputMode="decimal"
                            placeholder="Ex: 122,54"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green outline-none text-sm"
                          />
                          <p className="text-xs text-gray-600 mt-1">Deixe em branco se não souber — o sistema extrai a área dos documentos.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">CPF / CNPJ do Proprietário</label>
                            <input
                              value={cpfCnpj}
                              onChange={e => setCpfCnpj(e.target.value)}
                              type="text"
                              placeholder="Consulta IBAMA e Receita Federal"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green outline-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Número do CAR</label>
                            <input
                              value={carNumber}
                              onChange={e => setCarNumber(e.target.value)}
                              type="text"
                              placeholder="MT-5103403-1E5A..."
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green outline-none text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button
                    onClick={goNext}
                    className="inline-flex items-center gap-2 bg-brand-green text-white px-8 py-3.5 rounded-xl font-extrabold text-base hover:brightness-110 transition-all shadow-md"
                  >
                    Próximo: Documentos <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────── ETAPA 2: DOCUMENTOS ─────────── */}
            {step === 2 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                <h2 className="text-xl font-extrabold text-gray-800 mb-1">Documentos da Área</h2>
                <p className="text-sm text-gray-500 mb-6">Envie matrículas e demais documentos fundiários em PDF.</p>

                {/* Seleção de tipo — chips */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Tipo do documento a anexar</p>
                  <div className="flex flex-wrap gap-2">
                    {DOC_TYPES.map(dt => (
                      <button
                        key={dt.value}
                        type="button"
                        onClick={() => setCurrentDocType(dt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          currentDocType === dt.value
                            ? 'bg-brand-green text-white border-brand-green shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-brand-green hover:text-brand-green'
                        }`}
                      >
                        {dt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-brand-green bg-green-50 scale-[1.01]'
                      : 'border-gray-200 hover:border-brand-green hover:bg-gray-50'
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple className="sr-only" onChange={onFileInput} />
                  <UploadCloud size={40} className={`mx-auto mb-3 transition-colors ${isDragging ? 'text-brand-green' : 'text-gray-400'}`} />
                  <p className="font-bold text-gray-700 mb-1">
                    {isDragging ? 'Solte para adicionar' : 'Arraste PDFs aqui ou clique para selecionar'}
                  </p>
                  <p className="text-xs text-gray-600">
                    Tipo selecionado: <strong className="text-brand-green">{currentDocType}</strong> · máx. {MAX_FILE_SIZE_MB} MB por arquivo · até {MAX_FILE_COUNT} arquivos
                  </p>
                </div>

                {/* Lista de arquivos */}
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">{files.length} documento(s) prontos</p>
                    {files.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 border border-green-100 p-3 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-green-100 p-2 rounded-lg text-brand-green flex-shrink-0"><FileText size={16} /></div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-brand-green uppercase tracking-wider">{item.type}</p>
                            <p className="text-sm text-gray-700 font-medium truncate max-w-xs">{item.file.name}</p>
                            <p className="text-xs text-gray-400">{(item.file.size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeFile(index)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                          <XCircle size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between mt-8">
                  <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 px-5 py-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 transition-all">
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button
                    onClick={goNext}
                    disabled={files.length === 0}
                    className="inline-flex items-center gap-2 bg-brand-green text-white px-8 py-3.5 rounded-xl font-extrabold text-base hover:brightness-110 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próximo: Auditoria <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────── ETAPA 3: MÓDULOS ─────────── */}
            {step === 3 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-800 mb-1">Foco da Auditoria Forense</h2>
                    <p className="text-sm text-gray-500">Selecione os módulos. Itens compatíveis com seus documentos estão habilitados.</p>
                  </div>
                  <button
                    type="button"
                    onClick={selectRecommended}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors"
                  >
                    <CheckCircle2 size={13} /> Recomendados
                  </button>
                </div>

                <div className="space-y-2 mb-6">
                  {AUDIT_MODULES.map((mod) => {
                    const isSelected = selectedModules.includes(mod.id);
                    const isMaster = mod.id === "cruzamento_total";
                    const compat = getModuleCompatibility(mod.id, docProfile);

                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleModule(mod.id)}
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all ${
                          !compat.enabled
                            ? 'opacity-40 border-gray-100 bg-gray-50 cursor-not-allowed'
                            : isMaster
                              ? isSelected
                                ? 'border-brand-gold bg-gray-900 cursor-pointer'
                                : 'border-gray-700 bg-gray-900/90 cursor-pointer hover:border-gray-600'
                              : isSelected
                                ? 'border-brand-green bg-green-50 cursor-pointer ring-1 ring-green-100'
                                : 'border-gray-100 hover:border-gray-200 cursor-pointer bg-white'
                        }`}
                      >
                        {/* Check */}
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          !compat.enabled ? 'border-gray-200' :
                          isMaster
                            ? isSelected ? 'border-brand-gold bg-brand-gold' : 'border-gray-600'
                            : isSelected ? 'border-brand-green bg-brand-green' : 'border-gray-300'
                        }`}>
                          {isSelected && compat.enabled && <CheckCircle2 size={12} className="text-white" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-bold ${!compat.enabled ? 'text-gray-400' : isMaster ? 'text-white' : 'text-gray-900'}`}>
                              {mod.name}
                            </span>
                            {isMaster && <span className="text-[10px] font-black bg-brand-gold text-brand-green px-2 py-0.5 rounded uppercase tracking-wider">MASTER</span>}
                            {compat.recommended && !isSelected && compat.enabled && (
                              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase tracking-wider border border-green-200">recomendado</span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 line-clamp-1 ${!compat.enabled ? 'text-gray-500' : isMaster ? 'text-gray-300' : 'text-gray-600'}`}>
                            {!compat.enabled && compat.reason ? compat.reason : mod.description}
                          </p>
                          {compat.enabled && compat.warning && (
                            <p className="text-xs text-amber-600 mt-0.5 font-medium">{compat.warning}</p>
                          )}
                        </div>

                        {/* Preço */}
                        <div className={`text-right flex-shrink-0 ${!compat.enabled ? 'text-gray-300' : isMaster ? 'text-white' : 'text-gray-800'}`}>
                          {isTrialFree ? (
                            <span className="text-xs font-bold text-brand-green bg-green-100 px-2 py-0.5 rounded border border-green-200">Grátis</span>
                          ) : (
                            <span className="text-sm font-black">R$ {mod.price.toFixed(2).replace('.', ',')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between mt-6">
                  <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 px-5 py-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 transition-all">
                    <ArrowLeft size={16} /> Voltar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ═══ STICKY FOOTER — ETAPA 3 ═══ */}
      {step === 3 && !trialBlocked && !pagesBlockInfo && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-2xl">
          <div className="container mx-auto max-w-4xl px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                {selectedModules.length === 0 ? (
                  <p className="text-sm text-gray-400 font-medium">Selecione ao menos um módulo</p>
                ) : isTrialFree ? (
                  <>
                    <p className="text-base font-black text-brand-green">🎁 Primeira auditoria gratuita</p>
                    <p className="text-xs text-gray-500">{selectedModules.length} módulo(s) · sem cobrança</p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-black text-gray-900">R$ {totalPrice.toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-gray-500">{selectedModules.length} módulo(s) selecionado(s)</p>
                  </>
                )}
              </div>
              <button
                disabled={loading || selectedModules.length === 0}
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 bg-brand-green text-white px-7 py-3.5 rounded-xl font-extrabold text-base hover:brightness-110 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {loading ? (
                  <><span className="animate-pulse">Processando...</span></>
                ) : isTrialFree ? (
                  <>Iniciar Auditoria Gratuita <ArrowRight size={18} /></>
                ) : (
                  <>Enviar para Auditoria <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL DE LEAD ═══ */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} className="text-brand-green" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-800">Complete seu cadastro</h2>
              <p className="text-sm text-gray-500 mt-2">Para iniciar a auditoria, precisamos de seus dados.</p>
            </div>
            <div className="space-y-4">
              {[
                { key: 'nome', label: 'Nome Completo', type: 'text', placeholder: 'Seu nome completo' },
                { key: 'email', label: 'E-mail', type: 'email', placeholder: 'seu@email.com' },
                { key: 'telefone', label: 'WhatsApp', type: 'tel', placeholder: '(63) 9 9999-9999' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{f.label} *</label>
                  <input
                    type={f.type}
                    value={(leadForm as any)[f.key]}
                    onChange={e => setLeadForm({ ...leadForm, [f.key]: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-green transition-all ${(leadErrors as any)[f.key] ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                    placeholder={f.placeholder}
                  />
                  {(leadErrors as any)[f.key] && <p className="text-red-600 text-xs mt-1">{(leadErrors as any)[f.key][0]}</p>}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Cidade *</label>
                  <input
                    type="text"
                    value={leadForm.cidade}
                    onChange={e => setLeadForm({ ...leadForm, cidade: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-green ${leadErrors.cidade ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                    placeholder="Sua cidade"
                  />
                  {leadErrors.cidade && <p className="text-red-600 text-xs mt-1">{leadErrors.cidade[0]}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Estado *</label>
                  <select
                    value={leadForm.estado}
                    onChange={e => setLeadForm({ ...leadForm, estado: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-green bg-white ${leadErrors.estado ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                  >
                    <option value="">UF</option>
                    {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                  {leadErrors.estado && <p className="text-red-600 text-xs mt-1">{leadErrors.estado[0]}</p>}
                </div>
              </div>
            </div>
            <button
              onClick={handleLeadSubmit}
              disabled={leadSaving}
              className="w-full mt-6 bg-brand-green text-white py-4 rounded-xl font-extrabold text-lg hover:brightness-110 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {leadSaving ? 'Salvando...' : <>Salvar e Continuar <ArrowRight size={20} /></>}
            </button>
            <p className="text-xs text-gray-600 text-center mt-4">Seus dados são protegidos e não serão compartilhados.</p>
          </div>
        </div>
      )}
    </div>
  );
}
