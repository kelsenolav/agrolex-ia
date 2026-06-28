"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, ArrowLeft, Plus, MapPin, CheckCircle, ChevronLeft, ChevronRight, Bell, DollarSign, PieChart } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CalendarioPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle do Mês Atual
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Controle do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAmount, setNewTaskAmount] = useState('');
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    const { data: props } = await supabase.from('properties').select('id, name').eq('user_id', session.user.id);
    if (props) setProperties(props);

    const { data } = await supabase
      .from('environmental_tasks')
      .select('*, properties(name)')
      .eq('user_id', session.user.id);

    if (data) setTasks(data);
    setLoading(false);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDayClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDateStr(dateStr);
    setNewTaskTitle('');
    setNewTaskAmount('');
    setIsModalOpen(true);
  };

  const handleSaveTask = async () => {
    if (properties.length === 0) {
      alert("Você precisa cadastrar uma propriedade antes de criar tarefas.");
      return;
    }
    if (!newTaskTitle) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const amountNum = parseFloat(newTaskAmount.replace(',', '.')) || 0;

    const { error } = await supabase.from('environmental_tasks').insert({
      user_id: session.user.id,
      property_id: properties[0].id,
      title: newTaskTitle,
      due_date: selectedDateStr,
      amount: amountNum,
      status: 'Pendente'
    });

    if (error) {
      console.error(error);
      alert("Não foi possível salvar a obrigação agora. Tente novamente em instantes.");
      return;
    }

    setIsModalOpen(false);
    fetchTasks();
    if (notify) {
      // Honestidade (Eixo 4): a obrigação fica registrada na agenda; os lembretes
      // automáticos por e-mail/WhatsApp ainda estão em desenvolvimento.
      alert(`Obrigação "${newTaskTitle}" registrada na sua agenda. Os lembretes automáticos por e-mail/WhatsApp chegam em breve — por ora, acompanhe pelo calendário.`);
    }
  };

  const completeTask = async (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    await supabase.from('environmental_tasks').update({ status: 'Concluído' }).eq('id', id);
    fetchTasks();
  };

  // Renderização do Grid
  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Cálculos Financeiros do Mês Atual
  const currentMonthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const monthTasks = tasks.filter(t => t.due_date.startsWith(currentMonthPrefix));
  
  const totalAmount = monthTasks.reduce((acc, t) => acc + (t.amount || 0), 0);
  const paidAmount = monthTasks.filter(t => t.status === 'Concluído').reduce((acc, t) => acc + (t.amount || 0), 0);
  const pendingAmount = totalAmount - paidAmount;

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-orange-600 text-white shadow-md">
        <div className="container mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-orange-200">
            <CalendarIcon size={28} />
            <span className="text-xl font-bold text-white">Gestão e Calendário Ambiental</span>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-[1400px]">
        <div className="flex justify-between items-center mb-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium">
            <ArrowLeft size={20} /> Voltar ao Painel
          </Link>
        </div>

        {loading ? (
           <div className="text-center py-20 text-gray-500">Montando calendário e fluxo de caixa...</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Esquerda: Grid do Calendário (70%) */}
            <div className="lg:w-3/4 bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b bg-gray-50">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="p-2 border rounded-lg bg-white hover:bg-gray-100 transition-colors"><ChevronLeft /></button>
                  <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-100 font-bold text-gray-700 transition-colors">Hoje</button>
                  <button onClick={nextMonth} className="p-2 border rounded-lg bg-white hover:bg-gray-100 transition-colors"><ChevronRight /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b bg-white text-sm font-bold text-gray-500 uppercase tracking-wider">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} className="p-3 text-center border-r last:border-r-0">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 bg-gray-50 flex-grow">
                {blanks.map(b => (
                  <div key={`blank-${b}`} className="min-h-[140px] p-2 border-r border-b bg-gray-50/50"></div>
                ))}
                {days.map(day => {
                  const dateStr = `${currentMonthPrefix}-${String(day).padStart(2, '0')}`;
                  const dayTasks = tasks.filter(t => t.due_date === dateStr);
                  const isToday = new Date().toISOString().split('T')[0] === dateStr;

                  return (
                    <div key={day} onClick={() => handleDayClick(day)} className={`min-h-[140px] p-2 border-r border-b cursor-pointer transition-colors hover:bg-orange-50 group ${isToday ? 'bg-orange-50/30' : 'bg-white'}`}>
                      <div className="flex justify-between items-start">
                        <span className={`font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-600 text-white' : 'text-gray-700'}`}>{day}</span>
                        <span className="opacity-0 group-hover:opacity-100 text-orange-400"><Plus size={16}/></span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayTasks.map(t => (
                          <div key={t.id} className={`text-[11px] p-1.5 rounded border leading-tight ${t.status === 'Concluído' ? 'bg-green-100 border-green-200 text-green-800' : 'bg-orange-100 border-orange-200 text-orange-800 font-medium shadow-sm'}`}>
                            <div className={`truncate ${t.status === 'Concluído' ? 'line-through' : ''}`}>{t.title}</div>
                            {t.amount > 0 && <div className="font-bold mt-0.5">{formatMoney(t.amount)}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direita: Relatório Resumo Financeiro (30%) */}
            <div className="lg:w-1/4 flex flex-col gap-6">
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4 border-b pb-2">
                  <PieChart className="text-orange-600" size={20} /> Fechamento do Mês
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs text-gray-500 font-bold uppercase">Total Previsto</p>
                    <p className="text-2xl font-bold text-gray-900">{formatMoney(totalAmount)}</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex-1">
                      <p className="text-[10px] text-green-600 font-bold uppercase">Pago</p>
                      <p className="text-lg font-bold text-green-700">{formatMoney(paidAmount)}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex-1">
                      <p className="text-[10px] text-orange-600 font-bold uppercase">Aberto</p>
                      <p className="text-lg font-bold text-orange-700">{formatMoney(pendingAmount)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-grow">
                <h3 className="font-bold text-gray-800 text-lg mb-4">Obrigações em Aberto</h3>
                {monthTasks.filter(t => t.status !== 'Concluído').length === 0 ? (
                  <div className="text-center text-gray-400 py-10 text-sm">
                    Tudo em dia neste mês!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {monthTasks.filter(t => t.status !== 'Concluído')
                      .sort((a,b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                      .map(t => (
                      <div key={t.id} className="border-l-4 border-orange-500 bg-orange-50/30 p-3 rounded-r-lg">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-gray-800 text-sm">{t.title}</p>
                          <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                            Dia {t.due_date.split('-')[2]}
                          </span>
                        </div>
                        <p className="font-bold text-orange-800 mb-2">{formatMoney(t.amount)}</p>
                        <button onClick={(e) => completeTask(t.id, e)} className="w-full text-xs font-bold text-green-700 bg-green-100 border border-green-200 py-1.5 rounded hover:bg-green-200 transition-colors">
                          Marcar como Pago
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </main>

      {/* Modal Add Task */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Nova Obrigação Ambiental</h3>
            <p className="text-sm text-gray-500 mb-4">Agendando para: <strong>{selectedDateStr.split('-').reverse().join('/')}</strong></p>
            
            <label className="block text-sm font-bold text-gray-700 mb-1">Título (Ex: Pagar ITR, Multa)</label>
            <input 
              type="text" 
              placeholder="Digite o título..." 
              className="w-full border p-3 rounded-lg mb-4 bg-gray-50"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
            />

            <label className="block text-sm font-bold text-gray-700 mb-1">Valor (R$)</label>
            <div className="relative mb-4">
              <span className="absolute left-3 top-3 text-gray-500 font-bold">R$</span>
              <input 
                type="number" 
                placeholder="0.00" 
                step="0.01"
                className="w-full border p-3 pl-10 rounded-lg bg-gray-50"
                value={newTaskAmount}
                onChange={e => setNewTaskAmount(e.target.value)}
              />
            </div>

            <div className="bg-orange-50 p-4 rounded-lg mb-6 border border-orange-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="w-5 h-5 text-orange-600 rounded" />
                <div className="flex flex-col">
                  <span className="font-bold text-orange-900 flex items-center gap-1"><Bell size={16}/> Receber Alertas <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full font-bold">EM BREVE</span></span>
                  <span className="text-xs text-orange-700">Avisos automáticos via WhatsApp e E-mail próximos ao vencimento (em desenvolvimento).</span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold transition-colors">Cancelar</button>
              <button onClick={handleSaveTask} className="px-5 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors shadow">Agendar Obrigação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

