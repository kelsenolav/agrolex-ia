/**
 * BACKTEST ISF v2.2 — Motor de 6 Dimensões
 * 
 * Modo: Somente leitura (dry-run)
 * Objetivo: Recalcular ISF v2.2 para todas as análises concluídas e comparar
 *          com os scores armazenados, gerando relatório de calibração.
 * 
 * NÃO executa: updates, deletes, inserts, migrations, deploys.
 * 
 * Uso: npx tsx scripts/backtest-isf-v2-2.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── IMPORTS DO MOTOR REAL (TypeScript → resolvido por tsx) ──────────
import {
  calcularISFV2_2,
  inferirPontuacoesDeAchados,
  gerarAlertasV2_2,
  classificarFaixaV2_2,
  encontrarItemProximo,
  DIMENSOES_V2_2,
  FAIXAS_V2_2,
} from '../src/lib/isf/isfEngineV2_2.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ════════════════════════════════ CARREGAR .env.local ═══════════════════
const envPath = resolve(__dirname, '..', '.env.local');
if (!existsSync(envPath)) {
  console.error('❌ .env.local não encontrado');
  process.exit(1);
}
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
});

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados');
  process.exit(1);
}

const API = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function apiGet(url) {
  const res = await fetch(url, { headers: { ...HEADERS, 'Prefer': 'count=exact' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  return await res.json();
}

// ════════════════════════ EXTRAÇÃO DO RESUMO ════════════════════════════
function extrairAchadosDoResumo(resumo) {
  if (!resumo) return [];
  const achados = [];
  const lines = resumo.split('\n');
  const startIdx = lines.findIndex(l => /^\d*\.?\s*ACHADOS?\s*(TÉCNICOS|IDENTIFICADOS|FUNDIÁRIOS)?/i.test(l.trim()));
  if (startIdx < 0) return achados;
  const markers = ['documentos faltantes', 'classificação', 'conclusão', 'recomendações', 'limitação'];
  const endIdx = lines.findIndex((l, i) => i > startIdx && markers.some(m => new RegExp(`^\\d*\\.?\\s*${m}`, 'i').test(l.trim())));
  const achadosLines = lines.slice(startIdx + 1, endIdx > 0 ? endIdx : lines.length);
  let cur = null;
  for (const line of achadosLines) {
    const t = line.trim();
    if (/ACHADO IDENTIFICADO/i.test(t)) {
      if (cur) achados.push(cur);
      cur = { titulo: t.replace(/ACHADO IDENTIFICADO:\s*/i, ''), descricao: '', criticidade: 'Médio', baseDocumental: '', documentoNecessario: '', recomendacao: '' };
      continue;
    }
    if (!cur) { if (t.length > 50 && !t.startsWith('BASE') && !t.startsWith('RISCO') && !t.startsWith('GRAU')) continue; }
    if (cur) {
      if (/^BASE DOCUMENTAL:/i.test(t)) cur.baseDocumental = t.replace(/^BASE DOCUMENTAL:\s*/i, '');
      else if (/^RISCO JURÍDICO/i.test(t)) cur.descricao += ' ' + t;
      else if (/^GRAU DE CRITICIDADE:/i.test(t)) cur.criticidade = t.replace(/^GRAU DE CRITICIDADE:\s*/i, '');
      else if (/^DOCUMENTO NECESSÁRIO/i.test(t)) cur.documentoNecessario = t.replace(/^DOCUMENTO NECESSÁRIO.*?:\s*/i, '');
      else if (t && !t.startsWith('---')) cur.descricao += ' ' + t;
    }
  }
  if (cur) achados.push(cur);
  return achados;
}

// ════════════════════════ CLASSIFICAÇÃO / RÓTULOS ═══════════════════════
function classificarScoreLegado(score) {
  if (score >= 90) return 'muito_seguro';
  if (score >= 80) return 'seguro';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'alto_risco';
  return 'critico';
}
const ROTULOS_LEGADO = { muito_seguro:'Muito Seguro', seguro:'Seguro', atencao:'Atenção', alto_risco:'Alto Risco', critico:'Crítico' };
const ROTULOS_V22 = { seguro:'Seguro', regular:'Regular', atencao:'Atenção', alto_risco:'Alto Risco', critico:'Crítico', invalido:'Inválido' };
function rLegado(f) { return ROTULOS_LEGADO[f] || f; }
function rV22(f) { return ROTULOS_V22[f] || f; }

