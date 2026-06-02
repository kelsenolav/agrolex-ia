import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgroLex | Inteligência Artificial para o Agronegócio",
  description: "Análise fundiária e documental com Inteligência Artificial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
