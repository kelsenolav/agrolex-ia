import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const analyses = JSON.parse(readFileSync(resolve(__dirname, '..', 'docs', 'backtest_analyses_full.json'), 'utf-8'));

// ============================================================
// FUNÇÃO: calcularScoreAtual (reconstrução do motor legado)
// ============================================================
function calcularScoreAtual(problemas, documentosFaltantes, recomendacoes, riskLevel) {
  let criticos = 0, altos = 0, medios = 0;

  (problemas || []).forEach(p => {
    const crit = (p.criticidade || '').toLowerCase();
    if (crit.includes('crit')) criticos++;
    else if (crit.includes('alto')) altos++;
    else if (crit.includes('méd') || crit.includes('medio')) medios++;
  });

  // Se não tem problemas no array, tentar extrair do resumo (fallback)
  if (criticos + altos + medios === 0 && problemas.length === 0) {
    // Score baseado apenas em docs faltantes e risk level
    // Risk level já captura a classificação geral
  }

  const docsFaltantes = (documentosFaltantes || []).length;
  const numRecomendacoes = Math.min((recomendacoes || []).length, 5);
  const checklistReprovado = 0;

  let riskAdjust = 0;
  const rl = (riskLevel || '').toLowerCase();
  if (rl === 'alto') riskAdjust = -10;
  else if (rl === 'médio' || rl === 'medio') riskAdjust = -5;
  else if (rl === 'baixo' || rl === 'seguro') riskAdjust = +5;

  let score = 70
    - (criticos * 12)
    - (altos * 6)
    - (medios * 3)
    - (docsFaltantes * 2)
    - (checklistReprovado * 5)
    + (numRecomendacoes * 2)
    + riskAdjust;

  score = Math.max(0, Math.min(100, score));

  let faixa;
  if (score < 40) faixa = 'Crítico';
  else if (score < 70) faixa = 'Atenção';
  else faixa = 'Seguro';

  return { score, faixa, criticos, altos, medios, docsFaltantes, numRecomendacoes, riskAdjust };
}

// ============================================================
// FUNÇÃO: extrair achados do resumo markdown
// ============================================================
function extrairAchadosDoResumo(resumo) {
  if (!resumo) return [];
  
  const achados = [];
  const lines = resumo.split('\n');
  
  // Encontrar seção de achados
  const achadosSectionStart = lines.findIndex(l => 
    /^\d*\.?\s*ACHADOS?\s*(TÉCNICOS|IDENTIFICADOS|FUNDIÁRIOS)?/i.test(l.trim())
  );
  
  if (achadosSectionStart < 0) return achados;
  
  // Encontrar próxima seção (documentos faltantes, classificação, conclusão)
  const sectionMarkers = ['documentos faltantes', 'classificação', 'conclusão', 'recomendações', 'limitação'];
  const sectionEnd = lines.findIndex((l, i) => 
    i > achadosSectionStart && sectionMarkers.some(m => 
      new RegExp(`^\\d*\\.?\\s*${m}`, 'i').test(l.trim())
    )
  );
  
  const achadosLines = lines.slice(achadosSectionStart + 1, sectionEnd > 0 ? sectionEnd : lines.length);
  
  // Extrair cada achado (blocos começando com "ACHADO IDENTIFICADO")
  let currentAchado = null;
  
  for (const line of achadosLines) {
    const trimmed = line.trim();
    
    if (/ACHADO IDENTIFICADO/i.test(trimmed)) {
      // Salva anterior
      if (currentAchado) achados.push(currentAchado);
      
      currentAchado = {
        titulo: trimmed.replace(/ACHADO IDENTIFICADO:\s*/i, ''),
        descricao: '',
        criticidade: 'Médio',
        baseDocumental: '',
        documentoNecessario: '',
        recomendacao: ''
      };
      continue;
    }
    
    if (!currentAchado) {
      // Se não tem um achado ainda, pular linhas de preâmbulo
      if (trimmed.length > 50 && !trimmed.startsWith('BASE') && !trimmed.startsWith('RISCO') && !trimmed.startsWith('GRAU')) continue;
    }
    
    if (currentAchado) {
      if (/^BASE DOCUMENTAL:/i.test(trimmed)) {
        currentAchado.baseDocumental = trimmed.replace(/^BASE DOCUMENTAL:\s*/i, '');
      } else if (/^RISCO JURÍDICO/i.test(trimmed)) {
        currentAchado.descricao += ' ' + trimmed;
      } else if (/^GRAU DE CRITICIDADE:/i.test(trimmed)) {
        currentAchado.criticidade = trimmed.replace(/^GRAU DE CRITICIDADE:\s*/i, '');
      } else if (/^DOCUMENTO NECESSÁRIO/i.test(trimmed)) {
        currentAchado.documentoNecessario = trimmed.replace(/^DOCUMENTO NECESSÁRIO.*?:\s*/i, '');
      } else if (/^RECOMENDAÇÃO/i.test(trimmed)) {
        // Fim do achado
      } else if (trimmed && !trimmed.startsWith('---')) {
        currentAchado.descricao += ' ' + trimmed;
      }
    }
  }
  
  // Último
  if (currentAchado) achados.push(currentAchado);
  
  return achados;
}