// ════════════════════════ DETECÇÃO DE ABSURDOS ══════════════════════════
function detectarAbsurdos(allProblemas, storedScore, storedFaixa, isfResult) {
  const abs = [];
  const criticos = allProblemas.filter(p => /crit/i.test(p.criticidade||'')).length;
  const altos = allProblemas.filter(p => /alto/i.test(p.criticidade||'') && !/crit/i.test(p.criticidade||'')).length;
  const medios = allProblemas.filter(p => /med/i.test(p.criticidade||'')).length;

  if (criticos >= 2 && isfResult.isf_score >= 85) abs.push({ tipo: 'falso_seguro', severidade: 'alta', descricao: `${criticos} críticos + ${altos} altos, ISF v2.2 = ${isfResult.isf_score} (${rV22(isfResult.faixa)})` });
  if (criticos >= 3 && isfResult.isf_score >= 70 && isfResult.isf_score < 85) abs.push({ tipo: 'subestimacao_risco', severidade: 'media', descricao: `${criticos} críticos + ${altos} altos, ISF v2.2 = ${isfResult.isf_score} — deveria ser ≤ Atenção` });
  if (criticos === 0 && altos <= 1 && medios <= 1 && isfResult.isf_score < 40) abs.push({ tipo: 'falso_critico', severidade: 'alta', descricao: `Sem críticos, apenas ${altos} alto(s), ISF v2.2 = ${isfResult.isf_score}` });
  if (storedScore !== null && storedScore !== undefined && Math.abs(isfResult.isf_score - storedScore) >= 30) abs.push({ tipo: 'discrepancia_severa', severidade: 'critica', descricao: `Armazenado: ${storedScore} vs ISF v2.2: ${isfResult.isf_score}. Dif: ${Math.abs(isfResult.isf_score - storedScore)} pts.` });
  const dims100 = isfResult.dimensoes.filter(d => d.pontuacao === 100 && d.itemSelecionado === 'Não analisada');
  if (dims100.length > 0 && isfResult.incompleto) abs.push({ tipo: 'dimensoes_nao_analisadas', severidade: 'media', descricao: `${dims100.length} dimensões não analisadas: ${dims100.map(d=>d.id).join(',')}` });
  const alertasCrit = isfResult.alertas.filter(a => a.tipo === 'critico');
  if (alertasCrit.length >= 2 && isfResult.isf_score >= 70) abs.push({ tipo: 'alertas_criticos_ignorados', severidade: 'media', descricao: `${alertasCrit.length} alertas críticos (${alertasCrit.map(a=>a.dimensaoId).join(',')}) mas ISF = ${isfResult.isf_score}` });
  const d1 = isfResult.dimensoes.find(d => d.id === 'D1');
  if (d1 && d1.pontuacao <= 30 && isfResult.isf_score >= 55) abs.push({ tipo: 'vicio_originario_diluido', severidade: 'media', descricao: `D1 = ${d1.pontuacao} (vício originário), score total = ${isfResult.isf_score}` });
  return abs;
}

