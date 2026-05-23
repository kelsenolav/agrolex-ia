"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, ArrowLeft, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function FornecedoresPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (data) setSuppliers(data);
    setLoading(false);
  };

  const handleAddSupplier = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const document = prompt("Digite o CPF ou CNPJ do Fornecedor:");
    if (!document) return;
    
    const name = prompt("Nome ou Razão Social do Fornecedor:");
    if (!name) return;

    // In production, we would call an API route here to fetch real data
    // For this UI, we insert directly and simulate the background check
    const isBlock = document.startsWith('111'); // Regra mockada
    
    await supabase.from('suppliers').insert({
      user_id: session.user.id,
      name,
      document,
      status: isBlock ? 'Bloqueado' : 'Liberado',
      last_check: new Date().toISOString()
    });

    fetchSuppliers();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-blue-900 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-blue-200">
            <Truck size={28} />
            <span className="text-xl font-bold text-white">Cadeia de Fornecedores</span>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex justify-between items-center mb-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium">
            <ArrowLeft size={20} /> Voltar
          </Link>
          <button onClick={handleAddSupplier} className="flex items-center gap-2 bg-blue-700 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-800 transition-all shadow">
            <Plus size={18} /> Adicionar Fornecedor
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[400px]">
          <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Gestão de Risco de Terceiros (ESG)</h2>

          {loading ? (
             <div className="text-center py-10 text-gray-500">Carregando cadeia...</div>
          ) : suppliers.length === 0 ? (
             <div className="text-center py-20 text-gray-400">
               <Truck size={48} className="mx-auto mb-4 opacity-20" />
               <p>Nenhum fornecedor cadastrado.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 text-sm border-b">
                  <tr>
                    <th className="px-4 py-3">Fornecedor</th>
                    <th className="px-4 py-3">CNPJ/CPF</th>
                    <th className="px-4 py-3">Status de Compra</th>
                    <th className="px-4 py-3">Última Checagem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-bold text-gray-800">{s.name}</td>
                      <td className="px-4 py-4 text-gray-600">{s.document}</td>
                      <td className="px-4 py-4">
                        {s.status === 'Liberado' ? (
                          <span className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded w-fit text-sm font-bold"><CheckCircle size={14}/> Liberado</span>
                        ) : s.status === 'Bloqueado' ? (
                          <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded w-fit text-sm font-bold"><XCircle size={14}/> Embargo IBAMA</span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-700 bg-yellow-50 px-2 py-1 rounded w-fit text-sm font-bold"><Clock size={14}/> Pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-sm">
                        {s.last_check ? new Date(s.last_check).toLocaleDateString() : 'Aguardando'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