// ============================================================
// MATRIZ DE ACHADOS ISF v2
// ============================================================
const ACHADOS_MATRIX = {
  'REG-001': { eixo: 'REG', impacto: 50, keywords: ['matrícula inexistente', 'matrícula não localizada', 'sem registro', 'matrícula encerrada'] },
  'REG-002': { eixo: 'REG', impacto: 30, keywords: ['ônus real', 'hipoteca', 'anticrese', 'gravame'] },
  'REG-003': { eixo: 'REG', impacto: 40, keywords: ['indisponibilidade de bens', 'indisponibilidade'] },
  'REG-004': { eixo: 'REG', impacto: 15, keywords: ['protesto', 'protestado'] },
  'REG-005': { eixo: 'REG', impacto: 35, keywords: ['penhora', 'penhorado'] },
  'REG-011': { eixo: 'REG', impacto: 25, keywords: ['divergência de área', 'área divergente', 'inconsistência de área', 'área inconsistente'] },
  'REG-012': { eixo: 'REG', impacto: 15, keywords: ['sem indicação de área', 'área total não informada'] },
  'REG-014': { eixo: 'REG', impacto: 30, keywords: ['bloqueio judicial', 'averbação de ação', 'ação real', 'ação reipersecutória'] },
  'REG-016': { eixo: 'REG', impacto: 40, keywords: ['cancelamento de registro', 'cancelamento sem fundamento', 'registro cancelado'] },
  'REG-017': { eixo: 'REG', impacto: 50, keywords: ['dupla matrícula', 'duplicidade de matrícula'] },
  'REG-xxx': { eixo: 'REG', impacto: 20, keywords: ['averbação', 'usufruto', 'cláusula de inalienabilidade', 'cláusula de impenhorabilidade', 'caução', 'alienação fiduciária'] },
  
  'DOM-001': { eixo: 'DOM', impacto: 45, keywords: ['quebra de cadeia', 'lacuna dominial', 'cadeia dominial quebrada', 'cadeia incompleta', 'ruptura', 'descontinuidade'] },
  'DOM-002': { eixo: 'DOM', impacto: 40, keywords: ['transcrição sem continuidade', 'continuidade registral quebrada'] },
  'DOM-003': { eixo: 'DOM', impacto: 35, keywords: ['ausência de registro de aquisição', 'registro de aquisição ausente'] },
  'DOM-005': { eixo: 'DOM', impacto: 25, keywords: ['divergência de área entre transcrições'] },
  'DOM-008': { eixo: 'DOM', impacto: 25, keywords: ['ascendente', 'descendente', 'consentimento dos demais'] },
  'DOM-010': { eixo: 'DOM', impacto: 45, keywords: ['terras públicas', 'terra pública', 'origem pública', 'título definitivo', 'órgão de terras', 'iterpa', 'itertins', 'interpi', 'idago', 'incra', 'regularização fundiária', 'título de domínio', 'terras devolutas'] },
  'DOM-011': { eixo: 'DOM', impacto: 30, keywords: ['grilagem recente', 'menos de 30 anos', 'cadeia reduzida'] },
  'DOM-012': { eixo: 'DOM', impacto: 50, keywords: ['ausência de transcrição', 'sem transcrição'] },
  'DOM-xxx': { eixo: 'DOM', impacto: 20, keywords: ['cadeia dominial', 'herdeiro', 'partilha', 'inventário', 'venda de ascendente', 'transmissão', 'título de legitimação', 'título de domínio'] },
  
  'POS-001': { eixo: 'POS', impacto: 25, keywords: ['ocupação por terceiros', 'ocupação sem título', 'invasão', 'posse de terceiros'] },
  'POS-002': { eixo: 'POS', impacto: 45, keywords: ['assentamento', 'reforma agrária'] },
  'POS-003': { eixo: 'POS', impacto: 50, keywords: ['terra indígena', 'sobreposição com terra indígena', 'indígena'] },
  'POS-004': { eixo: 'POS', impacto: 45, keywords: ['quilombo', 'quilombola'] },
  'POS-005': { eixo: 'POS', impacto: 35, keywords: ['unidade de conservação', 'sobreposição sigef', 'uc'] },
  'POS-006': { eixo: 'POS', impacto: 30, keywords: ['esbulho'] },
  'POS-007': { eixo: 'POS', impacto: 20, keywords: ['área ocupada superior', 'área ocupada maior', 'posse excedente'] },
  'POS-008': { eixo: 'POS', impacto: 10, keywords: ['ausência de cerca', 'falta de divisa'] },
  'POS-010': { eixo: 'POS', impacto: 20, keywords: ['sem utilização econômica', 'imóvel sem uso', 'exploração'] },
  'POS-xxx': { eixo: 'POS', impacto: 15, keywords: ['posse', 'comodato', 'permissão de uso', 'ocupação precária'] },
  
  'LIT-001': { eixo: 'LIT', impacto: 35, keywords: ['ação possessória', 'reintegração de posse', 'manutenção de posse', 'interdito proibitório'] },
  'LIT-002': { eixo: 'LIT', impacto: 40, keywords: ['ação reivindicatória', 'reivindicatória'] },
  'LIT-003': { eixo: 'LIT', impacto: 30, keywords: ['usucapião', 'ação de usucapião'] },
  'LIT-004': { eixo: 'LIT', impacto: 30, keywords: ['execução fiscal', 'dívida ativa', 'cda'] },
  'LIT-005': { eixo: 'LIT', impacto: 30, keywords: ['penhora em execução', 'penhora trabalhista'] },
  'LIT-006': { eixo: 'LIT', impacto: 45, keywords: ['ação civil pública', 'acp'] },
  'LIT-007': { eixo: 'LIT', impacto: 50, keywords: ['ação do incra', 'incra ação', 'cancelamento de registro'] },
  'LIT-008': { eixo: 'LIT', impacto: 50, keywords: ['expropriação', 'trabalho escravo'] },
  'LIT-010': { eixo: 'LIT', impacto: 35, keywords: ['arresto', 'sequestro de bens'] },
  'LIT-xxx': { eixo: 'LIT', impacto: 25, keywords: ['ação judicial', 'demanda judicial', 'disputa judicial', 'litígio', 'mandado de segurança', 'processo judicial', 'justiça federal', 'vara federal', 'tramitação', 'evicção', 'judicial'] },
  
  'FRA-001': { eixo: 'FRA', impacto: 50, keywords: ['falsificação de matrícula', 'fraude documental confirmada', 'falsificação de título'] },
  'FRA-002': { eixo: 'FRA', impacto: 50, keywords: ['grilagem'] },
  'FRA-004': { eixo: 'FRA', impacto: 30, keywords: ['divergência grosseira', '50% entre matrícula', 'divergência superior'] },
  'FRA-005': { eixo: 'FRA', impacto: 40, keywords: ['esquentamento', 'falsa cadeia', 'cadeia forjada'] },
  'FRA-010': { eixo: 'FRA', impacto: 50, keywords: ['múltiplos compradores', 'venda do mesmo imóvel', 'alienação simultânea'] },
  'FRA-xxx': { eixo: 'FRA', impacto: 25, keywords: ['falsificação', 'adulteração', 'assinatura divergente', 'documento apócrifo', 'indício de fraude', 'documento suspeito', 'suspeita de falsificação'] },
};

