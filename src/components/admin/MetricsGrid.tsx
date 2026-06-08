"use client";

import React from 'react';
import { Users, Hourglass, Percent, FileText, ArrowUpRight, TrendingUp } from 'lucide-react';

export interface CommercialMetric {
  id: string;
  label: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
  colorClass: string;
}

export default function MetricsGrid() {
  const metrics: CommercialMetric[] = [
    {
      id: 'leads',
      label: 'Total de Leads Captados',
      value: '1,248',
      change: '+12.5% esta semana',
      isPositive: true,
      icon: <Users className="text-emerald-600" size={24} />,
      colorClass: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50',
    },
    {
      id: 'trial',
      label: 'Usuários em Regime Trial',
      value: '382',
      change: '42 novos hoje',
      isPositive: true,
      icon: <Hourglass className="text-amber-600 animate-spin-slow" size={24} />,
      colorClass: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50',
    },
    {
      id: 'conversion',
      label: 'Taxa de Conversão em Vendas',
      value: '18.4%',
      change: '+2.1% vs mês anterior',
      isPositive: true,
      icon: <Percent className="text-brand-green" size={24} />,
      colorClass: 'border-brand-green/20 bg-brand-green/5 hover:bg-brand-green/10',
    },
    {
      id: 'pages',
      label: 'Volume de Páginas Processadas',
      value: '142,520',
      change: '+8.4% de uso diário',
      isPositive: true,
      icon: <FileText className="text-blue-600" size={24} />,
      colorClass: 'border-blue-200 bg-blue-50/50 hover:bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric) => (
        <div
          key={metric.id}
          className={`border rounded-2xl p-6 transition-all duration-300 hover:shadow-md flex flex-col justify-between ${metric.colorClass}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
              {metric.icon}
            </div>
            <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${
              metric.isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <TrendingUp size={12} />
              {metric.change.split(' ')[0]}
            </span>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              {metric.label}
            </span>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-extrabold text-gray-800 tracking-tight">
                {metric.value}
              </h3>
            </div>
            <p className="text-[11px] font-medium text-gray-500 mt-2">
              {metric.change}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
