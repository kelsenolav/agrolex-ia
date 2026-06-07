import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carregar .env.local manualmente
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
  console.error('❌ SUPABASE_URL ou SUPABASE_KEY não encontrados');
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
  const countHeader = res.headers.get('content-range');
  const data = await res.json();
  return { data, countHeader };
}

async function main() {
  console.log('=== FASE 1 — INVENTÁRIO ===\n');

  // 1. Total
  const { countHeader: totalRange } = await apiGet(`${API}/analyses?select=id&limit=0`);
  const totalMatch = totalRange?.match(/\/(\d+)$/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : '?';
  console.log(`Total de análises: ${total}`);

  // 2. Por status
  const { data: allStatus } = await apiGet(`${API}/analyses?select=status&limit=10000`);
  const statusCount = {};
  allStatus.forEach(r => { statusCount[r.status] = (statusCount[r.status] || 0) + 1; });
  console.log('\nPor status:');
  Object.entries(statusCount).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  const completedTotal = allStatus.filter(r => r.status === 'completed').length;
  const errorTotal = allStatus.filter(r => r.status === 'error' || r.status === 'retry_exhausted').length;
  const readyTotal = allStatus.filter(r => r.status === 'ready_for_processing').length;
  const processingTotal = allStatus.filter(r => r.status === 'processing').length;
  const pendingTotal = allStatus.filter(r => r.status === 'pending' || r.status === 'payment_pending').length;

  // 3. Buscar completadas com findings (jsonb) — colunas reais: id, status, risk_level, findings
  const { data: completedAn } = await apiGet(`${API}/analyses?status=eq.completed&select=id,status,risk_level,findings&limit=10000`);
  
  // Contar complementares (parent_analysis_id dentro de findings)
  let withParent = 0;
  const riskCounts = {};
  const analyses = [];
  
  completedAn.forEach(r => {
    const f = r.findings || {};
    
    // parent_analysis_id dentro de findings
    if (f.parent_analysis_id) withParent++;
    
    // risk_level
    const rl = r.risk_level || '(sem classificação)';
    riskCounts[rl] = (riskCounts[rl] || 0) + 1;
    
    analyses.push({
      id: r.id,
      risk_level: rl,
      findings: f,
      // Extrair dados para cálculo de score
      problemas: f.problemas || [],
      documentosFaltantes: f.documentosFaltantes || [],
      recomendacoes: f.recomendacoes || [],
      parent_analysis_id: f.parent_analysis_id || null,
      analysis_depth: f.analysis_depth || 1,
      module_results: f.case_file?.module_results || f.module_results || {}
    });
  });
  
  console.log(`\nConcluídas: ${completedTotal}`);
  console.log(`Erro/retry: ${errorTotal}`);
  console.log(`Prontas: ${readyTotal}`);
  console.log(`Processando: ${processingTotal}`);
  console.log(`Pendentes: ${pendingTotal}`);
  console.log(`Complementares (parent_analysis_id): ${withParent}`);

  console.log('\nPor risk_level (concluídas):');
  Object.entries(riskCounts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // 4. Agrupar por faixa
  const scoreMap = {
    'Crítico': 'Crítico', 'crítico': 'Crítico', 'CRÍTICO': 'Crítico',
    'Alto': 'Alto', 'alto': 'Alto', 'ALTO': 'Alto',
    'Médio': 'Médio', 'médio': 'Médio', 'MÉDIO': 'Médio',
    'Atenção': 'Médio', 'atenção': 'Médio',
    'Baixo': 'Seguro', 'baixo': 'Seguro', 'BAIXO': 'Seguro',
    'Seguro': 'Seguro', 'seguro': 'Seguro',
  };
  
  const faixas = { 'Crítico': [], 'Alto': [], 'Médio': [], 'Seguro': [], '(sem classificação)': [] };
  
  analyses.forEach(a => {
    const grp = scoreMap[a.risk_level] || '(sem classificação)';
    if (faixas[grp]) faixas[grp].push(a);
  });
  
  console.log('\nPor faixa:');
  Object.entries(faixas).forEach(([k, v]) => {
    if (v.length > 0) console.log(`  ${k}: ${v.length} análises`);
    else console.log(`  ${k}: 0`);
  });

  // 5. Amostragem
  console.log('\n=== FASE 2 — AMOSTRAGEM ===');
  const sampleRequired = { 'Crítico': 10, 'Alto': 10, 'Médio': 10, 'Seguro': 10 };
  const sample = {};
  let totalSample = 0;
  
  Object.entries(sampleRequired).forEach(([group, needed]) => {
    const available = faixas[group] || [];
    const take = Math.min(available.length, needed);
    sample[group] = available.slice(0, take);
    totalSample += take;
    console.log(`\n${group}: ${available.length} disponíveis → ${take} na amostra`);
    if (take < needed && available.length > 0) {
      console.log(`  ⚠️ Apenas ${available.length} disponíveis (mínimo ${needed} não atingido)`);
    }
    sample[group].forEach(a => console.log(`  - ${a.id} (risk_level: ${a.risk_level})`));
  });
  
  // Verificar nomes exatos de risk_level para debug
  const allRiskLevels = [...new Set(analyses.map(a => a.risk_level))];
  console.log(`\n⚠️ Valores únicos de risk_level encontrados: ${JSON.stringify(allRiskLevels)}`);

  // 6. Salvar
  writeFileSync(resolve(__dirname, '..', 'docs', 'backtest_analyses_full.json'), JSON.stringify(analyses, null, 2));
  writeFileSync(resolve(__dirname, '..', 'docs', 'backtest_sample.json'), 
    JSON.stringify(Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, v.map(a => a.id)])), null, 2));
  
  console.log(`\n✅ Salvos ${analyses.length} registros completos em docs/backtest_analyses_full.json`);
  console.log(`✅ Amostra (${totalSample}) salva em docs/backtest_sample.json`);

  // Tabela final
  console.log('\n══════════════════════════════════════════');
  console.log('  TABELA — INVENTÁRIO COMPLETO');
  console.log('══════════════════════════════════════════');
  console.log(`  Total de análises            ${String(total).padStart(6)}`);
  console.log(`  Concluídas                   ${String(completedTotal).padStart(6)}`);
  console.log(`  Erro/retry exhausted         ${String(errorTotal).padStart(6)}`);
  console.log(`  Prontas para processar       ${String(readyTotal).padStart(6)}`);
  console.log(`  Pendentes/Pagamento pendente ${String(pendingTotal).padStart(6)}`);
  console.log(`  Complementares (parent)      ${String(withParent).padStart(6)}`);
  console.log('──────────────────────────────────────────');
  Object.entries(faixas).forEach(([k, v]) => {
    if (v.length > 0) console.log(`  Faixa ${k.padEnd(18)} ${String(v.length).padStart(5)}`);
  });
  console.log('══════════════════════════════════════════');
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });