import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, reviewer, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const calibrations = resolve('specification/measurements/impact-kernel');

test('a calibration file or a failed record can never establish or approve a baseline', async () => {
	const repo = await cloneRepo(baseline);
	const file = readdirSync(calibrations)[0];
	const calibration = readFileSync(join(calibrations, file), 'utf8');
	expect(JSON.parse(calibration).provenance).toMatchObject({
		kind: 'calibration',
		verified: false
	});
	await repo.write('.cache/calibration.json', calibration);
	for (const command of ['establish', 'approve']) {
		const refused = await repo.run([
			'budget',
			command,
			'service.title',
			'--record',
			'.cache/calibration.json',
			...reviewer
		]);
		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain('.cache/calibration.json is not a verification record');
	}

	await repo.write('src/utils/extra.ts', 'export function extra(): number {\n\treturn 1;\n}\n');
	await repo.write(
		'test/utils/extra.test.ts',
		"import { extra } from '../../src/utils/extra';\n// FAIL\nexport const subject = extra;\n"
	);
	await repo.harness(['units', 'index', '--write']);
	await repo.explainAll();
	await repo.commit('feat: add extra with a failing test');
	const failed = await repo.verify();
	expect(failed.record.gates).toMatchObject({ tests: 'failed', budgets: 'failed' });
	const refused = await repo.run([
		'budget',
		'establish',
		'function.extra',
		'--record',
		failed.record.id,
		...reviewer
	]);
	expect(refused.exitCode).toBe(1);
	expect(refused.stderr).toContain('is not known-good: tests did not pass');
	expect(await repo.read('specification/budgets/ledger.ndjson')).not.toContain('function.extra');
	await repo.dispose();
}, 180_000);

test('a slowdown in a dependency fails the gate of the unit that owns the boundary', async () => {
	const repo = await cloneRepo(baseline);
	const head = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	const { record } = await repo.verify([], { FIXTURE_NO_BENCH: '1' });
	expect(record.source.commit).toBe(head);
	expect(record.impact.units.indirect).toContain('service.title');
	expect(record.budgets.findings).toContainEqual(
		expect.objectContaining({
			unit: 'service.title',
			metric: 'latency-warm-ms',
			status: 'missing-measurement'
		})
	);
	expect(record.failures).toEqual(['service.title: latency-warm-ms on titles-1k was not measured']);
	await repo.dispose();
}, 120_000);
