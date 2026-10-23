import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { ComponentManifest } from '../src/core/development-tooling/unitTypes';
import { TaskCompletionService } from '../src/services/verification-evidence/TaskCompletionService';
import { UnitBenchmarkService } from '../src/workflows/verification-evidence/run-budget/UnitBenchmarkService';
import { runCommand } from './support/cli';
import { profileCodingCompletion } from './support/completionProfiles';
import { rankScenario, rankSource, rankWorkload, slowRankSource } from './support/verifyFixture';
import { baselineRepo, cloneRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';

/**
 * The rule fixtures verify the SYNTHETIC title cost alone. Only the real operation case prepares
 * the rank function with its workload and scenario, inside that test and its bound, so no other
 * case carries its findings or waits for its benchmark.
 */
let baseline: VerifyRepo;
/** Every repository prepared or cloned here for afterAll, tracked before anything on it can fail. */
const prepared: VerifyRepo[] = [];
/** A prepared baseline, tracked before its extension and its verifications run. */
function prepare(extend: (repo: VerifyRepo) => Promise<void> = () => Promise.resolve()) {
	return baselineRepo(async (repo) => {
		prepared.push(repo);
		await extend(repo);
	});
}
/** The baseline with the rank function, prepared when the real operation case asks for it. */
async function prepareRanked() {
	return prepare(async (repo) => {
		const verification = await repo.json<{ timeouts: { test: number } }>('harness.verify.json');
		verification.timeouts.test = 60_000;
		await repo.write('harness.verify.json', JSON.stringify(verification));
		await repo.write('src/utils/rank.ts', rankSource);
		// Sample the unchanged positive operation long enough to compare steady-state timings.
		await repo.write(
			'specification/workloads/rank-20k.json',
			JSON.stringify({ ...rankWorkload, rounds: 15, iterations: 100 })
		);
		await repo.write(
			'specification/scenarios/rank-boundary.json',
			JSON.stringify({
				...rankScenario,
				tests: rankScenario.tests.map((check) => ({ ...check, timeoutMs: 120_000 }))
			})
		);
		await repo.harness(['units', 'index', '--write']);
		const path = 'specification/units/function.rank.json';
		const manifest = await repo.json<{ budgets: object }>(path);
		const module = { kind: 'module', entry: 'src/utils/rank.ts', handler: 'rank' };
		const performance = [{ workload: 'rank-20k', metric: 'latency-floor-ms', tolerance: 0.05 }];
		await repo.write(
			path,
			JSON.stringify({
				...manifest,
				runtime: { ...module, targets: [module] },
				budgets: { ...manifest.budgets, performance }
			})
		);
		await repo.harness(['units', 'index', '--write']);
	});
}
beforeAll(async () => {
	baseline = await prepare();
}, 180_000);
afterAll(() => Promise.all(prepared.map((repo) => repo.dispose())));

const cost = (value: string) => (source: string) =>
	source.replace('titleCost = 10.0', `titleCost = ${value}`);
const performance = (outcome: VerifyOutcome, unit: string) =>
	outcome.record.budgets.findings.find(
		(item) => item.unit === unit && item.metric.startsWith('latency')
	);

async function withCost(value: string, env: Record<string, string> = {}) {
	const repo = await cloneRepo(baseline);
	await repo.change('src/services/TitleService.ts', cost(value));
	const outcome = await repo.verify([], env);
	await repo.dispose();
	return outcome;
}

test('rule fixture: a declared slowdown beyond five percent fails, and one within it passes', async () => {
	const slower = await withCost('10.6');
	expect(slower.exitCode).toBe(1);
	expect(performance(slower, 'service.title')).toEqual({
		unit: 'service.title',
		metric: 'latency-warm-ms',
		status: 'exceeded',
		baseline: 10,
		measured: 10.6,
		detail: expect.stringContaining('titles-1k')
	});
	expect(slower.record.failures).toEqual([
		'service.title: latency-warm-ms on titles-1k is 10.6 ms against a baseline of 10 ms; the limit is 10.5 ms'
	]);
	const within = await withCost('10.4');
	expect(within.record.failures).toEqual([]);
	expect(performance(within, 'service.title')).toMatchObject({ status: 'passed', measured: 10.4 });
	const equal = await withCost('10.5');
	expect(performance(equal, 'service.title')).toMatchObject({ status: 'passed', measured: 10.5 });
}, 240_000);

test('rule fixture: another profile is incompatible and a missing measurement never passes', async () => {
	const other = await withCost('10.4', { HARNESS_PROFILE_LABEL: 'another-runner-class' });
	expect(other.exitCode).toBe(1);
	expect(performance(other, 'service.title')).toMatchObject({
		status: 'incompatible',
		baseline: null,
		measured: 10.4
	});
	expect(other.record.failures).toEqual([
		'service.title: latency-warm-ms on titles-1k has a baseline only for another machine profile'
	]);
	const missing = await withCost('10.4', { FIXTURE_NO_BENCH: '1' });
	expect(performance(missing, 'service.title')).toMatchObject({
		status: 'missing-measurement',
		measured: null
	});
	expect(missing.exitCode).toBe(1);
}, 240_000);

test('a real operation that is slowed without changing its result fails the end-to-end gate', async () => {
	const ranked = await prepareRanked();
	const repo = await cloneRepo(ranked);
	prepared.push(repo);
	await assertTaskProfile(repo);
	const before = await repo.verify(['--commit', 'HEAD~1']);
	const digest = async (outcome: VerifyOutcome) => {
		const capture = outcome.record.scenarios.find((scenario) => scenario.id === 'rank-boundary')
			?.states[0].captures[0];
		if (!capture)
			throw new Error(`Benchmark capture missing: ${outcome.record.failures.join('; ')}`);
		const file = JSON.parse(await readFile(join(outcome.directory, capture.path), 'utf8'));
		return file as {
			responseDigest: string;
			target: string;
			measurements: Array<{ method: string; metric: string; value: number }>;
		};
	};
	const fast = await digest(before);
	expect(fast.target).toBe('module');
	await assertBenchmarkDriver(repo, fast.responseDigest);
	const rss = fast.measurements.find((entry) => entry.metric === 'process-peak-rss-bytes');
	expect(rss?.value, 'tiny fresh rank process has sane byte-scale RSS').toBeGreaterThan(0);
	expect(rss?.value, 'tiny fresh rank process has sane byte-scale RSS').toBeLessThan(8 * 1024 ** 3);
	expect(fast.measurements[0].method).toMatch(
		/end-to-end calls through the declared module target/
	);
	const history = JSON.parse(
		(await repo.run(['budget', 'history', 'function.rank', '--json'])).stdout
	) as Array<{ performance: Array<{ metric: string; value: number }> }>;
	const baselineFloor = history[0].performance.find((item) => item.metric === 'latency-floor-ms')
		?.value as number;
	expect(baselineFloor).toBeGreaterThan(0);

	await repo.change('src/utils/rank.ts', () => slowRankSource);
	const slowed = await repo.verify();
	expect(slowed.exitCode).toBe(1);
	expect((await digest(slowed)).responseDigest).toBe(fast.responseDigest);
	const finding = performance(slowed, 'function.rank');
	expect(finding).toMatchObject({
		metric: 'latency-floor-ms',
		status: 'exceeded',
		baseline: baselineFloor
	});
	expect(finding?.measured as number).toBeGreaterThan(baselineFloor * 2);
	await repo.dispose();
}, 300_000);

async function assertTaskProfile(repo: VerifyRepo) {
	await repo.change('src/utils/rank.ts', (source) => source.replace('?? 1;', '?? 2;'));
	const profiled = await repo.verify(['--require-performance']);
	const memory = profiled.record.measurements.find(
		(item) => item.unit === 'function.rank' && item.metric === 'process-peak-rss-bytes'
	);
	expect(memory?.value ?? 0, 'actual module benchmark memory must be observed').toBeGreaterThan(0);
	expect(profiled.record.failures).toEqual([]);
	const audit = await new TaskCompletionService(repo.root).check({
		kind: 'coding',
		goal: 'Change rank default seed',
		units: ['function.rank']
	});
	expect(audit.passed, JSON.stringify(audit.checks)).toBe(true);
	await profileCodingCompletion(repo.root, profiled.record.source.commit);
	const checked = await repo.run([
		'task',
		'check',
		'--kind',
		'coding',
		'--goal',
		'Change rank default seed',
		'--units',
		'function.rank',
		'--json'
	]);
	expect(JSON.parse(checked.stdout).passed).toBe(true);
}

/** The normal Node test host invokes the actual driver over a real compiled module. */
async function assertBenchmarkDriver(repo: VerifyRepo, expectedDigest: string) {
	const entry = '.cache/rank-driver.mjs';
	await runCommand(
		['bun', 'build', 'src/utils/rank.ts', '--target=node', `--outfile=${entry}`],
		repo.root
	);
	const manifest = await repo.json<ComponentManifest>('specification/units/function.rank.json');
	const target = { kind: 'module' as const, entry, handler: 'rank' };
	const driver = await new UnitBenchmarkService(repo.root).measure(
		{ ...manifest, runtime: { ...target, targets: [target] } },
		{ ...rankWorkload, schemaVersion: 1, rounds: 3, iterations: 10 },
		'module'
	);
	expect(driver.responseDigest).toBe(expectedDigest);
	const rss = driver.measurements.find((metric) => metric.metric === 'process-peak-rss-bytes');
	expect(rss?.value).toBeGreaterThan(0);
}
