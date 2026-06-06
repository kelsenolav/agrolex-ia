"use client";

import Link from 'next/link';
import { ShieldCheck, FileText, TrendingUp, ArrowRight, CheckCircle2, ChevronRight, Lock, AlertTriangle, MapPin, Clock, Users, BarChart3, Search, Scale, Landmark, ChevronDown, Upload } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { useState } from 'react';

const faqData = [
  {
    q: "O AgroLex substitui um advogado ou perito agrário?",
    a: "Não. A IA atua como uma ferramenta de alta velocidade para acelerar em 90% a triagem documental, revelando inconsistências de forma automática. A decisão final é sempre estratégica e humana."
  },
  {
    q: "Quais documentos a plataforma consegue ler?",
    a: "Nossa tecnologia de Visão Computacional é capaz de ler Certidões de Matrícula (mesmo digitalizadas/escaneadas), CCIR, CAR, SIGEF e petições iniciais."
  },
  {
    q: "A plataforma salva os meus documentos?",
    a: "Armazenamos temporariamente para a análise, de forma criptografada. Você tem a opção de excluir permanentemente o laudo e os arquivos do nosso banco de dados a qualquer momento."
  },
  {
    q: "O relatório gerado é válido juridicamente?",
    a: "O dossiê técnico em PDF é um documento técnico-analítico formidável para uso interno e base para peças processuais, mas não possui fé pública como uma assinatura de um perito nomeado."
  },
  {
    q: "Quanto tempo leva uma auditoria completa?",
    a: "Uma auditoria padrão é concluída em 2 a 5 minutos para documentos digitalizados. Matrículas complexas ou com grande volume de páginas podem levar até 10 minutos."
  },
  {
    q: "O AgroLex atende qualquer região do Brasil?",
    a: "Sim. O sistema foi treinado com legislação e normativas de todos os estados brasileiros, incluindo as particularidades dos cartórios de registro de imóveis."
  },
  {
    q: "Posso auditar múltiplas matrículas de uma só vez?",
    a: "Sim. Você pode enviar até 10 documentos por análise, incluindo matrículas, CCIR, CAR e SIGEF. O motor de IA processa tudo simultaneamente e gera um dossiê consolidado."
  },
  {
    q: "Como funciona a privacidade dos meus dados?",
    a: "Seguimos rigorosamente a LGPD. Todos os documentos são criptografados em trânsito (TLS 1.3) e em repouso (AES-256). Você pode solicitar a exclusão permanente a qualquer momento."
  }
];

const riscos = [
  { icone: <Search size={24} />, titulo: "Grilagem e Ocupação Irregular", desc: "Identificação de registros com indícios de grilagem, sobreposição com terras públicas e ocupação desordenada." },
  { icone: <Scale size={24} />, titulo: "Nulidades Registrais", desc: "Detecção de vícios formais na cadeia dominial, cláusulas resolutivas quebradas e alienações irregulares." },
  { icone: <AlertTriangle size={24} />, titulo: "Sobreposição de Áreas", desc: "Cruzamento automático com bases oficiais (INCRA, SIGEF, CAR) para identificar conflitos fundiários." },
  { icone: <Landmark size={24} />, titulo: "Fraudes Documentais", desc: "Análise de autenticidade de certidões, assinaturas digitais e conformidade com normas cartoriais." },
];

