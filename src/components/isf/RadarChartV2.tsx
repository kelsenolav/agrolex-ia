"use client";
import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

export interface RadarChartV2Props {
  isfEixos?: {
    REG?: { valor: number; contribuicao: number; teto: number };
    DOM?: { valor: number; contribuicao: number; teto: number };
    LIT?: { valor: number; contribuicao: number; teto: number };
    POS?: { valor: number; contribuicao: number; teto: number };
    FRA?: { valor: number; contribuicao: number; teto: number };
  } | null;
}

const DESCRICAO_EIXOS: Record<string, string> = {
  REG: 'Inconsistências na matrícula, ônus, penhoras ou bloqueios judiciais.',
  DOM: 'Problemas de cadeia dominial, quebras de continuidade ou lacunas temporais.',
  LIT: 'Disputas judiciais, processos cíveis, trabalhistas ou execuções fiscais.',
  POS: 'Risco de invasões, ocupações irregulares ou problemas de demarcação.',
  FRA: 'Indícios de fraudes documentais, grilagem ou falsificações.',
};

const CustomTooltip = ({ active, payload, radarColor }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl border border-gray-150 shadow-lg max-w-xs">
        <p className="font-extrabold text-gray-900 text-sm">{dataPoint.subject}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{DESCRICAO_EIXOS[dataPoint.code]}</p>
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-between items-center">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Grau de Risco:</span>
          <span className="text-sm font-black" style={{ color: radarColor }}>{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

// Componente encapsulado em React.memo para evitar re-renderizações desnecessárias
const RadarChartV2 = React.memo(function RadarChartV2({ isfEixos }: RadarChartV2Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[320px] w-full animate-pulse bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center">
        <span className="text-sm text-gray-400">Carregando gráfico...</span>
      </div>
    );
  }

  // Sanitização Robusta de Dados: Garante fallback seguro de 0% se eixos estiverem malformados ou incompletos
  const sanitizeAxis = (axisKey: 'REG' | 'DOM' | 'LIT' | 'POS' | 'FRA') => {
    const eixoData = isfEixos?.[axisKey];
    const valor = typeof eixoData?.valor === 'number' ? eixoData.valor : 0;
    const teto = typeof eixoData?.teto === 'number' && eixoData.teto > 0 ? eixoData.teto : 80;
    return Math.max(0, Math.min(100, Math.round((valor / teto) * 100)));
  };

  const data = [
    { subject: 'Registral (REG)', valor: sanitizeAxis('REG'), code: 'REG' },
    { subject: 'Dominial (DOM)', valor: sanitizeAxis('DOM'), code: 'DOM' },
    { subject: 'Litígio (LIT)', valor: sanitizeAxis('LIT'), code: 'LIT' },
    { subject: 'Possessório (POS)', valor: sanitizeAxis('POS'), code: 'POS' },
    { subject: 'Fraude (FRA)', valor: sanitizeAxis('FRA'), code: 'FRA' },
  ];

  // Determinar a cor principal do radar com base no maior risco encontrado
  const maxRisco = Math.max(...data.map(d => d.valor));
  let radarColor = '#10B981'; // Seguro (Verde)
  if (maxRisco >= 70) {
    radarColor = '#DC2626'; // Crítico (Vermelho)
  } else if (maxRisco >= 50) {
    radarColor = '#F97316'; // Alto Risco (Laranja)
  } else if (maxRisco >= 25) {
    radarColor = '#F59E0B'; // Atenção (Amarelo)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm print:shadow-none print:border h-[350px] flex flex-col justify-between"
    >
      <div className="flex-1 min-h-0 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#374151', fontSize: 11, fontWeight: 'bold' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name="Risco de Eixo"
              dataKey="valor"
              stroke={radarColor}
              fill={radarColor}
              fillOpacity={0.25}
            />
            <Tooltip content={<CustomTooltip radarColor={radarColor} />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-gray-400 text-center font-medium mt-2">
        Passe o mouse sobre os eixos para ver o detalhamento do risco.
      </div>
    </motion.div>
  );
});

export default RadarChartV2;