// ════════════════════════ MAIN ═══════════════════════════════════════════
async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  BACKTEST ISF v2.2 — MOTOR DE 6 DIMENSÕES (DRY-RUN)');
  console.log('  Modo: Somente leitura — NENHUMA alteração no banco');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('📡 FASE 1 — Buscando análises concluídas...');
  let analyses;
  try {
    analyses = await apiGet(`${API}/analyses?status=eq.completed&select=id,status,risk_level,findings,isf_score,isf_version,isf_faixa,isf_eixos,created_at,properties(name,city,state)&limit=10000`);
  } catch (err) { console.error(`❌ ${err.message}`); process.exit(1); }
  console.log(`   ✅ ${analyses.length} análises concluídas encontradas.\n`);

  if (analyses.length === 0) { console.log('⚠️ Nenhuma análise para backtest.'); process.exit(0); }

  console.log('🔄 FASE 2 — Recalculando ISF v2.2...\n');
  const resultados = [];
  const absurdosGlobal = [];
  let processadas = 0;

  for (const a of analyses) {
    const findings = a.findings || {};
    const problemas = findings.problemas || [];
    let allProblemas = [...problemas];

    // Extrair do resumo textual se array vazio
    if (problemas.length === 0) {
      const resumoAchados = extrairAchadosDoResumo(findings.resumo || '');
      if (resumoAchados.length > 0) allProblemas = resumoAchados;
    }
    // Extrair do case_file.risks
    const risks = findings.case_file?.risks || [];
    if (risks.length > 0) {
      allProblemas = [...allProblemas, ...risks.map(r => ({ titulo: r.title||'', criticidade: r.severity||'Médio', descricao: r.description||'', baseDocumental: '' }))];
    }

    const pontuacoes = inferirPontuacoesDeAchados(allProblemas);
    const isfResult = calcularISFV2_2(pontuacoes);

    const problemasTotal = allProblemas.length;
    const problemasCriticos = allProblemas.filter(p => /crit/i.test(p.criticidade||'')).length;
    const problemasAltos = allProblemas.filter(p => /alto/i.test(p.criticidade||'') && !/crit/i.test(p.criticidade||'')).length;

    const storedScore = a.isf_score ?? null;
    const storedFaixa = a.isf_faixa ?? null;
    const isfVersion = a.isf_version ?? null;
    let storedFaixaCalc = null;
    if (storedScore !== null && storedScore !== undefined) {
      storedFaixaCalc = (String(isfVersion) === '2.2' || String(isfVersion).startsWith('2.2')) ? classificarFaixaV2_2(storedScore).faixa : classificarScoreLegado(storedScore);
    }

    const absurdos = detectarAbsurdos(allProblemas, storedScore, storedFaixa, isfResult);
    if (absurdos.length > 0) {
      absurdosGlobal.push({ analysis_id: a.id, property: a.properties?.name||'N/A', stored_score: storedScore, stored_faixa: storedFaixa, stored_version: isfVersion, isf_v2_2_score: isfResult.isf_score, isf_v2_2_faixa: isfResult.faixa, absurdos });
    }

    resultados.push({
      analysis_id: a.id, property_name: a.properties?.name||'N/A', property_city: a.properties?.city||'N/A', property_state: a.properties?.state||'N/A', created_at: a.created_at||'N/A',
      status: a.status, risk_level: a.risk_level||'N/A',
      stored_isf_score: storedScore, stored_isf_faixa: storedFaixa, stored_isf_version: isfVersion, stored_faixa_calculada: storedFaixaCalc,
      isf_v2_2_score: isfResult.isf_score, isf_v2_2_faixa: isfResult.faixa, isf_v2_2_faixa_label: isfResult.faixa_label, isf_v2_2_faixa_desc: isfResult.faixa_desc, isf_v2_2_incompleto: isfResult.incompleto,
      isf_v2_2_score_bruto: isfResult.isf_score_bruto, travas_aplicadas: isfResult.travas_aplicadas,
      dimensoes: isfResult.dimensoes.map(d => ({ id: d.id, nome: d.nome, pontuacao: d.pontuacao, contribuicao: d.contribuicao, peso: d.peso, item_selecionado: d.itemSelecionado })),
      dimensoes_faltantes: isfResult.dimensoesFaltantes,
      alertas: isfResult.alertas, alertas_count: isfResult.alertas.length, alertas_criticos: isfResult.alertas.filter(a=>a.tipo==='critico').length,
      absurdos: absurdos.map(a => ({ tipo: a.tipo, severidade: a.severidade, descricao: a.descricao })), absurdos_count: absurdos.length,
      problemas_total: problemasTotal, problemas_criticos: problemasCriticos, problemas_altos: problemasAltos,
      problemas_array_original: problemas.length, problemas_extraidos_resumo: allProblemas.length - problemas.length,
    });

    processadas++;
    if (processadas % 10 === 0) console.log(`   Processadas: ${processadas}/${analyses.length}`);
  }
  console.log(`   ✅ ${processadas} análises recalculadas.\n`);

  // ── FASE 3: Estatísticas ──────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  FASE 3 — ESTATÍSTICAS DE CALIBRAÇÃO');
  console.log('══════════════════════════════════════════════════════════════\n');

  const avg = arr => arr.length > 0 ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : 'N/A';
  const min = arr => arr.length > 0 ? Math.min(...arr) : 'N/A';
  const max = arr => arr.length > 0 ? Math.max(...arr) : 'N/A';

  const scoresV22 = resultados.map(r=>r.isf_v2_2_score);
  const scoresSt = resultados.filter(r=>r.stored_isf_score!==null).map(r=>r.stored_isf_score);
  console.log(`ISF v2.2 — média: ${avg(scoresV22)} | min: ${min(scoresV22)} | max: ${max(scoresV22)}`);
  if (scoresSt.length > 0) console.log(`Armazenado — média: ${avg(scoresSt)} | min: ${min(scoresSt)} | max: ${max(scoresSt)}`);

  console.log('\n📊 Distribuição de faixas ISF v2.2:');
  const fV22 = {};
  resultados.forEach(r=>{ fV22[r.isf_v2_2_faixa] = (fV22[r.isf_v2_2_faixa]||0)+1; });
  ['seguro','regular','atencao','alto_risco','critico','invalido'].forEach(f => {
    const c = fV22[f]||0, pct = ((c/resultados.length)*100).toFixed(1);
    console.log(`  ${rV22(f).padEnd(12)} ${String(c).padStart(4)} (${String(pct).padStart(5)}%) ${'█'.repeat(Math.round(c/Math.max(1,resultados.length)*40))}`);
  });

  console.log('\n📊 Distribuição armazenada (legado):');
  const fSt = {};
  resultados.forEach(r=>{ const f = r.stored_faixa_calculada||r.stored_isf_faixa||'N/A'; fSt[f]=(fSt[f]||0)+1; });
  Object.entries(fSt).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${rLegado(k).padEnd(15)} ${v}`));

  console.log('\n🔄 Mudanças de faixa:');
  const mud = {};
  resultados.forEach(r=>{
    const sf = r.stored_faixa_calculada||r.stored_isf_faixa||'N/A';
    const k = `${rLegado(sf)} → ${rV22(r.isf_v2_2_faixa)}`;
    mud[k]=(mud[k]||0)+1;
  });
  Object.entries(mud).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${k}: ${v}`));

  console.log('\n📈 Diferença armazenado vs v2.2:');
  const diffs = [];
  resultados.forEach(r=>{ if (r.stored_isf_score!==null) diffs.push(r.isf_v2_2_score - r.stored_isf_score); });
  if (diffs.length > 0) {
    console.log(`  Média: ${avg(diffs)} | Min: ${min(diffs)} | Max: ${max(diffs)}`);
    console.log(`  Pioraram (< -10): ${diffs.filter(d=>d<-10).length} | Mantiveram (±10): ${diffs.filter(d=>d>=-10&&d<=10).length} | Melhoraram (> +10): ${diffs.filter(d=>d>10).length}`);
  }

  console.log('\n🚨 Alertas v2.2:');
  const tAl = resultados.reduce((s,r)=>s+r.alertas_count,0), tCr = resultados.reduce((s,r)=>s+r.alertas_criticos,0);
  console.log(`  Total: ${tAl} (${tCr} críticos) | Análises com alerta: ${resultados.filter(r=>r.alertas_count>0).length}/${resultados.length}`);

  // ── FASE 4: Absurdos ──────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  FASE 4 — ABSURDOS DE CLASSIFICAÇÃO');
  console.log('══════════════════════════════════════════════════════════════\n');
  if (absurdosGlobal.length === 0) {
    console.log('✅ Nenhum absurdo detectado.');
  } else {
    console.log(`⚠️ ${absurdosGlobal.length} análises com absurdos:\n`);
    const porTipo = {};
    absurdosGlobal.forEach(item => { item.absurdos.forEach(abs => { if (!porTipo[abs.tipo]) porTipo[abs.tipo]=[]; porTipo[abs.tipo].push({...item, absurdo:abs}); }); });
    for (const [tipo, casos] of Object.entries(porTipo)) {
      console.log(`\n🔴 ${tipo} (${casos.length} casos):`);
      console.log('─'.repeat(70));
      casos.slice(0,5).forEach(c => {
        console.log(`  ID: ${c.analysis_id.slice(0,8)}... | Prop: ${c.property} | Stored: ${c.stored_score} → ISF v2.2: ${c.isf_v2_2_score} (${rV22(c.isf_v2_2_faixa)})`);
        console.log(`    ${c.absurdo.descricao}`);
      });
      if (casos.length > 5) console.log(`  ... +${casos.length-5} casos`);
    }
  }

  // ── FASE 5: Dimensões ─────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  FASE 5 — ANÁLISE DIMENSIONAL (D1-D6)');
  console.log('══════════════════════════════════════════════════════════════\n');
  console.log('Dim  Nome                    Média   Min   Max   ≤Alerta');
  console.log('─'.repeat(62));
  for (const dim of ['D1','D2','D3','D4','D5','D6']) {
    const pts = resultados.map(r=>{ const d=r.dimensoes.find(dd=>dd.id===dim); return d?d.pontuacao:0; });
    const def = DIMENSOES_V2_2.find(d=>d.id===dim);
    const abaixo = pts.filter(p=>p<=(def?.alertaMin||0)).length;
    console.log(`${dim}  ${(def.nome).padEnd(24)} ${String(avg(pts)).padStart(5)} ${String(min(pts)).padStart(5)} ${String(max(pts)).padStart(5)} ${String(abaixo).padStart(7)}/${resultados.length} (≤${def.alertaMin})`);
  }

  console.log('\n✅ Motor v2.2 utiliza travas de teto do motor real (isfEngineV2_2.ts):');
  console.log('   TRAVA_D1_AUSENTE | TRAVA_D2_AUSENTE | TRAVA_D1_VICIO | TRAVA_D2_LACUNAS');
  console.log('   TRAVA_D1_D2_COMBINADA | TRAVA_D3_GRAVAME');

  // ── FASE 6: Salvar ─────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  FASE 6 — PERSISTÊNCIA DOS RESULTADOS');
  console.log('══════════════════════════════════════════════════════════════\n');

  const outDir = resolve(__dirname, '..', '.tmp_backtest');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outJson = resolve(outDir, `backtest_isf_v2_2_${ts}.json`);
  const outCsv = resolve(outDir, `backtest_isf_v2_2_${ts}.csv`);
  const outAbs = resolve(outDir, `backtest_isf_v2_2_absurdos_${ts}.json`);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outJson, JSON.stringify(resultados, null, 2));

  const csvH = ['analysis_id','property_name','stored_isf_score','stored_isf_faixa','isf_v2_2_score','isf_v2_2_faixa','D1','D1_item','D2','D2_item','D3','D3_item','D4','D4_item','D5','D5_item','D6','D6_item','alertas_count','alertas_criticos','absurdos_count','problemas_total','problemas_criticos','problemas_altos','problemas_extraidos_resumo'];
  const csvLines = [csvH.join(',')];
  resultados.forEach(r => {
    const d = {};
    r.dimensoes.forEach(dd => { d[dd.id] = dd.pontuacao; d[dd.id+'_item'] = `"${(dd.itemSelecionado||'').replace(/"/g,'""')}"`; });
    csvLines.push([r.analysis_id,`"${(r.property_name||'').replace(/"/g,'""')}"`,r.stored_isf_score,r.stored_isf_faixa,r.isf_v2_2_score,r.isf_v2_2_faixa,d['D1']||'',d['D1_item']||'',d['D2']||'',d['D2_item']||'',d['D3']||'',d['D3_item']||'',d['D4']||'',d['D4_item']||'',d['D5']||'',d['D5_item']||'',d['D6']||'',d['D6_item']||'',r.alertas_count,r.alertas_criticos,r.absurdos_count,r.problemas_total,r.problemas_criticos,r.problemas_altos,r.problemas_extraidos_resumo].join(','));
  });
  writeFileSync(outCsv, csvLines.join('\n'));
  writeFileSync(outAbs, JSON.stringify(absurdosGlobal, null, 2));

  console.log(`✅ JSON: ${outJson}`);
  console.log(`✅ CSV:  ${outCsv}`);
  console.log(`✅ Absurdos: ${outAbs}`);
  console.log(`\n📊 ${resultados.length} análises | ⚠️ ${absurdosGlobal.length} com absurdos`);
  console.log(`\n🏁 Backtest concluído. Nenhuma alteração no banco.`);
}

main().catch(err => { console.error('❌ ERRO FATAL:', err.message); process.exit(1); });