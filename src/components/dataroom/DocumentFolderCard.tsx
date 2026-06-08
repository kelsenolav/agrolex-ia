"use client";

import React from 'react';
import { Folder, ArrowRight } from 'lucide-react';

export interface DocumentFolderCardProps {
  title: string;
  description: string;
  fileCount: number;
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
  lastUpdated: string;
  onClick?: () => void;
}

export default function DocumentFolderCard({
  title,
  description,
  fileCount,
  riskLevel,
  lastUpdated,
  onClick
}: DocumentFolderCardProps) {
  const getRiskColors = (level: typeof riskLevel) => {
    switch (level) {
      case 'Crítico':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500'
        };
      case 'Alto':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500'
        };
      case 'Médio':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500'
        };
      case 'Baixo':
        default:
          return {
            bg: 'bg-green-50 text-green-700 border-green-200',
            dot: 'bg-green-500'
          };
    }
  };

  const colors = getRiskColors(riskLevel);

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-brand-gold/30 transition-all cursor-pointer group flex flex-col justify-between h-full"
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-brand-green/5 text-brand-green rounded-xl group-hover:bg-brand-green group-hover:text-white transition-colors duration-300">
            <Folder size={24} />
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors.bg} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            Risco {riskLevel}
          </span>
        </div>

        <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-brand-green transition-colors">
          {title}
        </h3>
        <p className="text-gray-500 text-sm mb-4 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-xs">
        <div className="text-gray-400">
          <span className="font-extrabold text-gray-700">{fileCount}</span> {fileCount === 1 ? 'documento' : 'documentos'}
        </div>
        <div className="text-gray-400">
          Atualizado em: <span className="font-semibold text-gray-600">{lastUpdated}</span>
        </div>
      </div>
      
      <div className="mt-3 flex items-center gap-1 text-xs text-brand-gold font-bold self-end group-hover:translate-x-1 transition-transform">
        Explorar Pasta <ArrowRight size={14} />
      </div>
    </div>
  );
}