const diferenciais = [
  { titulo: "Especialização em Direito Registral Brasileiro", desc: "IA treinada especificamente com legislação, jurisprudência e normativas do direito imobiliário rural brasileiro." },
  { titulo: "Análise em Camadas Progressivas", desc: "Da matrícula individual ao cruzamento total de bases oficiais. Profundidade ajustável ao nível de risco do imóvel." },
  { titulo: "Integração com Bases Oficiais", desc: "Cruzamento automático com INCRA, SIGEF, CAR e bases cartoriais para validação de informações registrais." },
  { titulo: "Confidencialidade e Proteção de Dados", desc: "Criptografia ponta-a-ponta, conformidade com a LGPD e política de exclusão permanente sob demanda." },
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
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')", zIndex: -20 }}
      ></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#051F15]/50 via-[#051F15]/75 to-[#051F15]/95 fixed pointer-events-none" style={{ zIndex: -10 }}></div>

      {/* Header */}
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
            <Link href="#porque" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">POR QUE AGROLEX</Link>
            <Link href="#riscos" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">RISCOS</Link>
            <Link href="#como-funciona" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">COMO FUNCIONA</Link>
            <Link href="#faq" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">FAQ</Link>
          </nav>
          <div className="flex gap-4">
            <Link href="/login" className="px-5 py-2 text-gray-300 hover:text-white transition-all font-semibold text-sm flex items-center gap-2">
              <Lock size={16} /> Entrar
            </Link>
            <Link href="/cadastro" className="px-5 py-2 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all font-bold text-sm">
              Solicitar Auditoria
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero Section Premium */}
      <main className="pt-32 pb-24 px-4 relative">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="container mx-auto text-center max-w-5xl relative z-10 mt-10 md:mt-20"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full text-brand-gold text-xs font-bold uppercase tracking-widest mb-8">
            <ShieldCheck size={14} />
            Auditoria Fundiária com Inteligência Artificial
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold mb-8 leading-tight tracking-tight">
            Proteção Patrimonial e <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold to-yellow-400">
              Segurança Jurídica
            </span>
            <br/>para o Agronegócio
          </motion.h1>
          <motion.p variants={itemVariants} className="text-lg md:text-2xl mb-12 text-gray-300 font-light max-w-4xl mx-auto leading-relaxed">
            Auditoria fundiária automatizada com inteligência artificial especializada em direito registral imobiliário. 
            Identifique riscos ocultos em matrículas antes de fechar qualquer negócio.
          </motion.p>
          
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/cadastro" className="group px-8 py-4 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full text-lg font-bold hover:scale-105 shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center gap-3">
              Solicitar Auditoria Gratuita
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#como-funciona" className="px-8 py-4 border border-white/20 rounded-full text-lg font-bold hover:bg-white/5 transition-colors flex items-center justify-center backdrop-blur-sm">
              Ver Como Funciona
            </Link>
          </motion.div>

          {/* Prova Social - Selos de Confiança */}
          <motion.div variants={itemVariants} className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-3">
              <MapPin size={20} className="text-brand-gold" />
              <div className="text-left">
                <p className="text-white font-bold text-lg">+500</p>
                <p className="text-gray-400 text-xs font-medium">Propriedades Auditadas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-3">
              <BarChart3 size={20} className="text-brand-gold" />
              <div className="text-left">
                <p className="text-white font-bold text-lg">98%</p>
                <p className="text-gray-400 text-xs font-medium">Assertividade nos Achados</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-3">
              <Users size={20} className="text-brand-gold" />
              <div className="text-left">
                <p className="text-white font-bold text-lg">+40.000 ha</p>
                <p className="text-gray-400 text-xs font-medium">Hectares Analisados</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Seção: Por que o AgroLex */}
      <section id="porque" className="py-24 px-4 relative z-10 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-4">Por que o AgroLex</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">
              Cada transação imobiliária rural esconde riscos registrais que podem custar milhões. 
              O AgroLex foi construído para eliminar essas incertezas.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} />
                O Problema
              </h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>50% dos imóveis rurais no Brasil possuem alguma irregularidade registral</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Análise manual de matrículas leva semanas e custa caro</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Grilagem, fraudes e sobreposições são detectadas tarde demais</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Due diligence tradicional não escala para portfólios grandes</span>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-brand-green to-[#052e1f] rounded-2xl p-8 text-white shadow-lg">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-brand-gold" size={24} />
                A Solução AgroLex
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                  <span>Elimine semanas de análise documental manual com IA especializada</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                  <span>Identifique riscos ocultos que nenhum outro método detecta</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                  <span>Receba dossiês técnicos prontos para embasar decisões estratégicas</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                  <span>Proteja seu patrimônio com auditoria completa em minutos</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Seção: Riscos que Identificamos */}
      <section id="riscos" className="py-24 px-4 relative z-10 bg-[#03150D]">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Riscos que Identificamos</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Nosso motor de auditoria varre centenas de páginas em busca de cada vulnerabilidade registral.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {riscos.map((risco, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all"
              >
                <div className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center mb-6 text-red-400">
                  {risco.icone}
                </div>
                <h3 className="text-lg font-bold mb-3">{risco.titulo}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{risco.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção: Diferenciais */}
      <section className="py-24 px-4 relative z-10 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-4">Nossos Diferenciais</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">
              Não somos mais uma IA genérica. Somos a única plataforma especializada em direito registral brasileiro.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {diferenciais.map((dif, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-5 p-6 rounded-2xl border border-gray-100 hover:border-brand-gold/30 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-brand-gold/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                  <CheckCircle2 size={24} className="text-brand-gold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-dark mb-2">{dif.titulo}</h3>
                  <p className="text-gray-500 leading-relaxed">{dif.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção: Como Funciona */}
      <section id="como-funciona" className="py-24 px-4 relative z-10 bg-[#03150D]">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Como Funciona</h2>
            <p className="text-gray-400 text-lg">Três passos para sua auditoria fundiária completa.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent"></div>
            {[
              { num: "1", icon: <Upload className="text-brand-gold" size={32} />, title: "Upload dos Documentos", desc: "Envie matrículas, CCIR, CAR e SIGEF em PDF. O sistema aceita documentos digitalizados e escaneados." },
              { num: "2", icon: <BarChart3 className="text-brand-gold" size={32} />, title: "IA Analisa em Camadas", desc: "O motor de IA processa em profundidade progressiva: da matrícula individual ao cruzamento com bases oficiais." },
              { num: "3", icon: <FileText className="text-brand-gold" size={32} />, title: "Dossiê Técnico Completo", desc: "Receba um parecer técnico-executivo com score de risco, achados críticos, matriz de risco e recomendações." }
            ].map((step, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-[#051F15] border-2 border-brand-gold flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                  <span className="text-3xl font-black text-brand-gold">{step.num}</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed max-w-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção: Quem Utiliza */}
      <section className="py-24 px-4 relative z-10 bg-white">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-4">Quem Utiliza o AgroLex</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">
              De advogados a pecuaristas, o AgroLex é a ferramenta de inteligência fundiária para profissionais que exigem segurança.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { titulo: "Advogados e Escritórios Jurídicos", desc: "Due diligence imobiliária, análise de matrículas para ações possessórias, usucapião e litígios fundiários." },
              { titulo: "Produtores Rurais e Pecuaristas", desc: "Verificação de segurança registral antes de adquirir ou arrendar imóveis rurais." },
              { titulo: "Corretores e Incorporadores", desc: "Análise de portfólios completos para identificar riscos ocultos em negociações." },
            ].map((quem, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all"
              >
                <h3 className="text-lg font-bold text-brand-dark mb-3">{quem.titulo}</h3>
                <p className="text-gray-500 leading-relaxed">{quem.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção: Perguntas Frequentes */}
      <section id="faq" className="py-24 px-4 relative z-10 bg-[#03150D]">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Perguntas Frequentes</h2>
            <p className="text-gray-400 text-lg">Tire suas dúvidas sobre auditoria fundiária com IA.</p>
          </div>
          <div className="space-y-3">
            {faqData.map((faq, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <h3 className="text-base font-bold text-white flex items-center gap-3">
                    <span className="text-brand-gold text-sm">Q.</span> {faq.q}
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

      {/* CTA Final */}
      <section className="py-24 px-4 relative z-10 bg-gradient-to-br from-brand-green to-[#052e1f]">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Proteja seu Patrimônio</h2>
          <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
            Solicite sua auditoria gratuita agora e descubra riscos ocultos nas suas matrículas antes que eles se tornem problemas.
          </p>
          <Link
            href="/cadastro"
            className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full text-xl font-bold hover:scale-105 shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all"
          >
            Solicitar Auditoria Gratuita
            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer Premium */}
      <footer className="border-t border-white/10 bg-black/60 pt-16 pb-8 z-10 relative">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-10 mb-12">
            <div>
              <div className="text-2xl font-black flex items-center gap-2 text-white mb-4">
                <ShieldCheck size={28} className="text-brand-gold" />
                <span className="tracking-tight">AgroLex</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Inteligência Artificial especializada em direito registral imobiliário. Auditoria fundiária automatizada para proteção patrimonial do agronegócio brasileiro.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Plataforma</h4>
              <ul className="space-y-2">
                <li><Link href="#porque" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Por que AgroLex</Link></li>
                <li><Link href="#como-funciona" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Como Funciona</Link></li>
                <li><Link href="/login" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Acessar Plataforma</Link></li>
                <li><Link href="/cadastro" className="text-gray-500 hover:text-brand-gold text-sm transition-colors">Criar Conta</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Contato</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li>contato@agrolex.com.br</li>
                <li>CNPJ: XX.XXX.XXX/XXXX-XX</li>
                <li className="text-gray-600 mt-4 text-xs">Este documento é confidencial e de uso interno.</li>
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

