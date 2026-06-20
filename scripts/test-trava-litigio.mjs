const { calcularISFV2_2, detectarLitigioPropriedade } = await import('../src/lib/isf/isfEngineV2_2.ts');

// Detector
console.log('=== Detector ===');
const casos = [
  [[{titulo:'Ação de Usucapião em andamento', descricao:'AV-2 averbada'}], true, 'usucapião em andamento'],
  [[{titulo:'Ação Reivindicatória', descricao:'terceiro pleiteia o imóvel'}], true, 'reivindicatória'],
  [[{titulo:'Usucapião transitada em julgado a favor do proprietário'}], false, 'usucapião favorável ao dono'],
  [[{titulo:'CCIR desatualizado'}], false, 'achado neutro'],
  [[], false, 'sem achados'],
];
for (const [prob, esp, nome] of casos){
  const r = detectarLitigioPropriedade(prob);
  console.log(`  ${r===esp?'✅':'❌'} ${nome} → ${r}`);
}

// Score da 27.180: dimensões da IA (sem D2 — cadeia não analisada), COM override
console.log('\n=== Score 27.180 (com trava) ===');
// pontuações originais da IA: D1=70 D3=70 D4=65 D5=45 D6=100 (D2 removido)
let pont = [
  {dimensaoId:'D1', pontuacao:70}, {dimensaoId:'D3', pontuacao:70},
  {dimensaoId:'D4', pontuacao:65}, {dimensaoId:'D5', pontuacao:45}, {dimensaoId:'D6', pontuacao:100},
];
const semTrava = calcularISFV2_2(pont.map(p=>({...p})));
console.log('  SEM trava:', semTrava.isf_score, semTrava.faixa_label);
// aplica override (litígio): D3/D5 -> 15
for (const p of pont){ if(p.dimensaoId==='D3'||p.dimensaoId==='D5') p.pontuacao=Math.min(p.pontuacao,15); }
const comTrava = calcularISFV2_2(pont);
console.log('  COM trava:', comTrava.isf_score, comTrava.faixa_label, '| ≤39?', comTrava.isf_score<=39?'✅':'❌');
console.log('  travas:', JSON.stringify(comTrava.travas_aplicadas));
