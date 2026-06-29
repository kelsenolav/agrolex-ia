"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Consolidação (Eixo 3): o /dashboard/dataroom era um mock (documentos hardcoded,
// upload simulado). O Data Room REAL (Supabase Storage: upload, download e
// compartilhamento por link seguro temporário) vive em /dashboard/cofre.
// Esta rota agora apenas redireciona, eliminando a duplicidade/fachada.
export default function DataRoomRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/cofre');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 font-medium">Abrindo o Data Room…</p>
    </div>
  );
}
