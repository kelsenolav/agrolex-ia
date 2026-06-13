"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  MapPin, 
  Scale, 
  Landmark, 
  FileSignature, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Gauge,
  Target,
} from 'lucide-react';

export interface ISFAchado {
  titulo: string;
  criticidade: string;
  recomendacao?: string;
  eixo: 'REG' | 'DOM' | 'LIT' | 'POS' | 'FRA' | string;
  descricao?: string;
}

/** Alertas gerados pelo motor ISF v2.2 (uma por dimensão com score ≤ alertaMin) */
export interface ISFV2_2Alerta {
  dimensaoId: string;
  dimensaoNome: string;
  tipo: 'critico' | 'alerta';
  mensagem: string;
}

/** Score por dimensão no ISF v2.2 */
export interface ISFV2_2Dimensao {
  id: string;
  nome: string;
  pontuacao: number;
  contribuicao: number;
  peso: number;
  itemSelecionado: string;
}

/** Payload completo do ISF v2.2 armazenado em findings.isf_v2_2 */
export interface ISFV2_2Payload {
  isf_version: string;
  isf_score: number;
  isf_score_bruto: number;
  faixa: string;
  faixa_label: string;
  faixa_desc: string;
  faixa_bg: string;
  faixa_color: string;
  faixa_meter: string;
  dimensoes: ISFV2_2Dimensao[];
  alertas: ISFV2_2Alerta[];
  dimensoes_faltantes: string[];
  incompleto: boolean;
  travas_aplicadas: string[];
}

export interface ISFExplainerProps {
  isfAchados?: ISFAchado[] | null;
  problemasFallback?: any[] | null;
  /** Payload v2.2 completo (findings.isf_v2_2) — usado para exibir scores/alertas/travas por dimensão */
  isfV2_2?: ISFV2_2Payload | null;
  /** Versão do motor ISF (22 = v2.2) */
  isfVersion?: number | string | null;
}

