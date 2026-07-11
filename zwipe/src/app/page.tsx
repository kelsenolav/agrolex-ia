import Link from 'next/link';
import { Flame, Heart, MessageCircle, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2 text-brand-pink">
          <Flame size={28} fill="currentColor" />
          <span className="text-xl font-black tracking-tight">Zwipe</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="text-sm font-bold bg-brand-pink px-4 py-2 rounded-full hover:brightness-110 transition-all"
          >
            Criar conta
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 flex flex-col items-center text-center justify-center gap-8 py-16">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-pink bg-brand-pink/10 border border-brand-pink/30 rounded-full px-4 py-1.5">
          Compra e venda com swipe
        </span>

        <h1 className="text-4xl md:text-6xl font-black leading-tight max-w-3xl">
          Deu <span className="text-brand-pink">match</span>, fechou negócio.
        </h1>

        <p className="text-lg text-white/60 max-w-xl">
          Anuncie qualquer coisa — casa, carro, equipamento, o que for. Quem quiser compra dá um
          swipe. Quando os dois lados topam, o Zwipe libera o contato direto no WhatsApp.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/cadastro"
            className="bg-brand-pink text-white font-black px-8 py-4 rounded-full hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-pink/20"
          >
            Começar agora
          </Link>
          <Link
            href="/login"
            className="border border-white/20 text-white font-bold px-8 py-4 rounded-full hover:bg-white/5 transition-all"
          >
            Já tenho conta
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full max-w-4xl">
          <FeatureCard
            icon={<Sparkles className="text-brand-pink" size={24} />}
            title="Anuncie em segundos"
            description="Foto, título, preço e categoria. Seu anúncio já entra no feed de quem procura."
          />
          <FeatureCard
            icon={<Heart className="text-brand-pink" size={24} fill="currentColor" />}
            title="Swipe duplo"
            description="Comprador curte o anúncio, vendedor aceita o comprador. Só vira match com os dois lados de acordo."
          />
          <FeatureCard
            icon={<MessageCircle className="text-brand-pink" size={24} />}
            title="Negocie direto"
            description="Deu match, o contato do WhatsApp é liberado na hora para fechar o negócio."
          />
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-xs text-white/30">
        Zwipe — compra e venda com swipe.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#151521] border border-white/10 rounded-2xl p-6 text-left space-y-3">
      <div className="w-11 h-11 rounded-xl bg-brand-pink/10 flex items-center justify-center">{icon}</div>
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-white/50">{description}</p>
    </div>
  );
}