function matchKeywords(text, keywords) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function calculateISFv2(analysis) {
  const problemas = analysis.problemas || [];
  const resumo = analysis.findings?.resumo || '';
  const risks = analysis.findings?.case_file?.risks || [];
  
  // Combinar todas as fontes de achados
  const allAchados = [...problemas];
  
  // Se não há problemas no array, extrair do resumo
  if (problemas.length === 0) {
    const resumoAchados = extrairAchadosDoResumo(resumo);
    allAchados.push(...resumoAchados);
  }
  
  // Calcular soma de impactos por eixo
  const eixos = { REG: 0, DOM: 0, POS: 0, LIT: 0, FRA: 0 };
  const achadosDetectados = { REG: [], DOM: [], POS: [], LIT: [], FRA: [] };
  const detalhes = [];

  // Para cada achado/problema, buscar na matriz
  allAchados.forEach(p => {
    const titulo = p.titulo || '';
    const descricao = (p.descricao || '') + ' ' + (p.baseDocumental || '') + ' ' + (p.documentoNecessario || '');
    const combined = titulo + ' ' + descricao;
    
    let matched = false;
    Object.entries(ACHADOS_MATRIX).forEach(([id, achado]) => {
      if (matchKeywords(combined, achado.keywords)) {
        const eixo = achado.eixo;
        eixos[eixo] += achado.impacto;
        achadosDetectados[eixo].push({ id, impacto: achado.impacto });
        detalhes.push({ id, eixo, impacto: achado.impacto, titulo: titulo.slice(0, 60) });
        matched = true;
      }
    });
    
    // Se não match específico, classificação genérica por criticidade
    if (!matched) {
      const crit = (p.criticidade || '').toLowerCase();
      if (crit.includes('crit')) {
        eixos['REG'] += 25; eixos['DOM'] += 25;
        detalhes.push({ id: 'GEN-CRIT-50', eixo: 'REG+DOM', impacto: 50, titulo: 'Crítico genérico' });
      } else if (crit.includes('alto')) {
        eixos['LIT'] += 20; eixos['REG'] += 15;
        detalhes.push({ id: 'GEN-ALTO-35', eixo: 'LIT+REG', impacto: 35, titulo: 'Alto genérico' });
      } else if (crit.includes('méd') || crit.includes('medio')) {
        eixos['POS'] += 15;
        detalhes.push({ id: 'GEN-MED-15', eixo: 'POS', impacto: 15, titulo: 'Médio genérico' });
      }
    }
  });
  
  // Também analisar riscos estruturados do case_file
  risks.forEach(r => {
    const combined = (r.title || '') + ' ' + (r.description || '');
    
    // Ignorar classificações genéricas
    if (/classificação geral/i.test(r.title || '')) return;
    
    let matched = false;
    Object.entries(ACHADOS_MATRIX).forEach(([id, achado]) => {
      if (matchKeywords(combined, achado.keywords)) {
        const eixo = achado.eixo;
        eixos[eixo] += achado.impacto;
        achadosDetectados[eixo].push({ id, impacto: achado.impacto });
        detalhes.push({ id, eixo, impacto: achado.impacto, titulo: (r.title || '').slice(0, 60) });
        matched = true;
      }
    });
    
    // Se não match, usar a severidade
    if (!matched) {
      const sev = (r.severity || '').toLowerCase();
      if (sev.includes('crit')) { eixos['REG'] += 25; eixos['DOM'] += 25; }
      else if (sev.includes('alto')) { eixos['LIT'] += 20; eixos['REG'] += 15; }
      else if (sev.includes('méd') || sev.includes('medio')) { eixos['POS'] += 15; }
    }
  });
  
  // Penalidade adicional por documentos faltantes (indica falta de diligência)
  const docsFaltantes = (analysis.documentosFaltantes || []).length;
  if (docsFaltantes >= 5) eixos['REG'] += 10;
  if (docsFaltantes >= 10) eixos['REG'] += 10;

  // Aplicar teto por eixo (80)
  const PESOS = { REG: 0.25, DOM: 0.25, LIT: 0.20, POS: 0.15, FRA: 0.15 };
  const eixosNormalizados = {};
  let totalContribuicao = 0;
  
  Object.entries(eixos).forEach(([eixo, valor]) => {
    const normalizado = Math.min(valor, 80);
    const contribuicao = normalizado * PESOS[eixo];
    eixosNormalizados[eixo] = { valor, normalizado, contribuicao: Math.round(contribuicao * 100) / 100 };
    totalContribuicao += contribuicao;
  });

  let isf = Math.round(100 - totalContribuicao);
  isf = Math.max(0, Math.min(100, isf));

  let faixa;
  if (isf >= 90) faixa = 'Muito Seguro';
  else if (isf >= 70) faixa = 'Seguro';
  else if (isf >= 50) faixa = 'Atenção';
  else if (isf >= 30) faixa = 'Alto Risco';
  else faixa = 'Crítico';

  return {
    isf,
    faixa,
    eixos: eixosNormalizados,
    totalContribuicao: Math.round(totalContribuicao * 100) / 100,
    detalhes,
    achadosNoArray: problemas.length,
    achadosExtraidos: allAchados.length - problemas.length,
    achadosDetectados: Object.fromEntries(
      Object.entries(achadosDetectados).map(([k, v]) => [k, v.length])
    )
  };
}