const EIXOS_CONFIG = {
  REG: { label: 'Eixo Registral', desc: 'Inconsistências em matrículas, ônus, penhoras ou bloqueios judiciais.', Icon: FileSignature, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  DOM: { label: 'Eixo Dominial', desc: 'Problemas de cadeia dominial, quebras de continuidade ou lacunas temporais.', Icon: Landmark, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  LIT: { label: 'Eixo Litígio', desc: 'Disputas judiciais, processos cíveis, trabalhistas ou execuções fiscais.', Icon: Scale, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  POS: { label: 'Eixo Possessório', desc: 'Risco de invasões, ocupações irregulares ou demarcações de área.', Icon: MapPin, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  FRA: { label: 'Eixo Fraude', desc: 'Indícios de fraudes documentais, grilagem ou falsificações.', Icon: AlertCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' }
};

// ─── Config visual das 6 dimensões v2.2 ─────────────────────────────────
const DIMENSOES_V2_2_CONFIG: Record<string, { label: string; Icon: React.ComponentType<any>; color: string; weight: number }> = {
  D1: { label: 'Origem do Título', Icon: FileSignature, color: 'text-amber-600 bg-amber-50 border-amber-200', weight: 0.30 },
  D2: { label: 'Cadeira Dominial', Icon: Landmark, color: 'text-purple-600 bg-purple-50 border-purple-200', weight: 0.25 },
  D3: { label: 'Integridade Registral', Icon: Scale, color: 'text-blue-600 bg-blue-50 border-blue-200', weight: 0.20 },
  D4: { label: 'Conformidade Ambiental', Icon: MapPin, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', weight: 0.10 },
  D5: { label: 'Histórico Litigioso', Icon: AlertTriangle, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', weight: 0.10 },
  D6: { label: 'Fatores Contextuais', Icon: Target, color: 'text-rose-600 bg-rose-50 border-rose-200', weight: 0.05 },
};

// ─── Classificador de eixo client-side (para fallbacks) ─────────────────
function classificarEixoCliente(p: any): string {
  const texto = `${p.titulo || ''} ${p.descricao || ''} ${p.baseDocumental || ''}`.toLowerCase();
  
  if (/registro|registral|matrícula|matricula|cartório|cartorio|certidão|certidao|penhora|bloqueio|averbação|averbacao|ônus|onus|hipoteca|alienação|alienacao/i.test(texto)) {
    return 'REG';
  }
  if (/cadeia|dominial|título|titulo|escritura|transmissão|transmissao|aquisição|usucapião|usucapiao|domínio|dominio|proprietário|proprietario/i.test(texto)) {
    return 'DOM';
  }
  if (/litígio|litigio|processo|judicial|ação|acao|tribunal|justiça|justica|demanda|reintegração|reintegracao|embargo|liminar|tutela|recurso/i.test(texto)) {
    return 'LIT';
  }
  if (/possessório|possessorio|posse|detenção|detencao|ocupação|ocupacao|invasão|invasao|esbulho|turbação|turbacao/i.test(texto)) {
    return 'POS';
  }
  if (/fraude|falsificação|falsificacao|falsidade|adulteração|adulteracao|falso|falsa|simulação|simulacao|grilagem|grilo|estelionato/i.test(texto)) {
    return 'FRA';
  }
  return 'REG';
}

// ─── Helper: cor da barra de score da dimensão ──────────────────────────
function getScoreBarColor(pontuacao: number): string {
  if (pontuacao <= 15) return 'bg-red-500';
  if (pontuacao <= 30) return 'bg-red-400';
  if (pontuacao <= 50) return 'bg-orange-400';
  if (pontuacao <= 70) return 'bg-yellow-400';
  if (pontuacao <= 85) return 'bg-emerald-400';
  return 'bg-green-500';
}

function getScoreLabelColor(pontuacao: number): string {
  if (pontuacao <= 30) return 'text-red-700 bg-red-50';
  if (pontuacao <= 50) return 'text-orange-700 bg-orange-50';
  if (pontuacao <= 70) return 'text-yellow-700 bg-yellow-50';
  if (pontuacao <= 85) return 'text-emerald-700 bg-emerald-50';
  return 'text-green-700 bg-green-50';
}

export default function ISFExplainer({ isfAchados, problemasFallback, isfV2_2, isfVersion }: ISFExplainerProps) {
  const [expandedEixo, setExpandedEixo] = useState<string | null>(null);
  const [expandedDimensao, setExpandedDimensao] = useState<string | null>(null);

  const isV2_2 = isfVersion === 22 || String(isfVersion) === '2.2';
  const hasV2_2Data = isV2_2 && isfV2_2 && Array.isArray(isfV2_2.dimensoes) && isfV2_2.dimensoes.length > 0;

  // ── Normalização de achados para os 5 eixos legados ─────────────────
  // ⚠️ Usar findings.problemas (problemasFallback) como fonte primária para
  //    garantir consistência com o painel "Achados Críticos" da página de
  //    resultado. O isf_achados (coluna) pode divergir após backfills ou
  //    reprocessamentos parciais. O fallback para isfAchados existe para
  //    análises antigas onde findings.problemas pode estar vazio.
  let achadosNormalizados: ISFAchado[] = [];

  if (Array.isArray(problemasFallback) && problemasFallback.length > 0) {
    achadosNormalizados = problemasFallback.map(p => ({
      titulo: p.titulo || p.descricao || 'Achado Sem Título',
      criticidade: p.criticidade || 'médio',
      recomendacao: p.recomendacao || p.recomendacoes?.[0] || '',
      eixo: classificarEixoCliente(p),
      descricao: p.descricao || ''
    }));
  } else if (Array.isArray(isfAchados) && isfAchados.length > 0) {
    achadosNormalizados = isfAchados;
  }

  const eixosChaves = ['REG', 'DOM', 'LIT', 'POS', 'FRA'] as const;
  const achadosPorEixo = eixosChaves.reduce((acc, chave) => {
    acc[chave] = achadosNormalizados.filter(a => String(a.eixo).toUpperCase() === chave);
    return acc;
  }, {} as Record<'REG' | 'DOM' | 'LIT' | 'POS' | 'FRA', ISFAchado[]>);

  const toggleEixo = (eixo: string) => {
    setExpandedEixo(expandedEixo === eixo ? null : eixo);
  };

  const toggleDimensao = (dimId: string) => {
    setExpandedDimensao(expandedDimensao === dimId ? null : dimId);
  };

  const getCriticidadeStyle = (crit: string) => {
    const c = crit.toLowerCase();
    if (c.includes('critico') || c.includes('crítico')) return 'bg-red-100 text-red-800 border-red-200';
    if (c.includes('alto')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (c.includes('medio') || c.includes('médio')) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  // ── Construir mapa de alertas por dimensão para consulta rápida ──────
  const alertasPorDimensao = new Map<string, ISFV2_2Alerta[]>();
  if (hasV2_2Data && isfV2_2.alertas) {
    for (const a of isfV2_2.alertas) {
      const lista = alertasPorDimensao.get(a.dimensaoId) || [];
      lista.push(a);
      alertasPorDimensao.set(a.dimensaoId, lista);
    }
  }

  // ── Construir mapa de travas aplicadas (para tooltip) ────────────────
  const travasAplicadas = (hasV2_2Data && isfV2_2.travas_aplicadas) ? isfV2_2.travas_aplicadas : [];

  return (
    <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8 mt-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2 border-b border-gray-200 pb-3 uppercase tracking-wide">
        <ShieldCheck className="text-brand-gold" size={24} /> 
        Painel de Explicabilidade Técnico
      </h2>

      {/* ═══ SEÇÃO v2.2 — DIMENSÕES, ALERTAS E TRAVAS ═══ */}
      {hasV2_2Data && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={18} className="text-brand-gold" />
            <p className="text-sm font-bold text-gray-700">
              Metodologia ISF v2.2 — Score: <span className="text-brand-green font-black text-lg">{isfV2_2.isf_score}</span>
              {(isfV2_2.isf_score_bruto !== undefined && isfV2_2.isf_score_bruto !== isfV2_2.isf_score) && (
                <span className="text-xs text-gray-400 ml-1">(bruto: {isfV2_2.isf_score_bruto})</span>
              )}
            </p>
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide" style={{
              backgroundColor: isfV2_2.faixa_bg || '#FCEBEB',
              color: isfV2_2.faixa_color || '#791F1F',
            }}>
              {isfV2_2.faixa_label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">{isfV2_2.faixa_desc}</p>

          {/* Travass aplicadas (se houver) */}
          {travasAplicadas.length > 0 && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-black text-red-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Travas de Teto Aplicadas
              </p>
              <ul className="space-y-1.5">
                {travasAplicadas.map((trava, i) => (
                  <li key={i} className="text-xs text-red-700 font-medium flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">▸</span>
                    <span>{trava}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-red-600 mt-2 italic leading-relaxed">
                Travass de teto são mecanismos de segurança que limitam o score máximo quando condições críticas são detectadas (ex: origem do título frágil, lacunas graves na cadeia dominial).
              </p>
            </div>
          )}

          {/* Tabela de Dimensões */}
          <div className="space-y-3">
            {isfV2_2.dimensoes.map((dim) => {
              const config = DIMENSOES_V2_2_CONFIG[dim.id] || { label: dim.nome, Icon: HelpCircle, color: 'text-gray-600 bg-gray-50 border-gray-200', weight: 0 };
              const IconComp = config.Icon;
              const alertasDaDim = alertasPorDimensao.get(dim.id) || [];
              const isOpenD = expandedDimensao === dim.id;
              const barWidth = Math.min(100, dim.pontuacao);
              const naoAnalisada = dim.itemSelecionado === 'Não analisada';

              return (
                <div key={dim.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleDimensao(dim.id)}
                    className="w-full flex items-center gap-3 p-4 bg-white hover:bg-gray-50/50 transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0 ${config.color}`}>
                      <IconComp size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-sm">{config.label}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{(config.weight * 100).toFixed(0)}%</span>
                      </div>
                      {/* Barra de score */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${naoAnalisada ? 'bg-gray-300' : getScoreBarColor(dim.pontuacao)}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${getScoreLabelColor(dim.pontuacao)}`}>
                          {dim.pontuacao}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alertasDaDim.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                          {alertasDaDim.length}
                        </span>
                      )}
                      {isOpenD ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpenD && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                      >
                        <div className="px-4 pb-4 bg-gray-50/60 border-t border-gray-150 space-y-3 pt-3">
                          {/* Item selecionado */}
                          <div className="text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                            <span className="font-bold text-gray-500">Classificação: </span>
                            {dim.itemSelecionado}
                          </div>

                          {/* Contribuição ao score */}
                          <div className="text-xs text-gray-500 flex gap-4">
                            <span>Score: <strong>{dim.pontuacao}</strong>/100</span>
                            <span>Contribuição: <strong>{dim.contribuicao.toFixed(1)}</strong> pts (peso {dim.peso.toFixed(2)})</span>
                          </div>

                          {/* Alertas desta dimensão */}
                          {alertasDaDim.length > 0 && (
                            <div className="space-y-2">
                              {alertasDaDim.map((alerta, i) => (
                                <div key={i} className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                                  alerta.tipo === 'critico'
                                    ? 'bg-red-50 border-red-200 text-red-800'
                                    : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                  {alerta.tipo === 'critico'
                                    ? <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                                    : <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                  }
                                  <div>
                                    <p className="font-bold text-[11px] uppercase tracking-wide mb-0.5">
                                      {alerta.tipo === 'critico' ? '⚠️ Alerta Crítico' : '⚡ Atenção'}
                                    </p>
                                    <p className="leading-relaxed">{alerta.mensagem}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Sem alertas */}
                          {alertasDaDim.length === 0 && dim.pontuacao > 30 && (
                            <div className="flex items-center gap-2 p-2.5 bg-white border border-gray-100 rounded-lg text-emerald-700 text-xs">
                              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                              <span>Nenhum alerta nesta dimensão.</span>
                            </div>
                          )}

                          {naoAnalisada && (
                            <div className="flex items-center gap-2 p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 text-xs italic">
                              <HelpCircle size={14} className="flex-shrink-0" />
                              <span>Esta dimensão não foi analisada. Score neutro atribuído (60).</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {isfV2_2.incompleto && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />
              <span>Análise incompleta — algumas dimensões não foram preenchidas ({isfV2_2.dimensoes_faltantes.join(', ')}).</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ SEÇÃO LEGADA — 5 EIXOS ═══ */}
      <p className="text-sm text-gray-500 mb-6">
        Análise forense detalhada dos riscos territoriais organizada sob a matriz metodológica de 5 eixos fundiários do ISF v2.
      </p>

      <div className="space-y-4">
        {eixosChaves.map(chave => {
          const config = EIXOS_CONFIG[chave];
          const listaAchados = achadosPorEixo[chave];
          const totalAchados = listaAchados.length;
          const isExpanded = expandedEixo === chave;
          const IconComponent = config.Icon;

          return (
            <div 
              key={chave} 
              className={`border rounded-xl transition-all overflow-hidden ${
                isExpanded ? 'border-gray-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <button
                onClick={() => toggleEixo(chave)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 ${config.color}`}>
                    <IconComponent size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-gray-950 text-base">{config.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        totalAchados > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'
                      }`}>
                        {totalAchados === 0 ? 'Sem riscos' : `${totalAchados} ${totalAchados === 1 ? 'risco' : 'riscos'}`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5 leading-relaxed max-w-xl">{config.desc}</p>
                  </div>
                </div>
                <div className="text-gray-400 p-1">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <div className="p-4 bg-gray-50/60 border-t border-gray-150 space-y-4">
                      {totalAchados === 0 ? (
                        <div className="flex items-center gap-2.5 p-3.5 bg-white border border-gray-100 rounded-lg text-emerald-800">
                          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                          <span className="text-sm font-medium">Nenhum risco detectado neste eixo. Conformidade garantida.</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {listaAchados.map((achado, idx) => (
                            <div 
                              key={idx} 
                              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 print:break-inside-avoid"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="font-extrabold text-gray-950 text-sm leading-snug">{achado.titulo}</h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border flex-shrink-0 ${getCriticidadeStyle(achado.criticidade)}`}>
                                  {achado.criticidade}
                                </span>
                              </div>
                              
                              {achado.descricao && (
                                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/30 p-2.5 rounded border border-gray-100/60">
                                  {achado.descricao}
                                </p>
                              )}

                              {achado.recomendacao && (
                                <div className="mt-2.5 p-3.5 bg-brand-green/5 border border-brand-green/10 rounded-lg space-y-1">
                                  <h5 className="text-[11px] font-black text-brand-green uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldCheck size={13} /> Recomendação Técnica
                                  </h5>
                                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                                    {achado.recomendacao}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}