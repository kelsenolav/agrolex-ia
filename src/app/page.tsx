"use client";

import Link from 'next/link';
import { ShieldCheck, FileText, TrendingUp, ArrowRight, CheckCircle2, ChevronRight, Lock, AlertTriangle, MapPin, Clock, Users, BarChart3, Search, Scale, Landmark, ChevronDown, Upload, Eye, FileSearch, HelpCircle, Star, Target, XCircle, Zap, Layers, BookOpen, GitBranch, Globe, Award } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { useState } from 'react';

const faqData = [
  {
    q: "Posso comprar essa área com segurança?",
    a: "O AgroLex analisa a matrícula, a cadeia de proprietários anteriores e cruza com bases do INCRA, SIGEF e CAR. Se existir qualquer irregularidade — grilagem, sobreposição, fraude documental — o sistema aponta antes de você fechar negócio. Você não precisa mais comprar no escuro."
  },
  {
    q: "Existe risco de perder a propriedade depois da compra?",
    a: "Sim, esse risco existe — e é mais comum do que parece. Uma matrícula com cadeia dominial quebrada, cláusula resolutiva não cumprida ou origem em terras públicas pode gerar nulidade. O AgroLex identifica esses riscos em minutos, não em semanas."
  },
  {
    q: "A documentação do imóvel está realmente correta?",
    a: "O sistema varre cada página da matrícula, CCIR, CAR e SIGEF em busca de inconsistências: assinaturas ausentes, averbações faltantes, áreas divergentes entre registros. Se algo estiver errado, você descobre antes de passar o contrato."
  },
  {
    q: "Vale a pena concluir a negociação?",
    a: "O relatório entrega um parecer claro com score de risco, lista de achados críticos e recomendações. Com esses dados em mãos, você decide com segurança — seja para concluir, renegociar ou desistir do negócio."
  },
  {
    q: "Existe algum problema oculto que pode me prejudicar?",
    a: "Muitos problemas ficam escondidos na documentação: ônus reais, ações judiciais, débitos de ITR, passivo ambiental, irregularidades no georreferenciamento. O AgroLex revela tudo de forma automatizada e entrega um dossiê completo para sua análise."
  },
  {
    q: "Preciso de um advogado para usar a plataforma?",
    a: "Não. O sistema foi feito para qualquer pessoa que precise verificar a segurança de um imóvel rural — produtor, comprador, vendedor, corretor. Mas o relatório também serve como base técnica para seu advogado de confiança."
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
    descoberta: "AgroLex identificou sobreposição de 120 ha com terra pública não demarcada (INCRA)",
    beneficio: "Cliente recusou a compra e evitou prejuízo estimado em R$ 4,8 milhões"
  },
  {
    problema: "Produtor rural precisava financiar 4 matrículas para safra",
    descoberta: "Duas matrículas tinham cláusula resolutiva não cumprida — banco rejeitaria o financiamento",
    beneficio: "Regularizou as cláusulas em 15 dias e o crédito foi aprovado sem glosa"
  },
  {
    problema: "Escritório de advocacia analisava ação de usucapião rural",
    descoberta: "Cadeia dominial apontava nulidade na 2ª alienação (venda por procuração inválida)",
    beneficio: "Advogado usou o dossiê como prova técnica e venceu a ação"
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
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-black flex items-center gap-2 text-white">
            <ShieldCheck size={32} className="text-brand-gold" />
            <span className="tracking-tight">AgroLex</span>
          </div>
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
            <div className="md:col-span-3 text-center md:text-left">
              <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full text-brand-gold text-sm font-bold uppercase tracking-widest mb-6">
                <ShieldCheck size={16} />
                Inteligência Fundiária para Decisões Seguras
              </motion.div>

              <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
                Descubra riscos ocultos em uma
                <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold to-yellow-400">
                  propriedade rural
                </span>
                <br/>
                antes que eles virem prejuízo
              </motion.h1>
              <motion.p variants={itemVariants} className="text-lg md:text-xl mb-6 text-gray-300 font-light max-w-2xl leading-relaxed">
                Em 3 minutos, analisamos matrículas, títulos, INCRA, cadeia de proprietários e documentos do imóvel. 
                Você descobre se a propriedade é segura para comprar, vender ou regularizar.
              </motion.p>

              {/* Micro-benefícios */}
              <motion.div variants={itemVariants} className="flex flex-wrap justify-center md:justify-start gap-4 mb-8">
                <span className="inline-flex items-center gap-1.5 text-gray-300 text-sm">
                  <CheckCircle2 size={16} className="text-brand-gold" /> Mais segurança para negociar
                </span>
                <span className="inline-flex items-center gap-1.5 text-gray-300 text-sm">
                  <CheckCircle2 size={16} className="text-brand-gold" /> Identificação de riscos ocultos
                </span>
                <span className="inline-flex items-center gap-1.5 text-gray-300 text-sm">
                  <CheckCircle2 size={16} className="text-brand-gold" /> Relatórios completos e objetivos
                </span>
              </motion.div>
              
              {/* CTAs */}
              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
                <Link href="/cadastro" className="group px-8 py-4 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full text-lg font-bold hover:scale-105 shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center gap-3">
                  Verificar Minha Propriedade
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="#como-funciona" className="px-8 py-4 border border-white/20 rounded-full text-lg font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm">
                  <Eye size={20} /> Ver Como Funciona
                </Link>
              </motion.div>

              {/* Gatilho de urgência */}
              <motion.div variants={itemVariants} className="mt-4">
                <span className="inline-flex items-center gap-2 text-brand-gold/80 text-xs font-bold uppercase tracking-widest">
                  <Clock size={14} /> Análise concluída em até 5 minutos
                </span>
              </motion.div>

              {/* Prova Social — Benefícios verificáveis (substitui métricas fictícias) */}
              <motion.div variants={itemVariants} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-3">
                  <FileSearch size={20} className="text-brand-gold" />
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">Matrículas e títulos</p>
                    <p className="text-gray-400 text-xs">Análise completa de documentos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-3">
                  <GitBranch size={20} className="text-brand-gold" />
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">Cadeia dominial</p>
                    <p className="text-gray-400 text-xs">Rastreamento de proprietários</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-3">
                  <Globe size={20} className="text-brand-gold" />
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">INCRA e origem pública</p>
                    <p className="text-gray-400 text-xs">Cruzamento com bases oficiais</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Coluna direita — Mini Score Flutuante */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2"
            >
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
                    <p className="text-white font-bold text-lg">Score AgroLex</p>
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
                  * Scores demonstrativos. Cada propriedade tem resultado único.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>

      {/* ===== SCORE AGROLEX (P0) ===== */}
      <section id="score" className="py-24 px-4 relative z-10 bg-gradient-to-b from-[#051F15] to-[#03150D]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Índice de Segurança Fundiária</h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                Transformamos documentos complexos em scores simples. Veja como uma análise real funciona:
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
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-4">O que pode estar escondido nos documentos da sua propriedade?</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">
              A documentação de um imóvel rural pode esconder problemas que colocam em risco todo o seu investimento. 
              O AgroLex revela cada um deles.
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold mb-1">Descoberta</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{caso.descoberta}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">Benefício</h4>
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
              { num: "1", icon: <Upload className="text-brand-gold" size={28} />, title: "Envie os documentos", desc: "Matrícula, CCIR, CAR, SIGEF. O sistema aceita qualquer documento do imóvel em PDF.", result: "Upload em segundos" },
              { num: "2", icon: <Layers className="text-brand-gold" size={28} />, title: "O AgroLex cruza os dados", desc: "IA especializada varre cada página, cruza com bases oficiais e identifica riscos ocultos.", result: "Análise em camadas" },
              { num: "3", icon: <FileText className="text-brand-gold" size={28} />, title: "Receba o relatório de risco", desc: "Score de risco, achados críticos e recomendações claras para sua decisão mais segura.", result: "Relatório objetivo" }
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

          {/* Comparativo: Tradicional vs AgroLex */}
          <div className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-3">Por que o AgroLex é diferente</h2>
              <p className="text-gray-500 text-lg max-w-3xl mx-auto">
                Enquanto o método tradicional depende de horas de trabalho manual, o AgroLex entrega resultados em minutos.
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

              {/* AgroLex */}
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
                    <h3 className="text-lg font-bold text-white">AgroLex</h3>
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
                { icone: <Layers size={28} />, titulo: "Análise em camadas", desc: "Da matrícula individual ao cruzamento total com bases oficiais (INCRA, SIGEF, CAR)." },
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
              <div className="text-2xl font-black flex items-center gap-2 text-white mb-4">
                <ShieldCheck size={28} className="text-brand-gold" />
                <span className="tracking-tight">AgroLex</span>
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
                <li>contato@agrolex.com.br</li>
                <li className="pt-4">
                  <span className="inline-flex items-center gap-1.5 text-gray-500 text-xs">
                    <Lock size={12} /> Criptografado TLS 1.3 · LGPD
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-sm text-gray-500 font-medium">© {new Date().getFullYear()} AgroLex Inteligência Fundiária. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}