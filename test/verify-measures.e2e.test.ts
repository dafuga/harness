import { afterAll, beforeAll, expect, test } from 'vitest';
import { verifyRun } from '../src/workflows/verification-evidence/run-verify/runVerify';
import { attach } from './support/historyRepo';
import {
	observedTaskOperation,
	profileMissingMeasurements,
	taskProfile
} from './support/taskProfiles';
import { baselineRepo, cloneRepo, reviewer, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');

test('task verification rejects missing profiling even without performance budgets', async () => {
	const repo = await cloneRepo(baseline);
	try {
		await repo.change('src/utils/slugify.ts', upper);
		const request = { root: repo.root, requirePerformance: true };
		const { record } = await observedTaskOperation(
			'workflow.run-verify',
			'single-unit-change',
			() => verifyRun(request)
		);
		await taskProfile('workflow.run-verify', 'reject-unprofiled-change', () => verifyRun(request));
		expect(record.gates?.performance, 'task profiling is mandatory without a budget').toBe(
			'failed'
		);
		expect(
			record.failures.some(
				(failure) => failure.includes('function.slugify') && failure.includes('profil')
			)
		).toBe(true);
	} finally {
		await repo.dispose();
	}
}, 120_000);

test('measures that do not apply or were not taken are stated, never left out', async () => {
	await profileMissingMeasurements();
	const repo = await cloneRepo(baseline);
	const head = await repo.change('src/utils/slugify.ts', upper);
	const { record } = await repo.verify();
	const own = record.measurements.filter((item) => item.unit === 'function.slugify');
	expect(own.map((item) => item.metric)).toEqual([
		'source-bytes',
		'source-lines',
		'complexity',
		'dependencies',
		'artifact-bytes',
		'latency-warm-ms',
		'memory-bytes'
	]);
	const unavailable = Object.fromEntries(
		own.filter((item) => item.value === null).map((item) => [item.metric, item.unavailable])
	);
	expect(unavailable).toEqual({
		'artifact-bytes': 'A module unit emits no separate artifact.',
		'latency-warm-ms': 'No benchmark measured this unit in this verification.',
		'memory-bytes':
			'No benchmark measured this unit, and in-process memory cannot be attributed to it.'
	});
	expect(own.every((item) => item.testedRevision === head)).toBe(true);
	expect(record.failures).toEqual([]);
	await repo.dispose();
}, 120_000);

test('a benchmarked unit outside impact keeps its committed source identity', async () => {
	const repo = await cloneRepo(baseline);
	try {
		await repo.change('scripts/fixture.mjs', (source) =>
			source.replace(
				"if (media === 'corrupt')",
				"if (media === 'extra') return Buffer.from('unused');\n\tif (media === 'corrupt')"
			)
		);
		const hash = await repo.git(['rev-parse', 'HEAD:src/services/TitleService.ts']);
		const { record } = await repo.verify();
		expect([...record.impact.units.direct, ...record.impact.units.indirect]).not.toContain(
			'service.title'
		);
		expect(record.measurements.some((item) => item.unit === 'service.title')).toBe(true);
		const title = record.components.find((item) => item.unit === 'service.title');
		expect(title?.files).toContainEqual({ path: 'src/services/TitleService.ts', hash });
		await attach(repo);
	} finally {
		await repo.dispose();
	}
}, 180_000);

test('a removed unit keeps its base source identity in the verification record', async () => {
	const repo = await cloneRepo(baseline);
	try {
		const path = 'src/utils/retired.ts';
		await repo.write(path, 'export function retired(): number { return 1; }\n');
		await repo.harness(['units', 'index', '--write']);
		await repo.explainAll();
		await repo.commit('feat: add retirement fixture');
		const initial = await repo.verify();
		await repo.harness([
			'budget',
			'establish',
			'function.retired',
			'--record',
			initial.record.id,
			...reviewer
		]);
		const base = await repo.commit('chore: establish retirement baseline');
		const added = await repo.verify();
		expect(added.record.status, added.record.failures.join('; ')).toBe('passed');
		await attach(repo);
		const hash = await repo.git(['rev-parse', `${base}:${path}`]);
		await repo.git(['rm', '-q', path]);
		await repo.harness(['units', 'retire', 'function.retired', '--reason', 'Unused']);
		await repo.harness(['units', 'index', '--write']);
		await repo.explainAll();
		await repo.commit('feat: retire fixture');
		const { record } = await repo.verify();
		expect(record.source.base).toBe(base);
		expect(record.impact.units.removed).toContain('function.retired');
		const removed = record.components.find((item) => item.unit === 'function.retired');
		expect(removed).toMatchObject({ change: 'removed', files: [{ path, hash }] });
	} finally {
		await repo.dispose();
	}
}, 180_000);

test('an artifact built in the snapshot is measured with its hash, and a missing one is stated', async () => {
	const repo = await cloneRepo(baseline);
	const path = 'specification/units/function.slugify.json';
	const manifest = await repo.json<{ runtime: { targets: object[] } }>(path);
	const built = { kind: 'process', entry: 'artifacts/slugify.bin' };
	const absent = { kind: 'wasm', entry: 'artifacts/slugify.wasm' };
	const runtime = { ...manifest.runtime, targets: [...manifest.runtime.targets, built, absent] };
	await repo.write(path, JSON.stringify({ ...manifest, runtime }));
	const config = await repo.json<Record<string, unknown>>('harness.verify.json');
	const setup = [{ command: 'mkdir -p artifacts && printf abc > artifacts/slugify.bin' }];
	const outputs = ['artifacts/'];
	await repo.write('harness.verify.json', JSON.stringify({ ...config, setup, outputs }));
	await repo.write('src/utils/slugify.ts', upper(await repo.read('src/utils/slugify.ts')));
	await repo.harness(['units', 'index', '--write']);
	await repo.explainAll();
	await repo.commit('feat: slugify gains built targets');
	const { record } = await repo.verify();
	// The build output is declared, so writing it is not a change to the tested source.
	expect(record.gates).toMatchObject({ snapshot: 'passed' });
	const artifacts = record.measurements.filter(
		(item) => item.unit === 'function.slugify' && item.metric === 'artifact-bytes'
	);
	expect(artifacts).toEqual([
		expect.objectContaining({
			target: 'process',
			value: 3,
			artifacts: [
				{
					path: 'artifacts/slugify.bin',
					bytes: 3,
					sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
				}
			]
		}),
		expect.objectContaining({
			target: 'wasm',
			value: null,
			unavailable: 'artifacts/slugify.wasm was not built in the verified snapshot.',
			artifacts: []
		})
	]);
	await repo.dispose();
}, 120_000);
