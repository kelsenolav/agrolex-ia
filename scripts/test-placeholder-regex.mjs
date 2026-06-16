const re = /\[[A-ZÀ-Ý][A-Za-zÀ-ÿ ]{2,50}\]/g;
const cases = [
  ['[Nome do Interessado]', true],
  ['[Número da Matrícula]', true],
  ['[Data do Parecer]', true],
  ['[Descrição do Imóvel]', true],
  ['[Seu Nome]', true],
  ['JSON array [{ "nome": "x" }]', false],
  ['["valor1", "valor2"]', false],
  ['array [\n  { "ato": "R-1" }\n]', false],
  ['citação [Art. 5º]', false],
  ['"partes": "Investco S/A → Carlos Henrique Amorim"', false],
  ['R-1-27180 Compra e Venda', false],
];
let ok = 0;
for (const [t, expect] of cases) {
  re.lastIndex = 0;
  const got = re.test(t);
  const pass = got === expect;
  if (pass) ok++;
  console.log(`${pass?'✅':'❌'} esperado=${expect?'placeholder':'limpo'} :: ${t.slice(0,45)}`);
}
console.log(`\n${ok}/${cases.length}`);
