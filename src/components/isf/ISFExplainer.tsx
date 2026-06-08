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
  ChevronUp
} from 'lucide-react';

export interface ISFAchado {
  titulo: string;
  criticidade: string;
  recomendacao?: string;
  eixo: 'REG' | 'DOM' | 'LIT' | 'POS' | 'FRA' | string;
  descricao?: string;
}

export interface ISFExplainerProps {
  isfAchados?: ISFAchado[] | null;
  problemasFallback?: any[] | null; // Caso a coluna isf_achados seja nula (análises legadas)
}

const EIXOS_CONFIG = {
  REG: { label: 'Eixo Registral', desc: 'Inconsistências em matrículas, ônus, penhoras ou bloqueios judiciais.', Icon: FileSignature, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  DOM: { label: 'Eixo Dominial', desc: 'Problemas de cadeia dominial, quebras de continuidade ou lacunas temporais.', Icon: Landmark, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  LIT: { label: 'Eixo Litígio', desc: 'Disputas judiciais, processos cíveis, trabalhistas ou execuções fiscais.', Icon: Scale, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  POS: { label: 'Eixo Possessório', desc: 'Risco de invasões, ocupações irregulares ou demarcações de área.', Icon: MapPin, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  FRA: { label: 'Eixo Fraude', desc: 'Indícios de fraudes documentais, grilagem ou falsificações.', Icon: AlertCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' }
};

// Classificador client-side simples para fallbacks de análises antigas
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
  return 'REG'; // Eixo padrão caso não dê match
}

export default function ISFExplainer({ isfAchados, problemasFallback }: ISFExplainerProps) {
  const [expandedEixo, setExpandedEixo] = useState<string | null>(null);

  // Normalização e cruzamento dos dados
  let achadosNormalizados: ISFAchado[] = [];

  if (Array.isArray(isfAchados) && isfAchados.length > 0) {
    achadosNormalizados = isfAchados;
  } else if (Array.isArray(problemasFallback) && problemasFallback.length > 0) {
    achadosNormalizados = problemasFallback.map(p => ({
      titulo: p.titulo || p.descricao || 'Achado Sem Título',
      criticidade: p.criticidade || 'médio',
      recomendacao: p.recomendacao || p.recomendacoes?.[0] || '',
      eixo: classificarEixoCliente(p),
      descricao: p.descricao || ''
    }));
  }

  // Agrupamento pelos 5 eixos reais
  const eixosChaves = ['REG', 'DOM', 'LIT', 'POS', 'FRA'] as const;
  const achadosPorEixo = eixosChaves.reduce((acc, chave) => {
    acc[chave] = achadosNormalizados.filter(a => String(a.eixo).toUpperCase() === chave);
    return acc;
  }, {} as Record<'REG' | 'DOM' | 'LIT' | 'POS' | 'FRA', ISFAchado[]>);

  const toggleEixo = (eixo: string) => {
    setExpandedEixo(expandedEixo === eixo ? null : eixo);
  };

  const getCriticidadeStyle = (crit: string) => {
    const c = crit.toLowerCase();
    if (c.includes('critico') || c.includes('crítico')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (c.includes('alto')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (c.includes('medio') || c.includes('médio')) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  return (
    <section className="print:break-inside-avoid border-t-2 border-gray-100 pt-8 mt-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2 border-b border-gray-200 pb-3 uppercase tracking-wide">
        <ShieldCheck className="text-brand-gold" size={24} /> 
        Painel de Explicabilidade Técnico
      </h2>
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
              {/* Header do Eixo */}
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

              {/* Corpo do Eixo */}
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