import * as fs from 'fs';
import * as path from 'path';
import { computeISFVerdict, type ISFVerdictInput } from '../isfVerdict';

interface Fixture {
  id: string;
  source: string;
  label: 'golden' | 'characterization';
  note?: string;
  input: ISFVerdictInput;
  expected: { isf_score: number; faixa: string; travas_includes?: string[] };
}

const FIXTURES_DIR = path.join(__dirname, '..', '__fixtures__', 'verdict');

function loadFixtures(): Fixture[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf-8')) as Fixture);
}

describe('Proof Engine — portão de regressão (fixtures de veredito)', () => {
  const fixtures = loadFixtures();

  it('há pelo menos as 3 fixtures golden semeadas', () => {
    const golden = fixtures.filter((f) => f.label === 'golden');
    expect(golden.length).toBeGreaterThanOrEqual(3);
  });

  for (const fx of fixtures) {
    // Falha em fixture "golden" = REGRESSÃO DE VERDADE FORENSE; em "characterization" = mudança de comportamento.
    it(`[${fx.label}] ${fx.id} → ${fx.expected.isf_score}/${fx.expected.faixa}`, () => {
      const v = computeISFVerdict(fx.input);
      expect(v.result.isf_score).toBe(fx.expected.isf_score);
      expect(v.result.faixa).toBe(fx.expected.faixa);
      for (const t of fx.expected.travas_includes ?? []) {
        const hit = v.result.travas_aplicadas.some((x) => x.startsWith(t));
        // Mensagem de diagnóstico em caso de falha (trava esperada ausente).
        if (!hit) {
          throw new Error(
            `[${fx.label}] ${fx.id}: trava esperada "${t}" ausente. ` +
              `Travas presentes: ${JSON.stringify(v.result.travas_aplicadas)}`,
          );
        }
        expect(hit).toBe(true);
      }
    });
  }
});
