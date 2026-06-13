"use client";

import Link from 'next/link';
import { ShieldCheck, FileText, TrendingUp, ArrowRight, CheckCircle2, ChevronRight, Lock, AlertTriangle, MapPin, Clock, Users, BarChart3, Search, Scale, Landmark, ChevronDown, Upload, Eye, FileSearch, HelpCircle, Star, Target, XCircle, Zap, Layers, BookOpen, GitBranch, Globe, Award, UserPlus, Send, BarChart2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { motion, Variants } from 'framer-motion';
import { useState } from 'react';

const faqData = [
  {
    q: "O AgrolexI garante que a propriedade não tem risco?",
    a: "Não. Nenhuma análise documental pode garantir 100% de segurança. O AgrolexI organiza os documentos enviados, aplica critérios técnicos e ajuda a identificar sinais de risco. A decisão final é sempre sua — e, quando houver indícios relevantes, recomendamos consultar um profissional especializado."
  },
  {
    q: "Posso confiar no resultado da análise?",
    a: "O AgrolexI segue uma metodologia documental estruturada em camadas, aplicando critérios técnicos sobre as informações presentes nos arquivos enviados. O resultado ajuda a direcionar sua atenção para pontos sensíveis, mas não substitui uma auditoria presencial ou a análise de um advogado quando o risco for relevante."
  },
  {
    q: "Que tipos de risco o AgrolexI pode indicar?",
    a: "A análise pode indicar inconsistências em matrículas, lacunas na cadeia dominial, divergências entre documentos, sinais de ônus ou restrições, e ausência de documentos importantes. Cada sinal de alerta é contextualizado para você entender o que pode significar no seu caso."
  },
  {
    q: "A análise considera dados de órgãos oficiais?",
    a: "O AgrolexI analisa exclusivamente os documentos que você envia. Com base nas informações presentes nesses arquivos, o sistema cruza dados entre matrículas, títulos, CCIR, CAR e outros documentos para apontar divergências ou inconsistências. Não há consulta automática a bases externas governamentais."
  },
  {
    q: "O que fazer se a análise apontar um risco?",
    a: "Se o relatório indicar sinais de alerta, recomendamos consultar um advogado ou profissional especializado em direito imobiliário rural para uma avaliação aprofundada. O AgrolexI é uma ferramenta de análise documental inicial — o parecer definitivo cabe a um especialista."
  },
  {
    q: "Preciso de um advogado para usar a plataforma?",
    a: "Não. O sistema foi feito para qualquer pessoa que precise verificar a segurança de um imóvel rural — produtor, comprador, vendedor, corretor. O relatório serve como base técnica para sua decisão e também pode ser levado ao seu advogado de confiança."
  },
  {
    q: "Quanto tempo leva para receber o resultado?",
    a: "Uma análise padrão fica pronta em 2 a 5 minutos. Para documentos mais extensos ou complexos, pode levar até 10 minutos. Você não espera semanas como na due diligence tradicional."
  },
  {
    q: "Meus documentos ficam protegidos?",
    a: "Sim. Toda a transmissão é criptografada (TLS 1.3) e os arquivos armazenados com AES-256. Você pode excluir permanentemente seus dados a qualquer momento. Seguimos rigorosamente a LGPD."
  }
];

const modulesData = [
  { 
    icone: <BookOpen size={24} />, 
    titulo: "Matrículas e títulos", 
    desc: "Identifique registros, averbações e informações que podem revelar riscos antes da negociação." 
  },
  { 
    icone: <GitBranch size={24} />, 
    titulo: "Cadeia dominial", 
    desc: "Entenda a trajetória dos proprietários e perceba quebras ou lacunas na origem da área." 
  },
  { 
    icone: <Landmark size={24} />, 
    titulo: "INCRA e origem pública", 
    desc: "Avalie títulos fundiários, origem da área e documentos relacionados à regularidade da propriedade." 
  },
  { 
    icone: <MapPin size={24} />, 
    titulo: "Georreferenciamento", 
    desc: "Verifique áreas, confrontações e dados territoriais que podem indicar divergências relevantes." 
  },
  { 
    icone: <FileSearch size={24} />, 
    titulo: "Riscos registrais", 
    desc: "Localize inconsistências documentais que podem comprometer compra, venda ou regularização." 
  },
  { 
    icone: <Scale size={24} />, 
    titulo: "Indícios de nulidades", 
    desc: "Encontre sinais que exigem atenção jurídica antes que o problema vire prejuízo." 
  },
  { 
    icone: <AlertTriangle size={24} />, 
    titulo: "Documentos ausentes", 
    desc: "Descubra quais documentos podem estar faltando para uma avaliação mais segura do imóvel." 
  },
  { 
    icone: <Layers size={24} />, 
    titulo: "Cruzamento documental", 
    desc: "Compare informações entre documentos e identifique divergências que passariam despercebidas." 
  }
];

const riscosOcultos = [
  { icone: <ShieldCheck size={28} />, titulo: "Matrícula com problema", desc: "Uma matrícula irregular pode invalidar a compra inteira. Você pode perder o imóvel e o dinheiro." },
  { icone: <MapPin size={28} />, titulo: "Área que não é sua", desc: "Sobreposição com terra pública, reserva indígena ou unidade de conservação. Você compra, mas não pode usar." },
  { icone: <GitBranch size={28} />, titulo: "Cadeia de títulos quebrada", desc: "Um elo perdido na corrente de proprietários pode anular todos os registros seguintes. O risco é real." },
  { icone: <FileSearch size={28} />, titulo: "Fraude documental", desc: "Certidões falsas, assinaturas forjadas, averbações irregulares. Sem um olhar técnico, você não percebe." },
  { icone: <Landmark size={28} />, titulo: "Origem em terra pública", desc: "Grilagem é crime. Se a origem do imóvel for irregular, você herda um passivo criminal sem saber." },
  { icone: <Scale size={28} />, titulo: "Conflito com vizinhos", desc: "Divisas imprecisas, falta de georreferenciamento, ações possessórias. Uma briga judicial que poderia ser evitada." },
  { icone: <Lock size={28} />, titulo: "Restrições invisíveis", desc: "Ônus, hipotecas, penhoras, cláusulas resolutivas. Existem amarras legais que o vendedor pode não revelar." },
];

const casosReais = [
  {
    problema: "Comprador ia adquirir fazenda de 800 ha no MATOPIBA",
    descoberta: "Problema identificado: sobreposição de 120 ha com terra pública não demarcada (INCRA)",
    beneficio: "Decisão mais segura tomada: cliente recusou a compra e evitou uma negociação de alto risco"
  },
  {
    problema: "Produtor rural precisava financiar 4 matrículas para safra",
    descoberta: "Sinal de alerta encontrado: duas matrículas tinham cláusula resolutiva não cumprida — banco rejeitaria o financiamento",
    beneficio: "Decisão mais segura tomada: regularizou as cláusulas em 15 dias e o crédito foi aprovado sem glosa"
  },
  {
    problema: "Escritório de advocacia analisava ação de usucapião rural",
    descoberta: "Sinal de alerta encontrado: cadeia dominial apontava nulidade na 2ª alienação (venda por procuração inválida)",
    beneficio: "Decisão mais segura tomada: advogado usou o dossiê como prova técnica e venceu a ação"
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen text-white selection:bg-brand-gold selection:text-brand-dark overflow-hidden relative">
      {/* Background */}
      <div 
        className="absolute top-0 left-0 w-full h-full bg-cover bg-center bg-no-repeat fixed"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')", zIndex: -20 }}
      ></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#051F15]/50 via-[#051F15]/75 to-[#051F15]/95 fixed pointer-events-none" style={{ zIndex: -10 }}></div>

      {/* Header — simplificado */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-[#051F15]/80 border-b border-white/10"
      >
        <div className="container mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
          <Logo size="md" />
          <nav className="hidden md:flex gap-8">
            <Link href="#riscos" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">RISCOS</Link>
            <Link href="#score" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">SCORE</Link>
            <Link href="#casos" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">CASOS REAIS</Link>
            <Link href="#como-funciona" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">COMO FUNCIONA</Link>
            <Link href="#faq" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">FAQ</Link>
          </nav>
          <div className="flex gap-4">
            <Link href="/cadastro" className="px-6 py-2.5 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all font-bold text-sm">
              Verificar Minha Propriedade
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ===== HERO SECTION (P0) ===== */}
      <main className="pt-32 pb-24 px-4 relative">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="container mx-auto max-w-6xl relative z-10 mt-10 md:mt-20"
        >
          <div className="grid md:grid-cols-5 gap-8 items-center">
            {/* Coluna esquerda — conteúdo principal */}
            <div className="md:col-span-3 text-center md:text-left flex flex-col justify-center">
              <motion.div variants={itemVariants} className="inline-flex w-fit mx-auto md:mx-0 items-center gap-2 px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full text-brand-gold text-sm font-bold uppercase tracking-widest mb-6">
                <ShieldCheck size={16} />
                Inteligência Fundiária para Decisões Seguras
              </motion.div>

              <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
                Antes de comprar ou negociar uma
                <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold to-yellow-400">
                  propriedade rural
                </span>
                <br/>
                descubra o que os documentos podem estar escondendo
              </motion.h1>
              <motion.p variants={itemVariants} className="text-lg md:text-xl mb-6 text-gray-300 font-light max-w-2xl leading-relaxed">
                Em poucos minutos, o AgrolexI organiza matrículas, títulos, cadeia de proprietários e documentos enviados para apontar sinais de risco, inconsistências e pontos que merecem atenção antes da decisão.
              </motion.p>

              {/* Micro-benefícios */}
              <motion.div variants={itemVariants} className="flex flex-wrap justify-center md:justify-start gap-4 mb-8">
                <span className="inline-flex items-center gap-1.5 text-gray-300 text-sm">
                  <CheckCircle2 size={16} className="text-brand-gold" /> Mais clareza antes de negociar
                </span>
                <span className="inline-flex items-center gap-1.5 text-gray-300 text-sm">
                  <CheckCircle2 size={16} className="text-brand-gold" /> Sinais de risco organizados
                </span>
                <span className="inline-flex items-center gap-1.5 text-gray-300 text-sm">
                  <CheckCircle2 size={16} className="text-brand-gold" /> Decisão mais informada
                </span>
              </motion.div>
            </div>

            {/* Coluna direita — Bloco de Conversão Acoplado ao Quadro Demonstrativo */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 space-y-6"
            >
              {/* CTAs e Subtexto reposicionados */}
              <div className="bg-white/5 backdrop-blur-md border border-brand-gold/30 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <Link href="/cadastro?next=/dashboard/nova-analise&trial=true" className="group w-full px-6 py-3.5 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full text-base font-extrabold hover:scale-[1.02] shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center gap-2.5">
                    Fazer Análise Gratuita
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="#como-funciona" className="w-full px-6 py-3 border border-white/20 rounded-full text-sm font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm text-gray-300">
                    <Eye size={16} /> Ver Como Funciona
                  </Link>
                </div>

                <div className="flex flex-col gap-1 text-center sm:text-left">
                  <span className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-emerald-400/90 text-xs font-semibold">
                    <CheckCircle2 size={13} className="flex-shrink-0" />
                    Teste o AgrolexI com 1 matrícula simples. Sem compromisso.
                  </span>
                  <span className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-brand-gold/80 text-[10px] font-black uppercase tracking-widest">
                    <Clock size={11} /> Resultado em até 5 min · Prévia inteligente grátis
                  </span>
                </div>
              </div>

              {/* Quadro de Análise Demonstrativa */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-[0_0_40px_rgba(212,175,55,0.15)] hover:shadow-[0_0_50px_rgba(212,175,55,0.25)] transition-all duration-500">
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-gold/20 border border-brand-gold/30 rounded-full text-brand-gold text-[10px] font-bold uppercase tracking-widest mb-4">
                  <Star size={12} /> Análise demonstrativa
                </div>

                {/* Título da propriedade */}
                <div className="mb-4">
                  <h3 className="text-white font-bold text-lg">Fazenda Boa Esperança</h3>
                  <p className="text-gray-400 text-sm flex items-center gap-1.5">
                    <MapPin size={14} className="text-brand-gold" />
                    Matrícula 12.345 — GO
                  </p>
                </div>

                {/* Score circular */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg width="80" height="80" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="48" fill="none" stroke="#1f2937" strokeWidth="8" />
                      <circle cx="60" cy="60" r="48" fill="none" stroke="#D4AF37" strokeWidth="8"
                        strokeDasharray={`${0.6 * 301.59} 301.59`}
                        strokeDashoffset="37.7"
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                      <text x="60" y="52" textAnchor="middle" className="text-4xl font-black" fill="#D4AF37" fontSize="24">72</text>
                      <text x="60" y="72" textAnchor="middle" fill="#9CA3AF" fontSize="10">/100</text>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">Score AgrolexI</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-900/30 border border-yellow-500/30 rounded-full text-yellow-300 text-xs font-bold">
                      <AlertTriangle size={12} /> Risco Médio
                    </span>
                  </div>
                </div>

                {/* Mini barras de score */}
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Segurança Documental</span>
                      <span className="text-brand-gold font-bold">82</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-gold" style={{ width: "82%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Robustez Registral</span>
                      <span className="text-yellow-400 font-bold">74</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400" style={{ width: "74%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Risco Dominial</span>
                      <span className="text-red-400 font-bold">41</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-400" style={{ width: "41%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Regularidade Fundiária</span>
                      <span className="text-emerald-400 font-bold">89</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: "89%" }} />
                    </div>
                  </div>
                </div>

                <p className="text-gray-500 text-[10px] mt-3 text-center">
                  * Análise demonstrativa baseada nas informações presentes nos documentos enviados. Cada propriedade tem resultado único.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>

      {/* ===== COMO FUNCIONA A ANÁLISE GRATUITA ===== */}
      <section id="analise-gratuita" className="py-20 px-4 relative z-10 bg-[#051F15] border-t border-white/5">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            {/* Badge de destaque */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-900/30 border border-emerald-500/30 rounded-full text-emerald-300 text-sm font-bold uppercase tracking-widest mb-5">
              <CheckCircle2 size={15} />
              1 análise gratuita · sem cartão · sem compromisso
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Como funciona a análise gratuita
            </h2>
            <p className="text-gray-400 text-base max-w-2xl mx-auto">
              Em 4 passos simples, você tem uma prévia inteligente da situação documental do imóvel.
            </p>
          </motion.div>

          {/* 4 cards horizontais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                num: "1",
                icon: <UserPlus size={26} />,
                titulo: "Cadastre-se",
                desc: "Crie sua conta gratuitamente. Nenhum cartão de crédito necessário.",
                cor: "from-brand-gold/20 to-yellow-900/10",
                borda: "border-brand-gold/20",
              },
              {
                num: "2",
                icon: <Send size={26} />,
                titulo: "Envie uma matrícula simples",
                desc: "Faça upload de 1 matrícula de imóvel rural. O sistema processa em minutos.",
                cor: "from-blue-900/20 to-blue-950/10",
                borda: "border-blue-500/20",
              },
              {
                num: "3",
                icon: <BarChart2 size={26} />,
                titulo: "Veja a prévia inteligente",
                desc: "Receba o ISF (Índice de Segurança Fundiária), a classificação de risco e os alertas identificados.",
                cor: "from-emerald-900/20 to-emerald-950/10",
                borda: "border-emerald-500/20",
              },
              {
                num: "4",
                icon: <Lock size={26} />,
                titulo: "Desbloqueie quando quiser",
                desc: "O relatório completo — cadeia dominial, módulos avançados e dossiê — está disponível nos planos pagos.",
                cor: "from-purple-900/20 to-purple-950/10",
                borda: "border-purple-500/20",
              },
            ].map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`relative bg-gradient-to-b ${card.cor} border ${card.borda} rounded-2xl p-6 flex flex-col gap-3`}
              >
                {/* Número do passo */}
                <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark flex items-center justify-center font-black text-xs shadow-[0_0_10px_rgba(212,175,55,0.4)]">
                  {card.num}
                </div>
                <div className="w-11 h-11 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-brand-gold">
                  {card.icon}
                </div>
                <h3 className="text-white font-bold text-base leading-snug">{card.titulo}</h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Nota de transparência */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center"
          >
            <p className="text-gray-500 text-xs max-w-xl">
              <span className="text-gray-400 font-semibold">A prévia gratuita</span> inclui ISF, classificação de risco e alertas visíveis.
              O relatório completo — cadeia dominial, módulos avançados e dossiê técnico — é exclusivo dos planos pagos.
            </p>
            <Link
              href="/cadastro?next=/dashboard/nova-analise&trial=true"
              className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full font-bold text-sm hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all"
            >
              Começar agora — é grátis
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== 8 CARDS — O QUE O AgrolexI ANALISA ===== */}
      <section className="py-24 px-4 relative z-10 bg-gradient-to-b from-[#051F15] to-[#03150D]">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-4">O que o AgrolexI analisa</h2>
              <p className="text-gray-400 text-lg max-w-4xl mx-auto">
                Cada documento pode esconder detalhes que mudam o rumo de uma negociação. O AgrolexI ajuda você a enxergar esses sinais antes de decidir.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {modulesData.map((mod, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-brand-gold/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)] transition-all duration-300 group flex flex-col"
              >
                <div className="w-12 h-12 bg-brand-gold/10 border border-brand-gold/20 rounded-xl flex items-center justify-center mb-4 text-brand-gold group-hover:bg-brand-gold/20 group-hover:border-brand-gold/40 transition-all">
                  {mod.icone}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{mod.titulo}</h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{mod.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SCORE AgrolexI (P0) ===== */}
      <section id="score" className="py-24 px-4 relative z-10 bg-gradient-to-b from-[#03150D] to-[#051F15]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Transforme documentos complexos em uma leitura simples de risco</h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                Veja em poucos segundos onde estão os pontos mais sensíveis da análise.
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Card Score principal */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ShieldCheck size={22} className="text-brand-gold" />
                Score Geral do Imóvel
              </h3>

              {/* Gauge visual simplificado */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-48 h-48 mb-4">
                  <svg width="192" height="192" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#1f2937" strokeWidth="8" />
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#D4AF37" strokeWidth="8"
                      strokeDasharray={`${0.68 * 301.59} 301.59`}
                      strokeDashoffset="37.7"
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />
                    <text x="60" y="52" textAnchor="middle" className="text-4xl font-black" fill="#D4AF37" fontSize="24">82</text>
                    <text x="60" y="72" textAnchor="middle" fill="#9CA3AF" fontSize="10">SEGURO</text>
                  </svg>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-900/30 border border-emerald-500/30 rounded-full">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-emerald-300 text-sm font-bold">Propriedade com baixo risco documental</span>
                </div>
              </div>
            </motion.div>

            {/* Cards de scores por eixo */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex flex-col gap-4"
            >
              {[
                { label: "Segurança Documental", score: 82, cor: "text-brand-gold", barra: "bg-brand-gold", largura: "82%" },
                { label: "Robustez Registral", score: 74, cor: "text-yellow-400", barra: "bg-yellow-400", largura: "74%" },
                { label: "Risco Dominial", score: 41, cor: "text-red-400", barra: "bg-red-400", largura: "41%", inverso: true },
                { label: "Regularidade Fundiária", score: 89, cor: "text-emerald-400", barra: "bg-emerald-400", largura: "89%" },
              ].map((item, idx) => (
                <div key={idx} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-6 py-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 text-sm font-semibold">{item.label}</span>
                    <span className={`${item.cor} font-black text-lg`}>{item.score}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.barra} transition-all duration-700`}
                      style={{ width: item.largura }}
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    {item.inverso
                      ? `Risco ${item.score <= 50 ? 'moderado' : 'elevado'} — atenção necessária`
                      : `Índice ${item.score >= 80 ? 'dentro do esperado' : 'dentro da margem de segurança'}`
                    }
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-gray-500 text-xs mt-8"
          >
            * Scores demonstrativos baseados em análise real. Cada propriedade tem resultado único.
          </motion.p>
        </div>
      </section>

      {/* ===== O QUE PODE ESTAR ESCONDIDO (P0) — RISCOS OCULTOS ===== */}
      <section id="riscos" className="py-24 px-4 relative z-10 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-4">O problema quase nunca aparece na primeira leitura</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">
              Uma matrícula aparentemente regular pode esconder lacunas, divergências e sinais de alerta. O AgrolexI organiza essas informações para você decidir com mais segurança.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {riscosOcultos.map((risco, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="bg-white border border-gray-100 p-6 rounded-2xl shadow-md hover:shadow-xl hover:border-brand-gold/30 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-brand-gold/10 to-yellow-100 rounded-xl flex items-center justify-center mb-4 text-brand-gold group-hover:from-brand-gold/20 group-hover:to-yellow-200 transition-all">
                  {risco.icone}
                </div>
                <h3 className="text-lg font-bold text-brand-dark mb-2">{risco.titulo}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{risco.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PROVA SOCIAL — CASOS REAIS (P0) ===== */}
      <section id="casos" className="py-24 px-4 relative z-10 bg-[#03150D]">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Casos reais analisados</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Histórias anônimas de clientes que descobriram riscos ocultos antes de tomar uma decisão.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {casosReais.map((caso, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-2 mb-5">
                  <span className="w-2 h-2 rounded-full bg-brand-gold" />
                  <span className="text-brand-gold text-xs font-bold uppercase tracking-wider">Caso #{idx + 1}</span>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-1">Problema</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{caso.problema}</p>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold mb-1">Sinal de alerta</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{caso.descoberta}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">Resultado</h4>
                  <p className="text-emerald-300 text-sm leading-relaxed font-medium">{caso.beneficio}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-gray-500 text-sm mt-8"
          >
            Nomes e dados foram alterados para preservar a confidencialidade dos clientes.
          </motion.p>
        </div>
      </section>

      {/* ===== COMO FUNCIONA + DIFERENCIAIS FUNDIDOS ===== */}
      <section id="como-funciona" className="py-24 px-4 relative z-10 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-4">Como funciona</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">
              Três passos simples para ter mais segurança sobre uma propriedade rural.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 relative mb-20">
            {/* Linha conectora */}
            <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent"></div>
            
            {[
              { num: "1", icon: <Upload className="text-brand-gold" size={28} />, title: "Envie os documentos", desc: "Você envia matrículas, títulos e documentos do imóvel.", result: "Upload em segundos" },
              { num: "2", icon: <Layers className="text-brand-gold" size={28} />, title: "O AgrolexI organiza os sinais de risco", desc: "O sistema analisa as informações em camadas e destaca inconsistências relevantes.", result: "Análise em camadas" },
              { num: "3", icon: <FileText className="text-brand-gold" size={28} />, title: "Você decide com mais clareza", desc: "Receba uma visão objetiva para comprar, vender, regularizar ou aprofundar a análise.", result: "Relatório objetivo" }
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative z-10 bg-white border border-gray-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                {/* Número do passo */}
                <div className="absolute -top-5 left-8 w-10 h-10 rounded-full bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark flex items-center justify-center font-black text-sm shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                  {step.num}
                </div>
                
                {/* Ícone */}
                <div className="w-14 h-14 bg-gradient-to-br from-brand-gold/10 to-yellow-100 rounded-xl flex items-center justify-center mb-5 group-hover:from-brand-gold/20 group-hover:to-yellow-200 transition-all">
                  {step.icon}
                </div>
                
                <h3 className="text-xl font-bold text-brand-dark mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed mb-4 text-sm">{step.desc}</p>
                
                {/* Resultado tag */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold/5 border border-brand-gold/20 rounded-lg text-brand-gold text-xs font-bold">
                  <CheckCircle2 size={12} />
                  {step.result}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Comparativo: Tradicional vs AgrolexI */}
          <div className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-3">Por que o AgrolexI é diferente</h2>
              <p className="text-gray-500 text-lg max-w-3xl mx-auto">
                Enquanto o método tradicional depende de horas de trabalho manual, o AgrolexI entrega resultados em minutos.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Tradicional */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-8"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400">
                    <XCircle size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-600">Método Tradicional</h3>
                    <p className="text-gray-400 text-xs">Due diligence manual</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    "Leitura manual de cada documento",
                    "Demora dias ou semanas",
                    "Custo elevado por análise",
                    "Risco de deixar inconsistências passarem"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-500 text-sm">
                      <XCircle size={16} className="text-red-300 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* AgrolexI */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-brand-green to-[#052e1f] border border-brand-gold/20 rounded-2xl p-8 shadow-lg"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-gold/20 rounded-xl flex items-center justify-center text-brand-gold">
                    <Award size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">AgrolexI</h3>
                    <p className="text-gray-400 text-xs">Inteligência Fundiária</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    "Análise automatizada em minutos",
                    "Metodologia em camadas progressivas",
                    "Score visual de risco por eixo",
                    "Relatório executivo objetivo e claro"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-200 text-sm">
                      <CheckCircle2 size={16} className="text-brand-gold mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>

          {/* Diferenciais */}
          <div className="bg-gradient-to-br from-brand-green to-[#052e1f] rounded-3xl p-10 md:p-14">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Diferenciais exclusivos</h2>
              <p className="text-gray-300 text-lg max-w-3xl mx-auto">
                Não somos uma IA genérica. Somos especializados em direito registral brasileiro e segurança fundiária.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icone: <Target size={28} />, titulo: "IA especializada", desc: "Treinada com legislação, jurisprudência e normativas do direito imobiliário rural brasileiro." },
                { icone: <Layers size={28} />, titulo: "Análise em camadas", desc: "Da matrícula individual ao cruzamento de informações extraídas dos documentos enviados." },
                { icone: <Zap size={28} />, titulo: "Resultado em minutos", desc: "O que levaria semanas de trabalho manual, a IA entrega em até 5 minutos." },
                { icone: <ShieldCheck size={28} />, titulo: "Proteção de dados", desc: "Criptografia ponta-a-ponta, conformidade com a LGPD e exclusão permanente sob demanda." },
              ].map((dif, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                >
                  <div className="w-12 h-12 bg-brand-gold/20 rounded-xl flex items-center justify-center mb-4 text-brand-gold">
                    {dif.icone}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{dif.titulo}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{dif.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ CENTRADO NO CLIENTE (P0) ===== */}
      <section id="faq" className="py-24 px-4 relative z-10 bg-[#03150D]">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Perguntas que todo comprador faz</h2>
            <p className="text-gray-400 text-lg">Antes de fechar negócio, tire suas dúvidas.</p>
          </div>
          <div className="space-y-3">
            {faqData.map((faq, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <h3 className="text-base font-bold text-white flex items-center gap-3">
                    <HelpCircle size={16} className="text-brand-gold flex-shrink-0" /> {faq.q}
                  </h3>
                  <ChevronDown
                    size={20}
                    className={`text-gray-400 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-400 leading-relaxed pl-7">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL — Escalonado (P1) ===== */}
      <section className="py-24 px-4 relative z-10 bg-gradient-to-br from-brand-green to-[#052e1f]">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Quer segurança para sua próxima negociação?</h2>
          <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
            Descubra agora se a propriedade que você está avaliando tem riscos ocultos. 
            Análise completa em até 5 minutos.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link
              href="/cadastro"
              className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full text-xl font-bold hover:scale-105 shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all"
            >
              Verificar Minha Propriedade
              <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-10 py-5 border border-white/20 rounded-full text-lg font-bold hover:bg-white/5 transition-colors backdrop-blur-sm"
            >
              Acessar Plataforma
              <ChevronRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER Premium — limpo (P1) ===== */}
      <footer className="border-t border-white/10 bg-black/60 pt-16 pb-8 z-10 relative">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-10 mb-12">
            <div>
              <div className="mb-4">
                <Logo size="sm" />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Inteligência Artificial especializada em segurança fundiária. Auditoria automatizada de imóveis rurais para proteger seu patrimônio.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Plataforma</h4>
              <ul className="space-y-2">
                <li><Link href="#riscos" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Riscos Ocultos</Link></li>
                <li><Link href="#score" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Score Fundiário</Link></li>
                <li><Link href="#como-funciona" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Como Funciona</Link></li>
                <li><Link href="/cadastro" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Criar Conta</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Contato</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li>contato@AgrolexI.com.br</li>
                <li className="pt-4">
                  <span className="inline-flex items-center gap-1.5 text-gray-500 text-xs">
                    <Lock size={12} /> Criptografado TLS 1.3 · LGPD
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-sm text-gray-500 font-medium">© {new Date().getFullYear()} AgrolexI Inteligência Fundiária. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