// ============================================================
// EXECUTAR ANÁLISE
// ============================================================
console.log('══════════════════════════════════════════════════════');
console.log('  BACKTESTING FORENSE ISF v2');
console.log('  Análise de ' + analyses.length + ' casos concluídos');
console.log('══════════════════════════════════════════════════════\n');

const results = [];

analyses.forEach(a => {
  const scoreAtual = calcularScoreAtual(a.problemas, a.documentosFaltantes, a.recomendacoes, a.risk_level);
  const isfV2 = calculateISFv2(a);
  
  const diff = isfV2.isf - scoreAtual.score;
  
  results.push({
    id: a.id,
    riskLevel: a.risk_level,
    scoreAtual: scoreAtual.score,
    faixaAtual: scoreAtual.faixa,
    isfV2: isfV2.isf,
    faixaISF: isfV2.faixa,
    diff,
    achadosArray: isfV2.achadosNoArray,
    achadosExtraidos: isfV2.achadosExtraidos,
    detalhesScore: { criticos: scoreAtual.criticos, altos: scoreAtual.altos, medios: scoreAtual.medios, docs: scoreAtual.docsFaltantes },
    eixos: Object.fromEntries(Object.entries(isfV2.eixos).map(([k, v]) => [k, v.normalizado])),
    contribuicoes: Object.fromEntries(Object.entries(isfV2.eixos).map(([k, v]) => [k, Math.round(v.contribuicao * 100) / 100])),
  });
});

