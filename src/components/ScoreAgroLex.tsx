"use client";

import { calcularScoreAgroLex, type ScoreAgroLexData, type AnalysisFindings } from '@/types/analise';
import { ShieldCheck } from 'lucide-react';

interface ScoreAgroLexProps {
  findings?: AnalysisFindings | null;
  riskLevel?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showTitle?: boolean;
  /** Score ISF numérico. Se fornecido, toda a classificação é derivada dele como fonte única de verdade. */
  overriddenScore?: number | null;
  /** Versão do motor ISF ('2.1' ou '2.2'). Determina a taxonomia de classificação. */
  isfVersion?: number | string | null;
}

export default function ScoreAgroLex({ findings, riskLevel, overriddenScore, isfVersion, size = 'md', showTitle = true }: ScoreAgroLexProps) {
  const data: ScoreAgroLexData = calcularScoreAgroLex(findings, riskLevel, overriddenScore, isfVersion);

  const sizeMap = {
    sm: { gauge: 80, font: 'text-xl', sub: 'text-[10px]', label: 'text-xs' },
    md: { gauge: 120, font: 'text-3xl', sub: 'text-xs', label: 'text-sm' },
    lg: { gauge: 160, font: 'text-5xl', sub: 'text-sm', label: 'text-base' },
  };

  const s = sizeMap[size];

  // SVG Arc Gauge (270 degrees)
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const offset = circumference * 0.125; // start at bottom
  const progress = data.score / 100;
  const dashOffset = offset + arcLength * (1 - progress);

  // Marker positions for scale
  const centerX = 50;
  const centerY = 50;

  return (
    <div className={`flex flex-col items-center ${size === 'sm' ? 'gap-1' : 'gap-2'}`}>
      {showTitle && (
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={size === 'sm' ? 14 : 18} className="text-brand-gold" />
          <span className={`font-bold text-gray-700 ${s.label}`}>Índice de Segurança Fundiária</span>
        </div>
      )}

      {/* Gauge SVG */}
      <div className="relative" style={{ width: s.gauge + 40, height: s.gauge / 2 + 30 }}>
        <svg width={s.gauge + 40} height={s.gauge / 2 + 30} viewBox="0 0 100 65" className="overflow-visible">
          {/* Background arc */}
          <path
            d="M 15 50 A 35 35 0 0 1 85 50"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d="M 15 50 A 35 35 0 0 1 85 50"
            fill="none"
            stroke={data.cor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
          {/* Scale markers */}
          <text x="15" y="60" fontSize="6" fill="#9CA3AF" fontWeight="bold">0</text>
          <text x="43" y="60" fontSize="6" fill="#9CA3AF" fontWeight="bold">40</text>
          <text x="72" y="60" fontSize="6" fill="#9CA3AF" fontWeight="bold">70</text>
          <text x="90" y="60" fontSize="6" fill="#9CA3AF" fontWeight="bold">100</text>
        </svg>

        {/* Score number overlay — posicionado na área livre do semicírculo, sem tocar o arco */}
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{
            top: '77%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: s.gauge * 0.55,
            height: s.gauge * 0.55,
          }}
        >
          <span className={`${s.font} font-black`} style={{ color: data.cor }}>
            {data.score}
          </span>
          <span
            className={`${s.sub} font-bold uppercase tracking-wider`}
            style={{ color: data.cor }}
          >
            {data.label}
          </span>
        </div>
      </div>

      {/* Ação sugerida */}
      {size !== 'sm' && (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider`}
          style={{
            backgroundColor: data.faixa === 'critico' ? '#FEE2E2' : data.faixa === 'atencao' ? '#FEF3C7' : '#D1FAE5',
            color: data.cor,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: data.cor }} />
          {data.acaoSugerida}
        </div>
      )}
    </div>
  );
}