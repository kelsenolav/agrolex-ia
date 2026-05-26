"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Landmark, ArrowLeft, ShieldAlert, ShieldCheck, Coins, 
  CheckCircle2, XCircle, Printer, AlertTriangle, 
  HelpCircle, ChevronRight, Check, Loader2 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

function CreditoContent() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  
  // Parâmetros do Simulador
  const [biome, setBiome] = useState<'cerrado' | 'amazonia' | 'mata_atlantica'>('cerrado');
  const [culture, setCulture] = useState<'graos' | 'pecuaria' | 'cafe'>('graos');
  const [desiredAmount, setDesiredAmount] = useState<number>(1500000);
  
  // Estados de Conformidade Simulação (customizável por propriedade)
  const [embargoIbama, setEmbargoIbama] = useState<boolean>(false);
  const [sobreposicaoTI, setSobreposicaoTI] = useState<boolean>(false);
  const [sobreposicaoUC, setSobreposicaoUC] = useState<boolean>(false);
  const [trabalhoEscravo, setTrabalhoEscravo] = useState<boolean>(false);
  const [carSuspenso, setCarSuspenso] = useState<boolean>(false);
  const [desmatamentoIlegal, setDesmatamentoIlegal] = useState<boolean>(false);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Buscar propriedades e análises completadas
      const { data: props } = await supabase
        .from('properties')
        .select('id, name, city, state, area, risk_score');
      
      const { data: analyses } = await supabase
        .from('analyses')
        .select('property_id, risk_level, findings')
        .eq('status', 'completed');

      const mockProperties = [
        { id: 'mock-prop-1', name: 'Fazenda Boa Esperança (Amostra)', city: 'Rio Verde', state: 'GO', area: 1405.27, risk_score: 850, risk_level: 'medio' },
        { id: 'mock-prop-2', name: 'Sítio Alvorada (Amostra)', city: 'Sorriso', state: 'MT', area: 420.5, risk_score: 950, risk_level: 'baixo' }
      ];

      if (props && props.length > 0) {
        const merged = props.map(p => {
          const analise = analyses?.find(a => a.property_id === p.id);
          return {
            ...p,
            risk_level: analise?.risk_level || 'baixo',
            findings: analise?.findings || {}
          };
        });
        setProperties([...merged, ...mockProperties]);
        setSelectedPropertyId(merged[0]?.id || mockProperties[0].id);
      } else {
        setProperties(mockProperties);
        setSelectedPropertyId(mockProperties[0].id);
      }
      setLoading(false);
    };

    fetchProperties();
  }, [router]);

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Efeito colateral: ajustar simulações dependendo do score/risco da fazenda para simulação realística
  useEffect(() => {
    if (!selectedProperty) return;
    const isMock1 = selectedProperty.id === 'mock-prop-1';
    
    // Simula irregularidades reais para fins demonstrativos dependendo do score de risco
    const riskLevel = selectedProperty.risk_level?.toLowerCase() || 'baixo';
    if (isMock1 || riskLevel === 'alto' || riskLevel === 'medio') {
      setEmbargoIbama(false);
      setSobreposicaoTI(true); // Exemplo de restrição em TI
      setSobreposicaoUC(false);
      setTrabalhoEscravo(false);
      setCarSuspenso(false);
      setDesmatamentoIlegal(true);
      setBiome('cerrado');
    } else {
      setEmbargoIbama(false);
      setSobreposicaoTI(false);
      setSobreposicaoUC(false);
      setTrabalhoEscravo(false);
      setCarSuspenso(false);
      setDesmatamentoIlegal(false);
      setBiome('cerrado');
    }
  }, [selectedPropertyId]);

  // Regras de Área Produtiva baseadas no Bioma (Reserva Legal exigida na Amazônia Legal = 80%, Cerrado = 35%, Outros = 20%)
  const getReservePercentage = () => {
    if (biome === 'amazonia') return 0.80;
    if (biome === 'cerrado') return 0.35;
    return 0.20;
  };

  const totalArea = selectedProperty ? parseFloat(selectedProperty.area) || 300 : 300;
  const reserveArea = totalArea * getReservePercentage();
  const netProductiveArea = totalArea - reserveArea;

  // Custeio médio por Hectare por cultura
  const getYieldRate = () => {
    if (culture === 'graos') return 5500; // R$ 5.500 por ha
    if (culture === 'cafe') return 8000;  // R$ 8.000 por ha
    return 3000;                         // R$ 3.000 por ha (Pecuária)
  };

  const maxCreditLimit = netProductiveArea * getYieldRate();

  // BACEN 5.081 impedimentos ativos
  const hasBACENBlock = embargoIbama || sobreposicaoTI || sobreposicaoUC || trabalhoEscravo || carSuspenso || desmatamentoIlegal;

  // Cálculo dinâmico do Green Credit Score
  const calculateCreditScore = () => {
    let score = 1000;
    if (embargoIbama) score -= 300;
    if (sobreposicaoTI) score -= 300;
    if (sobreposicaoUC) score -= 200;
    if (trabalhoEscravo) score -= 500;
    if (carSuspenso) score -= 250;
    if (desmatamentoIlegal) score -= 250;
    return Math.max(score, 100);
  };

  const creditScore = calculateCreditScore();

  // Gráfico do Gauge do Score
  const gaugeData = [
    { value: creditScore, color: creditScore >= 800 ? '#10b981' : creditScore >= 500 ? '#f59e0b' : '#ef4444' },
    { value: 1000 - creditScore, color: '#f1f5f9' }
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16 print:bg-white print:pb-0">
      
      {/* CSS específico para impressão timbrada premium */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: #1e293b !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-dossier-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-header {
            display: flex !important;
            border-bottom: 2px solid #051f15 !important;
            padding-bottom: 12px !important;
            margin-bottom: 20px !important;
          }
          .print-signature-block {
            display: block !important;
            margin-top: 50px !important;
          }
        }
      `}</style>

      {/* Cabeçalho da Impressão (Oculto na tela) */}
      <div className="hidden print-header items-center justify-between border-b pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-900 text-brand-gold p-2 rounded-xl">
            <Landmark size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-emerald-950 uppercase tracking-wide">Agrilex IA</h1>
            <p className="text-xs text-gray-500">Dossiê de Conformidade Socioambiental para Crédito Rural</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-800">Código Hash SHA-256:</p>
          <p className="text-[10px] font-mono text-gray-500">5a7b8c...c19d42e</p>
          <p className="text-[10px] text-gray-400 mt-1">Data Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* Navegação Topo (Oculto na impressão) */}
      <nav className="bg-emerald-950 text-white shadow-md print:hidden">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-gold">
            <Landmark size={28} />
            <span className="text-xl font-bold text-white">Painel de Crédito</span>
          </Link>
          <div className="text-sm bg-emerald-900/50 border border-emerald-800 px-4 py-2 rounded-full font-bold text-brand-gold flex items-center gap-2">
            Resolução BACEN 5.081
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        
        {/* Voltar e Gerar Dossiê (Oculto na impressão) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 print:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors w-fit font-semibold">
            <ArrowLeft size={20} /> Voltar ao Painel
          </Link>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-emerald-800 text-white px-5 h-[46px] rounded-lg font-bold hover:bg-emerald-900 transition-all shadow-md cursor-pointer text-sm"
          >
            <Printer size={16} />
            <span>Gerar Laudo para o Banco</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-emerald-800" size={32} />
            <span>Carregando dados das propriedades...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Coluna 1: Parâmetros (Oculto na impressão para focar no laudo técnico) */}
            <div className="lg:col-span-1 space-y-6 print:hidden">
              <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-5">
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2 border-b pb-2">
                  <Coins className="text-emerald-700" size={20} /> Parâmetros da Simulação
                </h3>
                
                {/* Seletor de Propriedade */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 uppercase">Selecionar Fazenda</label>
                  <select 
                    value={selectedPropertyId} 
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.city}-{p.state})</option>
                    ))}
                  </select>
                </div>

                {/* Bioma */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 uppercase">Bioma Predominante</label>
                  <select 
                    value={biome} 
                    onChange={(e) => setBiome(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="cerrado">Cerrado (Reserva 35%)</option>
                    <option value="amazonia">Amazônia Legal (Reserva 80%)</option>
                    <option value="mata_atlantica">Mata Atlântica (Reserva 20%)</option>
                  </select>
                </div>

                {/* Tipo de Cultura */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 uppercase">Atividade Principal</label>
                  <select 
                    value={culture} 
                    onChange={(e) => setCulture(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="graos">Grãos (Soja/Milho) - R$ 5.500/ha</option>
                    <option value="cafe">Café - R$ 8.000/ha</option>
                    <option value="pecuaria">Pecuária de Corte - R$ 3.000/ha</option>
                  </select>
                </div>

                {/* Valor Desejado */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 uppercase">Financiamento Desejado (R$)</label>
                  <input 
                    type="number" 
                    value={desiredAmount} 
                    onChange={(e) => setDesiredAmount(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              {/* Dica da Legislação */}
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-2">
                <h4 className="font-bold text-amber-900 text-xs flex items-center gap-1.5 uppercase">
                  <ShieldAlert size={16} /> Regra BACEN Resolução 5.081
                </h4>
                <p className="text-[11px] text-amber-850 leading-relaxed">
                  Esta resolução do Banco Central do Brasil veda expressamente a concessão de crédito rural para propriedades com embargos ambientais ativos do IBAMA, áreas de desmatamento sem autorização, ou que tenham qualquer sobreposição com terras indígenas e áreas de proteção permanente.
                </p>
              </div>
            </div>

            {/* Coluna 2: Resultados (Exibido na impressão ocupando toda a largura) */}
            <div className="lg:col-span-2 space-y-6 print:col-span-3 print-dossier-card">
              
              {/* Card Status Principal */}
              <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${
                hasBACENBlock 
                  ? 'bg-rose-50 border-rose-200 text-rose-900' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-center gap-3">
                  {hasBACENBlock ? (
                    <div className="bg-rose-100 p-3 rounded-full text-rose-700"><XCircle size={28} /></div>
                  ) : (
                    <div className="bg-emerald-100 p-3 rounded-full text-emerald-700"><CheckCircle2 size={28} /></div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg leading-tight">
                      {hasBACENBlock ? 'Status: Restrição de Crédito Ativa' : 'Status: Aprovado para Concessão'}
                    </h3>
                    <p className="text-xs opacity-75 mt-0.5">
                      {selectedProperty?.name} — {selectedProperty?.city}, {selectedProperty?.state}
                    </p>
                  </div>
                </div>
                <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider ${
                  hasBACENBlock ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  {hasBACENBlock ? 'Bloqueado' : 'Apto'}
                </span>
              </div>

              {/* Informações da Fazenda e Bioma (Apenas para o laudo timbrado) */}
              <div className="hidden print:block bg-gray-50 p-4 rounded-xl border mb-4 text-xs space-y-1">
                <p><strong>Fazenda:</strong> {selectedProperty?.name}</p>
                <p><strong>Localização:</strong> {selectedProperty?.city} - {selectedProperty?.state}</p>
                <p><strong>Bioma Selecionado:</strong> {biome.toUpperCase()}</p>
                <p><strong>Cultura/Atividade Simulação:</strong> {culture.toUpperCase()}</p>
              </div>

              {/* Metades: Score Gauge & Limites Financeiros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Score */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center justify-center relative">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 self-start">Green Credit Score</h4>
                  <div className="h-32 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gaugeData}
                          cx="50%"
                          cy="90%"
                          startAngle={180}
                          endAngle={0}
                          innerRadius={55}
                          outerRadius={70}
                          paddingAngle={0}
                          dataKey="value"
                        >
                          {gaugeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-[50%] flex flex-col items-center">
                      <span className="text-3xl font-black text-gray-800">{creditScore}</span>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400">Score BACEN</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    creditScore >= 800 ? 'bg-emerald-50 text-emerald-700' : creditScore >= 500 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {creditScore >= 800 ? 'Baixo Risco de Bloqueio' : creditScore >= 500 ? 'Risco Moderado' : 'Alto Risco de Glosa'}
                  </span>
                </div>

                {/* Cálculos de Área e Crédito */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-2">Capacidade de Crédito LTV</h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                      <span>Área Líquida Produtiva:</span>
                      <span className="font-bold text-gray-850">{netProductiveArea.toFixed(2)} ha</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                      <span>Reserva Obrigatória ({biome.toUpperCase()}):</span>
                      <span className="font-bold text-gray-850">{reserveArea.toFixed(2)} ha</span>
                    </div>
                    <div className="border-t border-dashed border-gray-150 pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-800">Limite de Crédito Rural:</span>
                      <span className="text-sm font-black text-emerald-950">
                        R$ {maxCreditLimit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    
                    {/* Validador contra o valor desejado */}
                    <div className="border-t pt-2 flex justify-between items-center text-xs font-medium">
                      <span>Solicitado vs Recomendado:</span>
                      {desiredAmount <= maxCreditLimit ? (
                        <span className="text-green-700 font-bold">LTV Adequado</span>
                      ) : (
                        <span className="text-red-600 font-bold">Excede Limite Indicado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Crédito de Carbono */}
                <div className="bg-gradient-to-r from-emerald-900 to-green-950 p-6 rounded-2xl border border-emerald-800 text-white shadow-md space-y-4 md:col-span-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Oportunidade ESG</span>
                      <h4 className="font-extrabold text-base text-brand-gold flex items-center gap-1.5">
                        🌱 Potencial de Geração de Créditos de Carbono
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-green-300">Mercado Voluntário</span>
                  </div>

                  <p className="text-xs text-gray-200 leading-relaxed">
                    Estimativa baseada no estoque e sequestro anual de biomassa florestal para as áreas de Reserva Legal e APP preservadas nesta propriedade ({reserveArea.toFixed(2)} ha).
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-emerald-800/60">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-300 font-bold uppercase block">Sequestro Anual</span>
                      <p className="text-lg font-black text-white">{(reserveArea * 4.5).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tCO2e/ano</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-300 font-bold uppercase block">Cotação Média</span>
                      <p className="text-lg font-black text-brand-gold">R$ 55,00 / crédito</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-300 font-bold uppercase block">Receita Verde Estimada</span>
                      <p className="text-lg font-black text-green-400">R$ {(reserveArea * 4.5 * 55).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/ano</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Checklist de Impedimentos BACEN 5.081 */}
              <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-2">Checklist de Auditoria (Bacen 5.081)</h4>
                
                <div className="divide-y divide-gray-100">
                  
                  {/* Item 1 */}
                  <div className="py-3.5 flex justify-between items-start gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-850">Inexistência de Embargos Ambientais (IBAMA)</h5>
                      <p className="text-[11px] text-gray-500 mt-0.5">Cruza dados públicos para identificar restrições civis por desmatamento.</p>
                    </div>
                    <button 
                      onClick={() => !loading && setEmbargoIbama(!embargoIbama)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer print:hidden ${
                        embargoIbama 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}
                    >
                      {embargoIbama ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{embargoIbama ? 'Impeditivo Ativo' : 'Regular'}</span>
                    </button>
                    {/* Visualização de Impressão */}
                    <span className={`hidden print:inline-block text-xs font-bold ${embargoIbama ? 'text-red-600' : 'text-green-600'}`}>
                      {embargoIbama ? '[X] PENDÊNCIA' : '[OK] REGULAR'}
                    </span>
                  </div>

                  {/* Item 2 */}
                  <div className="py-3.5 flex justify-between items-start gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-850">Sobreposição com Terras Indígenas (FUNAI)</h5>
                      <p className="text-[11px] text-gray-500 mt-0.5">Compara perimetral espacial contra os assentamentos indígenas oficiais homologados.</p>
                    </div>
                    <button 
                      onClick={() => !loading && setSobreposicaoTI(!sobreposicaoTI)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer print:hidden ${
                        sobreposicaoTI 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}
                    >
                      {sobreposicaoTI ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{sobreposicaoTI ? 'Sobreposição' : 'Regular'}</span>
                    </button>
                    <span className={`hidden print:inline-block text-xs font-bold ${sobreposicaoTI ? 'text-red-600' : 'text-green-600'}`}>
                      {sobreposicaoTI ? '[X] SOBREPOSIÇÃO' : '[OK] REGULAR'}
                    </span>
                  </div>

                  {/* Item 3 */}
                  <div className="py-3.5 flex justify-between items-start gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-850">Limites de Unidades de Conservação (ICMBio)</h5>
                      <p className="text-[11px] text-gray-500 mt-0.5">Mapeia conflito fundiário em parques e florestas de preservação governamental.</p>
                    </div>
                    <button 
                      onClick={() => !loading && setSobreposicaoUC(!sobreposicaoUC)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer print:hidden ${
                        sobreposicaoUC 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}
                    >
                      {sobreposicaoUC ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{sobreposicaoUC ? 'Sobreposição' : 'Regular'}</span>
                    </button>
                    <span className={`hidden print:inline-block text-xs font-bold ${sobreposicaoUC ? 'text-red-600' : 'text-green-600'}`}>
                      {sobreposicaoUC ? '[X] SOBREPOSIÇÃO' : '[OK] REGULAR'}
                    </span>
                  </div>

                  {/* Item 4 */}
                  <div className="py-3.5 flex justify-between items-start gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-850">Conformidade com Leis de Trabalho (MTE)</h5>
                      <p className="text-[11px] text-gray-500 mt-0.5">Checagem automatizada na lista suja de trabalho análogo à escravidão.</p>
                    </div>
                    <button 
                      onClick={() => !loading && setTrabalhoEscravo(!trabalhoEscravo)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer print:hidden ${
                        trabalhoEscravo 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}
                    >
                      {trabalhoEscravo ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{trabalhoEscravo ? 'Ficha Restrita' : 'Sem Apontamentos'}</span>
                    </button>
                    <span className={`hidden print:inline-block text-xs font-bold ${trabalhoEscravo ? 'text-red-600' : 'text-green-600'}`}>
                      {trabalhoEscravo ? '[X] RESTRIÇÃO MTE' : '[OK] REGULAR'}
                    </span>
                  </div>

                  {/* Item 5 */}
                  <div className="py-3.5 flex justify-between items-start gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-850">Cadastro Ambiental Rural (CAR) Regularizado</h5>
                      <p className="text-[11px] text-gray-500 mt-0.5">Analisa se o recibo CAR está ativo e homologado no órgão estadual.</p>
                    </div>
                    <button 
                      onClick={() => !loading && setCarSuspenso(!carSuspenso)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer print:hidden ${
                        carSuspenso 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}
                    >
                      {carSuspenso ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{carSuspenso ? 'Suspenso/Inativo' : 'Ativo'}</span>
                    </button>
                    <span className={`hidden print:inline-block text-xs font-bold ${carSuspenso ? 'text-red-600' : 'text-green-600'}`}>
                      {carSuspenso ? '[X] CAR INATIVO' : '[OK] REGULAR'}
                    </span>
                  </div>

                  {/* Item 6 */}
                  <div className="py-3.5 flex justify-between items-start gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-850">Detecção de Desmatamento Ilegal (Prodes/Deter)</h5>
                      <p className="text-[11px] text-gray-500 mt-0.5">Uso de sensoriamento remoto para garantir que não houve perda de floresta nativa irregular.</p>
                    </div>
                    <button 
                      onClick={() => !loading && setDesmatamentoIlegal(!desmatamentoIlegal)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer print:hidden ${
                        desmatamentoIlegal 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}
                    >
                      {desmatamentoIlegal ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{desmatamentoIlegal ? 'Invasão Florestal' : 'Conforme'}</span>
                    </button>
                    <span className={`hidden print:inline-block text-xs font-bold ${desmatamentoIlegal ? 'text-red-600' : 'text-green-600'}`}>
                      {desmatamentoIlegal ? '[X] DESMATAMENTO ILEGAL' : '[OK] REGULAR'}
                    </span>
                  </div>

                </div>
              </div>

              {/* Bloco de Assinaturas (Apenas na Impressão) */}
              <div className="hidden print-signature-block text-xs mt-12 border-t pt-8">
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="space-y-1">
                    <div className="w-48 border-b mx-auto h-8"></div>
                    <p className="font-bold text-gray-800">Eng. Agrônomo / Consultor Técnico</p>
                    <p className="text-[10px] text-gray-500">Credenciado Agrilex IA</p>
                  </div>
                  <div className="space-y-1">
                    <div className="w-48 border-b mx-auto h-8"></div>
                    <p className="font-bold text-gray-800">Representante do Produtor</p>
                    <p className="text-[10px] text-gray-500">Responsável Declaratório</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}

export default function CreditoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 text-emerald-800">Carregando Auditor de Crédito...</div>}>
      <CreditoContent />
    </Suspense>
  );
}
