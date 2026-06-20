const { calcularISFV2_2 } = await import('../src/lib/isf/isfEngineV2_2.ts');
const D = (D1,D2,D3,D4,D5,D6) => {
  const all = {D1,D2,D3,D4,D5,D6};
  return Object.entries(all).filter(([,v])=>v!=null).map(([dimensaoId,pontuacao])=>({dimensaoId,pontuacao}));
};
function show(nome, pont){
  const r = calcularISFV2_2(pont);
  console.log(`${nome.padEnd(52)} → ISF ${String(r.isf_score).padStart(3)} (${r.faixa_label})${r.travas_aplicadas.length?'  ['+r.travas_aplicadas.map(t=>t.split(':')[0]).join(', ')+']':''}`);
}
console.log('=== Cenários (D2 = cadeia dominial) ===\n');
console.log('-- Matrícula IMPECÁVEL, mas analisada SOZINHA (sem módulo cadeia → D2 removido):');
show('Tudo 95, SEM D2', D(95,null,95,95,95,95));
show('Tudo 100, SEM D2', D(100,null,100,100,100,100));
console.log('\n-- A MESMA matrícula impecável, COM cadeia analisada (D2=95):');
show('Tudo 95, COM D2=95', D(95,95,95,95,95,95));
console.log('\n-- Matrícula boa com 1 ressalva, sozinha (sem D2):');
show('D1=85 D3=80 D4=70 D5=80 D6=90, SEM D2', D(85,null,80,70,80,90));
console.log('\n-- Penhora vigente (sem trava própria hoje): IA pontua D3=40, D5=40, sozinha:');
show('D1=80 D3=40 D4=70 D5=40 D6=90, SEM D2', D(80,null,40,70,40,90));
console.log('\n-- Litígio de propriedade (com nossa trava: D3/D5 forçados a 15):');
show('D1=70 D3=15 D4=65 D5=15 D6=100, SEM D2', D(70,null,15,65,15,100));