// TABELA COMPARATIVA
console.log('FASE 4 — TABELA COMPARATIVA: Score Atual vs ISF v2');
console.log('══════════════════════════════════════════════════════');
console.log('ID         Risk       Atual Faixa    ISFv2 Faixa         Dif  REG DOM LIT POS FRA\n' + '-'.repeat(90));
results.forEach(r => {
  const diffStr = r.diff > 0 ? '+ ' + String(r.diff).padStart(2) : String(r.diff).padStart(4);
  console.log(
    r.id.slice(0, 8), '|',
    r.riskLevel.padEnd(8), '|',
    String(r.scoreAtual).padStart(3), r.faixaAtual.padEnd(9), '|',
    String(r.isfV2).padStart(3), r.faixaISF.padEnd(12), '|',
    diffStr, '|',
    'R:' + String(r.eixos.REG).padStart(2), 'D:' + String(r.eixos.DOM).padStart(2), 'L:' + String(r.eixos.LIT).padStart(2), 'P:' + String(r.eixos.POS).padStart(2), 'F:' + String(r.eixos.FRA).padStart(2)
  );
});

// ESTATÍSTICAS
console.log('\n══════════════════════════════════════════════════════');
console.log('  RESUMO ESTATÍSTICO');
console.log('══════════════════════════════════════════════════════');

const scoresAtuais = results.map(r => r.scoreAtual);
const scoresISF = results.map(r => r.isfV2);
const diffs = results.map(r => r.diff);

const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10;
const min = arr => Math.min(...arr);
const max = arr => Math.max(...arr);

console.log(`Score Atual — média: ${avg(scoresAtuais)} | min: ${min(scoresAtuais)} | max: ${max(scoresAtuais)}`);
console.log(`ISF v2     — média: ${avg(scoresISF)} | min: ${min(scoresISF)} | max: ${max(scoresISF)}`);
console.log(`Diferença  — média: ${avg(diffs)} | min: ${min(diffs)} | max: ${max(diffs)}`);

const melhor = results.filter(r => r.diff > 5).length;
const similar = results.filter(r => r.diff >= -5 && r.diff <= 5).length;
const pior = results.filter(r => r.diff < -5).length;

console.log(`\nISF v2 > ScoreAtual (> +5): ${melhor} casos`);
console.log(`ISF v2 ≈ ScoreAtual (±5): ${similar} casos`);
console.log(`ISF v2 < ScoreAtual (< -5): ${pior} casos`);

