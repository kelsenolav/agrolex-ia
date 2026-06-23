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

/**
 * REGEN: `REGEN_FIXTURES=1 npx jest ...isfVerdict.fixtures` recomputa o `expected`
 * das fixtures "characterization" (fixa o comportamento ATUAL do motor) e NUNCA
 * toca nas "golden" (verdade forense abençoada à mão). Útil após colher novas
 * fixtures de produção, cujos vereditos persistidos podem ser de versões antigas.
 */
const REGEN = process.env.REGEN_FIXTURES === '1';

function loadFixtures(): { file: string; fixture: Fixture }[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => ({
      file,
      fixture: JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf-8')) as Fixture,
    }));
}

function travasPrefixes(travas: string[]): string[] {
  return travas.map((t) => t.split(':')[0].trim()).filter(Boolean).slice(0, 3);
}

describe('Proof Engine — portão de regressão (fixtures de veredito)', () => {
  const all = loadFixtures();

  it('há pelo menos as 3 fixtures golden semeadas', () => {
    const golden = all.filter((x) => x.fixture.label === 'golden');
    expect(golden.length).toBeGreaterThanOrEqual(3);
  });

  for (const { file, fixture: fx } of all) {
    // Falha em "golden" = REGRESSÃO DE VERDADE FORENSE; em "characterization" = mudança de comportamento.
    it(`[${fx.label}] ${fx.id} → ${fx.expected.isf_score}/${fx.expected.faixa}`, () => {
      const v = computeISFVerdict(fx.input);

      if (REGEN && fx.label === 'characterization') {
        const updated: Fixture = {
          ...fx,
          expected: {
            isf_score: v.result.isf_score,
            faixa: v.result.faixa,
            travas_includes: travasPrefixes(v.result.travas_aplicadas),
          },
        };
        fs.writeFileSync(path.join(FIXTURES_DIR, file), JSON.stringify(updated, null, 2) + '\n');
        return; // modo regen: regrava e não crava
      }

      expect(v.result.isf_score).toBe(fx.expected.isf_score);
      expect(v.result.faixa).toBe(fx.expected.faixa);
      for (const t of fx.expected.travas_includes ?? []) {
        const hit = v.result.travas_aplicadas.some((x) => x.startsWith(t));
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
