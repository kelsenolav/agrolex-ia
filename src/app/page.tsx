"use client";

import Link from 'next/link';
import { ShieldCheck, FileText, TrendingUp, ArrowRight, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen text-white selection:bg-brand-gold selection:text-brand-dark overflow-hidden relative">
      {/* Background Decorators */}
      <div 
        className="absolute top-0 left-0 w-full h-full bg-cover bg-center bg-no-repeat fixed"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')", zIndex: -20 }}
      ></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#051F15]/40 via-[#051F15]/60 to-[#051F15]/90 fixed pointer-events-none" style={{ zIndex: -10 }}></div>

      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-[#051F15]/70 border-b border-white/10"
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-black flex items-center gap-2 text-white">
            <ShieldCheck size={32} className="text-brand-gold" />
            <span className="tracking-tight">Agrilex</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <Link href="#recursos" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">RECURSOS</Link>
            <Link href="#planos" className="text-gray-300 hover:text-brand-gold transition-colors font-medium text-sm tracking-wide">PLANOS</Link>
          </nav>
          <div className="flex gap-4">
            <Link href="/login" className="px-5 py-2 text-gray-300 hover:text-white transition-all font-semibold text-sm flex items-center gap-2">
              <Lock size={16} /> Entrar
            </Link>
            <Link href="/cadastro" className="px-5 py-2 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark rounded-full hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all font-bold text-sm">
              Começar Análise
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <main className="pt-32 pb-24 px-4 relative">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="container mx-auto text-center max-w-5xl relative z-10 mt-10 md:mt-20"
        >
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold mb-8 leading-tight tracking-tight">
            Inteligência Artificial para <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold to-yellow-400">
              Segurança Fundiária.
            </span>
          </motion.h1>
          <motion.p variants={itemVariants} className="text-lg md:text-2xl mb-12 text-gray-400 font-light max-w-3xl mx-auto leading-relaxed">
            Automatize a auditoria jurídica agrária. Cruze matrículas, processos e o SIGEF em segundos utilizando a IA mais avançada do mercado.
          </motion.p>
          
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/cadastro" className="group px-8 py-4 bg-white text-[#051F15] rounded-full text-lg font-bold hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all flex items-center justify-center gap-3">
              Fazer Primeira Análise
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#planos" className="px-8 py-4 border border-white/20 rounded-full text-lg font-bold hover:bg-white/5 transition-colors flex items-center justify-center backdrop-blur-sm">
              Agendar Demonstração
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-16 flex justify-center gap-8 text-gray-500 text-sm font-medium">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-brand-gold"/> Análise em Camadas</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-brand-gold"/> Integração INCRA/SIGEF</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-brand-gold"/> Alertas de Grilagem</div>
          </motion.div>
        </motion.div>
      </main>

      {/* Features Section */}
      <section id="recursos" className="py-24 px-4 relative z-10">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Arquitetura de Análise Profunda</h2>
            <p className="text-gray-400 text-lg">Nosso motor de IA processa centenas de páginas extraindo o que olhos humanos deixam passar.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <FileText size={32} className="text-brand-gold" />,
                title: "Extração Avançada",
                desc: "Upload direto de PDFs longos de matrículas e processos. A IA lê e estrutura a cadeia dominial instantaneamente."
              },
              {
                icon: <ShieldCheck size={32} className="text-brand-gold" />,
                title: "Auditoria Forense",
                desc: "Mapeamento de nulidades absolutas, simulações, sobreposições de área e quebra de cláusulas resolutivas."
              },
              {
                icon: <TrendingUp size={32} className="text-brand-gold" />,
                title: "Parecer Executivo",
                desc: "Geração de peças jurídicas prontas para uso, classificando o risco da propriedade com embasamento legal."
              }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="bg-white/5 backdrop-blur-lg border border-white/10 p-10 rounded-3xl hover:bg-white/10 transition-colors group cursor-default"
              >
                <div className="bg-brand-gold/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona Section */}
      <section className="py-24 px-4 relative z-10 bg-[#03150D]">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Como Funciona em 3 Passos</h2>
            <p className="text-gray-400 text-lg">Do upload do documento ao laudo pericial gerado por IA.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent"></div>
            {[
              { num: "1", title: "Upload Seguro", desc: "Envie os PDFs ou fotos das matrículas e processos. Seus dados são protegidos com criptografia bancária." },
              { num: "2", title: "Processamento e Pix", desc: "A inteligência calcula o esforço e gera um pagamento transparente. Após a confirmação, o motor é acionado." },
              { num: "3", title: "Emissão do Laudo", desc: "Receba um parecer em PDF formatado no padrão Big4, com todos os cruzamentos e alertas de risco." }
            ].map((step, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-[#051F15] border-2 border-brand-gold flex items-center justify-center text-3xl font-black text-brand-gold mb-6 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                  {step.num}
                </div>
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed max-w-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-4 relative z-10">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Dúvidas Frequentes</h2>
          </div>
          <div className="space-y-6">
            {[
              { q: "O Agrilex substitui um advogado ou perito agrário?", a: "Não. A IA atua como uma ferramenta de alta velocidade para acelerar em 90% a triagem documental, revelando inconsistências de forma automática. A decisão final é sempre estratégica e humana." },
              { q: "Quais documentos a plataforma consegue ler?", a: "Nossa tecnologia de Visão Computacional (Gemini 3.5) é capaz de ler Certidões de Matrícula (mesmo digitalizadas/escaneadas), CCIR, CAR, SIGEF e petições iniciais." },
              { q: "A plataforma salva os meus documentos?", a: "Nós armazenamos temporariamente para a análise, de forma criptografada. Você tem a opção de excluir permanentemente o laudo e os arquivos do nosso banco de dados a qualquer momento." },
              { q: "O relatório gerado é válido juridicamente?", a: "O laudo em PDF é um documento técnico-analítico formidável para uso interno e base para peças processuais, mas não possui fé pública como uma assinatura de um perito nomeado." }
            ].map((faq, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-3">
                  <span className="text-brand-gold">Q.</span> {faq.q}
                </h3>
                <p className="text-gray-400 leading-relaxed pl-8">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/40 pt-16 pb-8 z-10 relative">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-black flex items-center gap-2 text-white">
            <ShieldCheck size={28} className="text-brand-gold" />
            <span className="tracking-tight">Agrilex</span>
          </div>
          <p className="text-sm text-gray-500 font-medium">© {new Date().getFullYear()} Agrilex. A tecnologia que o agronegócio brasileiro confia.</p>
        </div>
      </footer>
    </div>
  );
}
