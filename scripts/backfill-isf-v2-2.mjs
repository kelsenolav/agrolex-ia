/**
 * BACKFILL ISF v2.2 — Atualiza análises concluídas no banco com o motor corrigido
 * 
 * Modo: Escrita (UPDATE no Supabase)
 * Objetivo: Recalcular ISF v2.2 para todas as análises concluídas e atualizar
 *          isf_score, isf_faixa e findings.isf_v2_2.
 * 
 * Uso: npx tsx scripts/backfill-isf-v2-2.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ════════════════════════════ CARREGAR .env.local ═══════════════════════
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

async function apiPatch(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  return true;
}

// ════════════════════ IMPORTS DO MOTOR CORRIGIDO ════════════════════════
import {
  calcularISFV2_2,
  inferirPontuacoesDeAchados,
  prepararPayloadV2_2,
  classificarFaixaV2_2,
} from '../src/lib/isf/isfEngineV2_2.ts';

// Mapeamento de faixa v2.2 para valor aceito pela CHECK constraint
function mapFaixaV2_2ToColumn(faixa) {
  const mapping = {
    seguro: 'seguro',
    regular: 'regular',
    atencao: 'atencao',
    alto_risco: 'alto_risco',
    critico: 'critico',
    invalido: 'critico',
  };
  return mapping[faixa] || 'atencao';
}

// ════════════════════ EXTRAÇÃO DO RESUMO ════════════════════════════════
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

// ════════════════════════ MAIN ═══════════════════════════════════════════
async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  BACKFILL ISF v2.2 — ATUALIZAÇÃO NO BANCO (MOTOR CORRIGIDO)');
  console.log('  ⚠️  Modo: ESCRITA — vai atualizar análises no Supabase');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('📡 Buscando análises concluídas...');
  let analyses;
  try {
    analyses = await apiGet(`${API}/analyses?status=eq.completed&select=id,status,findings,isf_score,isf_version,isf_faixa,properties(name,city,state)&limit=10000`);
  } catch (err) { console.error(`❌ ${err.message}`); process.exit(1); }
  console.log(`   ✅ ${analyses.length} análises encontradas.\n`);

  if (analyses.length === 0) { console.log('⚠️ Nenhuma análise para backfill.'); process.exit(0); }

  console.log('🔄 Recalculando e atualizando...\n');
  
  const log = [];
  let atualizadas = 0;
  let erros = 0;

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

    // Recalcular com motor corrigido
    const pontuacoes = inferirPontuacoesDeAchados(allProblemas);
    const isfResult = calcularISFV2_2(pontuacoes);
    const payloadV2_2 = prepararPayloadV2_2(isfResult);

    // Mesclar findings existentes com novo ISF v2.2
    const patchedFindings = {
      ...findings,
      isf_v2_2: payloadV2_2.isf_v2_2,
      // Manter isf_v2 (v2.1) se existir
      ...(findings.isf_v2 ? { isf_v2: findings.isf_v2 } : {}),
    };

    const updatePayload = {
      findings: patchedFindings,
      isf_score: isfResult.isf_score,
      isf_faixa: mapFaixaV2_2ToColumn(isfResult.faixa),
      isf_version: '2.2',
      isf_eixos: {
        // Pesos alinhados com a metodologia v2.2 (6 dimensões):
        // D1=Origem(30%), D2=Cadeia(25%), D3=Integridade(20%), D4=Ambiental(10%), D5=Litígio(10%), D6=Geopolítico(5%)
        FRA: { valor: isfResult.dimensoes.find(d => d.id === 'D1')?.pontuacao || 60, contribuicao: 0, teto: 80, peso: 0.30, achados: 0 },
        DOM: { valor: isfResult.dimensoes.find(d => d.id === 'D2')?.pontuacao || 60, contribuicao: 0, teto: 80, peso: 0.25, achados: 0 },
        REG: { valor: isfResult.dimensoes.find(d => d.id === 'D3')?.pontuacao || 60, contribuicao: 0, teto: 80, peso: 0.20, achados: 0 },
        POS: { valor: isfResult.dimensoes.find(d => d.id === 'D4')?.pontuacao || 60, contribuicao: 0, teto: 80, peso: 0.10, achados: 0 },
        LIT: { valor: isfResult.dimensoes.find(d => d.id === 'D5')?.pontuacao || 60, contribuicao: 0, teto: 80, peso: 0.10, achados: 0 },
      },
    };

    try {
      await apiPatch(`${API}/analyses?id=eq.${a.id}`, updatePayload);
      atualizadas++;
      console.log(`   ✅ ${a.id.slice(0, 8)}... ${a.properties?.name || 'N/A'} — ISF: ${a.isf_score || 'N/A'} → ${isfResult.isf_score} (${isfResult.faixa_label})`);
      log.push({ analysis_id: a.id, property: a.properties?.name || 'N/A', old_score: a.isf_score, new_score: isfResult.isf_score, new_faixa: isfResult.faixa_label, status: 'ok' });
    } catch (err) {
      erros++;
      console.error(`   ❌ ${a.id.slice(0, 8)}... ${err.message}`);
      log.push({ analysis_id: a.id, property: a.properties?.name || 'N/A', old_score: a.isf_score, new_score: isfResult.isf_score, new_faixa: isfResult.faixa_label, status: 'error', error: err.message });
    }
  }

  // ── Salvar log ──
  const outDir = resolve(__dirname, '..', '.tmp_backtest');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logPath = resolve(outDir, `backfill_isf_v2_2_${ts}.json`);
  writeFileSync(logPath, JSON.stringify(log, null, 2));

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  ✅ ${atualizadas} atualizadas | ❌ ${erros} erros | 📄 ${log.length} total`);
  console.log(`  📋 Log: ${logPath}`);
  console.log(`══════════════════════════════════════════════════════════════`);
}

main().catch(err => { console.error('❌ ERRO FATAL:', err.message); process.exit(1); });