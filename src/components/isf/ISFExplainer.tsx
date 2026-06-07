"use client";
/**
 * ISFExplainer.tsx — Componente Visual de Explicabilidade do ISF v2
 *
 * SPRINT 3 — EXPLICABILIDADE ISF v2
 * SPRINT 4 — PDF ISF v2 (classes de print adicionadas)
 *
 * Exibe:
 *   1. Card geral do ISF v2 (score + classificação + leitura executiva)
 *   2. Top fatores de redução (até 5)
 *   3. Explicação por eixo (Registral, Dominial, Litígio, Possessório, Fraude)
 *   4. Comparação score legado x ISF v2 (se disponível)
 *   5. Mensagem amigável se ISF v2 não existir
 */

import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Info,
  TrendingDown,
  BarChart3,
  GitCompare,
  ArrowUpDown,
} from 'lucide-react';
import type { ExplicabilidadeISF, TopFator, EixoExplicacao, ComparacaoScore } from '@/lib/isf/isfExplainer';
import { gerarExplicabilidadeISF } from '@/lib/isf/isfExplainer';

// ─── CORES POR CLASSIFICAÇÃO ──────────────────────────────────────────

const CORES_CLASSIFICACAO: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critico:      { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
  alto_risco:   { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  atencao:      { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  seguro:       { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  muito_seguro: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
};

const CRITICIDADE_CORES: Record<string, string> = {
  critica: 'bg-red-100 text-red-800 border-red-200',
  crítica: 'bg-red-100 text-red-800 border-red-200',
  critico: 'bg-red-100 text-red-800 border-red-200',
  crítico: 'bg-red-100 text-red-800 border-red-200',
  alta:    'bg-orange-100 text-orange-800 border-orange-200',
  alto:    'bg-orange-100 text-orange-800 border-orange-200',
  media:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  médio:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  medio:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  baixa:   'bg-green-100 text-green-800 border-green-200',
  baixo:   'bg-green-100 text-green-800 border-green-200',
};

function getCriticidadeCor(criticidade: string): string {
  const key = criticidade.toLowerCase().trim();
  return CRITICIDADE_CORES[key] || 'bg-gray-100 text-gray-800 border-gray-200';
}

function getClassificacaoCor(classificacao: string): { bg: string; border: string; text: string; badge: string } {
  const key = classificacao.toLowerCase().replace(/\s+/g, '_') as keyof typeof CORES_CLASSIFICACAO;
  return CORES_CLASSIFICACAO[key] || CORES_CLASSIFICACAO.atencao;
}

// ─── COMPONENTES INTERNOS ─────────────────────────────────────────────

function CardGeral({
  score,
  classificacao,
  resumo,
}: {
  score: number;
  classificacao: string;
  resumo: string;
}) {
  const cores = getClassificacaoCor(classificacao);

  return (
    <div className={`${cores.bg} p-5 rounded-xl border ${cores.border} shadow-sm isf-card-geral`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${cores.badge} flex items-center justify-center`}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">ISF v2</p>
            <p className={`text-3xl font-black ${cores.text} isf-score-valor`}>{score}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${cores.badge} isf-classificacao-badge`}>
          {classificacao}
        </span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed isf-resumo-texto">{resumo}</p>
    </div>
  );
}

function TopFatoresList({ fatores }: { fatores: TopFator[] }) {
  if (fatores.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">
            Nenhum fator relevante de redução foi identificado pelo ISF v2.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 isf-top-fatores">
      {fatores.map((fator, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow isf-top-fator-item"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              <span className="text-sm font-bold text-gray-900 truncate">{fator.nome}</span>
              {/* Badge "RISCO MAIS RELEVANTE" no fator #1 */}
              {i === 0 && (
                <span className="ml-2 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-red-600 text-white isf-risco-relevante-badge">
                  RISCO MAIS RELEVANTE
                </span>
              )}
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ml-2 ${getCriticidadeCor(fator.criticidade)}`}
            >
              {fator.criticidade}
            </span>
          </div>
          <div className="ml-8 space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <BarChart3 size={12} />
              <span>
                <strong>Eixo:</strong> {fator.eixo}
              </span>
              <span className="text-gray-300">|</span>
              <span>
                <strong>Impacto:</strong> -{fator.impacto} pts
              </span>
            </div>
            {fator.descricao && (
              <p className="text-xs text-gray-600 leading-relaxed">{fator.descricao}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EixosExplicacao({ eixos }: { eixos: EixoExplicacao[] }) {
  if (eixos.length === 0) return null;

  return (
    <div className="space-y-3 isf-eixos">
      {eixos.map((eixo, i) => {
        const leitura = eixo.leitura || '';
        const intensidade = eixo.valor / 100; // 0-1

        // Cor da barra com base na leitura
        let barColor = 'bg-green-500';
        if (eixo.valor >= 70) barColor = 'bg-red-500';
        else if (eixo.valor >= 50) barColor = 'bg-orange-500';
        else if (eixo.valor >= 25) barColor = 'bg-yellow-500';

        return (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm isf-eixo-item">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-800">{eixo.eixo}</span>
              <span className="text-xs font-bold text-gray-500">
                Peso: {(eixo.peso * 100).toFixed(0)}%
              </span>
            </div>

            {/* Barra de valor */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 isf-eixo-bar-track">
              <div
                className={`h-2.5 rounded-full transition-all ${barColor} isf-eixo-bar-fill`}
                style={{ width: `${eixo.valor}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Score: {eixo.valor}</span>
              <span>Contribuição: -{eixo.contribuicao.toFixed(1)} pts</span>
              <span>{eixo.achados} achado(s)</span>
            </div>

            <p className="text-xs text-gray-600 italic isf-eixo-leitura">{leitura}</p>
          </div>
        );
      })}
    </div>
  );
}

function ComparacaoScores({ comparacao }: { comparacao: ComparacaoScore }) {
  let leituraCor = 'text-gray-600';
  if (comparacao.difference > 5) leituraCor = 'text-green-600';
  else if (comparacao.difference < -5) leituraCor = 'text-red-600';

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200 shadow-sm isf-comparacao">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare size={18} className="text-blue-600" />
        <span className="text-sm font-bold text-blue-800">Comparação: Score Legado vs ISF v2</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 isf-comparacao-grid">
        <div className="bg-white p-3 rounded-lg border border-blue-100 text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Score Legado</p>
          <p className="text-xl font-black text-gray-800">{comparacao.legacyScore}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-blue-100 text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">ISF v2</p>
          <p className="text-xl font-black text-blue-700">{comparacao.isfScore}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-blue-100 text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Diferença</p>
          <p className={`text-xl font-black ${leituraCor}`}>
            {comparacao.difference > 0 ? '+' : ''}{comparacao.difference}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed">{comparacao.leitura}</p>
      <p className="text-xs text-gray-400 italic mt-2">
        O ISF v2 é um índice técnico complementar em fase de calibração.
      </p>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────

interface ISFExplainerProps {
  isfV2Data: Record<string, unknown> | null | undefined;
  scoreComparisonData: Record<string, unknown> | null | undefined;
}

export default function ISFExplainer({
  isfV2Data,
  scoreComparisonData,
}: ISFExplainerProps) {
  const explicabilidade = gerarExplicabilidadeISF(isfV2Data, scoreComparisonData);

  // Se ISF v2 não disponível
  if (!explicabilidade.disponivel) {
    return (
      <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-200 pb-3 uppercase tracking-wide">
          <ShieldCheck className="text-brand-gold" size={24} /> Índice de Segurança Fundiária — ISF
        </h2>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                {explicabilidade.resumo || 'Explicabilidade ISF v2 ainda não disponível para esta análise.'}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                O ISF v2 é calculado automaticamente durante o processamento da análise. Para análises existentes, o score legado continua sendo exibido normalmente.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Garantir que os campos existem (segurança de tipo)
  const score = explicabilidade.score!;
  const classificacao = explicabilidade.classificacao!;
  const resumo = explicabilidade.resumo!;
  const fatores = explicabilidade.topFatores || [];
  const eixos = explicabilidade.eixos || [];

  return (
    <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8 isf-section">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-200 pb-3 uppercase tracking-wide">
        <ShieldCheck className="text-brand-gold" size={24} /> Índice de Segurança Fundiária — ISF
      </h2>

      {/* 1. Card Geral */}
      <div className="mb-6 isf-bloco-card">
        <CardGeral score={score} classificacao={classificacao} resumo={resumo} />
      </div>

      {/* 2. Top Fatores de Redução */}
      <div className="mb-6 isf-bloco-fatores">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-wider">
          <TrendingDown size={16} className="text-red-500" />
          Fatores que reduziram o ISF
        </h3>
        <TopFatoresList fatores={fatores} />
      </div>

      {/* 3. Explicação por Eixo */}
      {eixos.length > 0 && (
        <div className="mb-6 isf-bloco-eixos">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <BarChart3 size={16} className="text-brand-gold" />
            Detalhamento por Eixo
          </h3>
          <EixosExplicacao eixos={eixos} />
        </div>
      )}

      {/* 4. Comparação v1 x v2 (se disponível) */}
      {explicabilidade.comparacao && (
        <div className="mb-2 isf-bloco-comparacao">
          <ComparacaoScores comparacao={explicabilidade.comparacao} />
        </div>
      )}

      {/* 5. Nota de rodapé */}
      <div className="mt-4 pt-3 border-t border-gray-100 isf-rodape">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <strong>ISF v2</strong> — Índice de Segurança Fundiária. Versão 2.0. Este índice é um complemento ao score legado e está em fase de calibração. Os valores podem variar conforme o refinamento dos pesos e thresholds.
        </p>
      </div>
    </section>
  );
}