console.log('\nFASE 5 — VALIDAÇÃO JURÍDICA (ISF v2 vs ScoreAtual):');
console.log('  Melhor:', melhor, '(mais preciso, auditável, defensável)');
console.log('  Similar:', similar, '(mesma faixa de risco)');
console.log('  Pior:', pior, '(possível falso negativo — revisar)');

// DISTRIBUIÇÃO DE FAIXAS
console.log('\nFASE 6 — DETECÇÃO DE DISTORÇÕES');
console.log('\nDistribuição Score Atual:');
const faixasAtual = {};
results.forEach(r => { faixasAtual[r.faixaAtual] = (faixasAtual[r.faixaAtual] || 0) + 1; });
Object.entries(faixasAtual).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\nDistribuição ISF v2:');
const faixasISF = {};
results.forEach(r => { faixasISF[r.faixaISF] = (faixasISF[r.faixaISF] || 0) + 1; });
Object.entries(faixasISF).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Falsos positivos/negativos
const falsosPositivos = results.filter(r => r.faixaAtual === 'Crítico' && r.faixaISF === 'Seguro');
const falsosNegativos = results.filter(r => r.faixaAtual === 'Seguro' && r.faixaISF === 'Crítico');
const superestimados = results.filter(r => r.faixaAtual === 'Crítico' && (r.faixaISF === 'Atenção' || r.faixaISF === 'Alto Risco'));
const subestimados = results.filter(r => (r.faixaAtual === 'Atenção' || r.faixaAtual === 'Crítico') && r.faixaISF === 'Muito Seguro');

console.log(`\nFalsos positivos (ScoreAtual crítico, ISF v2 seguro): ${falsosPositivos.length}`);
console.log(`Falsos negativos (ScoreAtual seguro, ISF v2 crítico): ${falsosNegativos.length}`);
console.log(`Superestimados (ScoreAtual crítico, ISF v2 alerta): ${superestimados.length}`);
console.log(`Subestimados (ScoreAtual alerta, ISF v2 muito seguro): ${subestimados.length}`);

if (subestimados.length > 0) {
  console.log('\nCasos subestimados (score v2 maior que atual):');
  subestimados.forEach(r => console.log(`  ${r.id.slice(0,8)} | Atual: ${r.scoreAtual} (${r.faixaAtual}) → ISFv2: ${r.isfV2} (${r.faixaISF}) | Achados no array: ${r.achadosArray}, extraídos do resumo: ${r.achadosExtraidos}`));
}

// CASOS PROBLEMÁTICOS
console.log('\n══════════════════════════════════════════════════════');
console.log('  CASOS COM GRANDE DIVERGÊNCIA (|diff| ≥ 20)');
console.log('══════════════════════════════════════════════════════');
const problematicos = results.filter(r => Math.abs(r.diff) >= 20);
problematicos.forEach(r => {
  console.log(`ID: ${r.id.slice(0, 8)} | Atual: ${r.scoreAtual} (${r.faixaAtual}) → ISFv2: ${r.isfV2} (${r.faixaISF}) | Dif: ${r.diff}`);
  console.log(`  Eixos: REG=${r.eixos.REG} DOM=${r.eixos.DOM} LIT=${r.eixos.LIT} POS=${r.eixos.POS} FRA=${r.eixos.FRA}`);
  console.log(`  Contribuições: ${JSON.stringify(r.contribuicoes)}`);
});

// Salvar resultados
writeFileSync(resolve(__dirname, '..', 'docs', 'backtest_isf_results_v2.json'), JSON.stringify(results, null, 2));
const csvLines = ['id,risk_level,score_atual,faixa_atual,isf_v2,faixa_isf,diferenca,reg,dom,lit,pos,fra,achados_array,achados_extraidos'];
results.forEach(r => {
  csvLines.push(`${r.id},${r.riskLevel},${r.scoreAtual},${r.faixaAtual},${r.isfV2},${r.faixaISF},${r.diff},${r.eixos.REG},${r.eixos.DOM},${r.eixos.LIT},${r.eixos.POS},${r.eixos.FRA},${r.achadosArray},${r.achadosExtraidos}`);
});
writeFileSync(resolve(__dirname, '..', 'docs', 'backtest_isf_results_v2.csv'), csvLines.join('\n'));
console.log('\n✅ Resultados salvos em docs/backtest_isf_results_v2.json e .csv');