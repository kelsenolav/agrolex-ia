"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Consolidação (Eixo 4): a antiga "Torre de Controle" do /dashboard/admin era um
// protótipo simulado — leads hardcoded, export/refresh fake e a checagem nem
// validava role de admin. O painel comercial REAL (dados via /api/marketing/leads,
// KPIs e gate de admin) vive em /dashboard/leads. Esta rota agora apenas redireciona,
// eliminando a duplicidade/fachada.
export default function AdminRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/leads');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 font-medium">Redirecionando para o Painel Comercial…</p>
    </div>
  );
}
