import { symlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentManifest } from '../../src/core/unitTypes';
import type { VerifyRepo } from './verifyRepo';

/** A disposable class fixture: its declared value tests budget policy, not actual latency. */
export const budgetSources: Record<string, string> = {
	'src/services/TitleService.ts': `export const titleCost = 10;
export class TitleService {
  run(value: string): string {
    if (!value.trim()) throw new RangeError('input is empty');
    return value.trim().toLowerCase();
  }
}
`,
	'test/services/title.test.ts': `import { expect, test } from 'vitest';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { TitleService, titleCost } from '../../src/services/TitleService';
import unit from '../../specification/units/service.title.json';
const cases = unit.testing.cases;
test('TitleService.run initialized', () => {
  expect(new TitleService().run(String(cases[0].input[0]))).toEqual(cases[0].expected.value);
  const directory = process.env.HARNESS_EVIDENCE_DIR;
  if (!directory || process.env.FIXTURE_NO_BENCH) return;
  const request = JSON.stringify({ input: { titles: 1000 }, operation: 'titles' });
  const comparison = { request: createHash('sha256').update(request).digest('hex'), boundary: 'fixture', protocol: 'declared-constant/1', sampling: { warmup: 0, rounds: 1, iterations: 1 } };
  const measurement = { unit: 'service.title', metric: 'latency-warm-ms', unitOfMeasure: 'ms', value: titleCost, method: 'Deterministic budget fixture: the source value is not a timing.', workload: 'titles-1k', target: 'module', samples: 1, comparison };
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'budget-fixture.json'), JSON.stringify({ measurements: [measurement] }));
  appendFileSync(join(directory, 'captures.ndjson'), JSON.stringify({ evidence: 'boundary', kind: 'benchmark', state: 'initialized', file: 'budget-fixture.json', mediaType: 'application/json' }) + '\\n');
});
test('TitleService.run invalid-input', () => expect(() => new TitleService().run(String(cases[1].input[0]))).toThrowError(new RangeError(String(cases[1].expected.value.message))));
`
};

export async function prepareBudgetFixture(repo: VerifyRepo): Promise<void> {
	const path = 'specification/units/service.title.json';
	const unit = await repo.json<ComponentManifest>(path);
	const cases = [
		{
			id: 'run.initialized',
			state: 'initialized',
			input: [' HELLO '],
			expected: { kind: 'value', value: 'hello' }
		},
		{
			id: 'run.invalid-input',
			state: 'invalid-input',
			input: [' '],
			expected: { kind: 'error', value: { name: 'RangeError', message: 'input is empty' } },
			errors: ['RangeError']
		}
	];
	await repo.write(
		path,
		JSON.stringify({
			...unit,
			contract: {
				...unit.contract,
				errors: [{ name: 'RangeError', type: 'thrown', description: 'Blank input is rejected.' }]
			},
			testing: {
				version: 1,
				shape: 'service',
				states: ['initialized', 'invalid-input'],
				cases: cases.map((item) => ({
					...item,
					subject: 'TitleService.run',
					test: { file: 'test/services/title.test.ts', title: `TitleService.run ${item.state}` }
				}))
			}
		})
	);
	await repo.harness(['units', 'index', '--write']);
	await symlink(join(process.cwd(), 'node_modules'), join(repo.root, 'node_modules'), 'dir');
}
