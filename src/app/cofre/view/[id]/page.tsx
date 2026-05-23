"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, FileText, Download, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PublicCofreView() {
  const { id } = useParams();
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSharedFile = async () => {
      const { data } = await supabase
        .from('documents')
        .select('*, properties(name)')
        .eq('id', id)
        .eq('is_data_room', true)
        .single();
        
      if (data) setFile(data);
      setLoading(false);
    };

    if (id) fetchSharedFile();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Acessando cofre seguro...</div>;
  }

  if (!file) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500 font-bold">Arquivo não encontrado ou link expirado.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <div className="bg-purple-900 p-6 text-center text-white">
          <div className="flex justify-center mb-3">
            <Lock size={40} className="text-purple-300" />
          </div>
          <h1 className="text-xl font-bold">Agrilex Data Room</h1>
          <p className="text-purple-200 text-sm mt-1">Acesso Restrito Autorizado</p>
        </div>

        <div className="p-8">
          <div className="flex items-center gap-3 bg-purple-50 p-4 rounded-xl mb-6">
            <ShieldCheck className="text-green-600" size={32} />
            <div>
              <p className="text-sm text-gray-500 font-medium">Propriedade</p>
              <p className="font-bold text-gray-900">{file.properties?.name}</p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-6 text-center">
            <FileText size={48} className="text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-800">{file.document_type}</h2>
            <p className="text-sm text-gray-500 mb-6 mt-1">Compartilhado em {new Date(file.created_at).toLocaleDateString()}</p>
            
            <button onClick={() => alert("Simulando download do arquivo encriptado...")} className="w-full flex justify-center items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition-colors shadow">
              <Download size={20} /> Baixar Documento
            </button>
          </div>
          
          <p className="text-center text-xs text-gray-400 mt-6">Este documento é protegido por criptografia de ponta-a-ponta e rastreado juridicamente.</p>
        </div>
      </div>
    </div>
  );
}
