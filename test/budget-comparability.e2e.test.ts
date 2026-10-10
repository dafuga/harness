import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	changeWorkload,
	latencyFinding,
	performanceHistory,
	rankBaselineRepo
} from './support/rankRepo';
import { cloneRepo, reviewer, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await rankBaselineRepo();
}, 180_000);
afterAll(() => baseline.dispose());

const title = 'service.title: latency-warm-ms on titles-1k';
const rank = 'function.rank: latency-floor-ms on rank-20k';
const sampling = { warmup: 3, rounds: 5, iterations: 30 };

async function withCost(value: string, env: Record<string, string> = {}) {
	const repo = await cloneRepo(baseline);
	await repo.change('src/services/TitleService.ts', (source) =>
		source.replace('titleCost = 10.0', `titleCost = ${value}`)
	);
	return { repo, outcome: await repo.verify([], env) };
}

test('a measurement reported in another unit is incompatible, whatever its number', async () => {
	const control = await withCost('10.1');
	expect(control.outcome.record.failures).toEqual([]);
	expect(latencyFinding(control.outcome, 'service.title')).toMatchObject({ status: 'passed' });
	await control.repo.dispose();

	const { repo, outcome } = await withCost('10.1', { FIXTURE_BENCH_UNIT: 'seconds' });
	expect([outcome.exitCode, outcome.record.status]).toEqual([1, 'failed']);
	expect(latencyFinding(outcome, 'service.title')).toEqual({
		unit: 'service.title',
		metric: 'latency-warm-ms',
		status: 'incompatible',
		baseline: null,
		measured: 10.1,
		detail: 'titles-1k on the module target',
		differences: ['unit of measure is seconds, the baseline is in ms']
	});
	expect(outcome.record.failures).toEqual([
		`${title} cannot be compared with its baseline: unit of measure is seconds, the baseline is in ms`
	]);
	const approve = ['budget', 'approve', 'service.title', '--record', outcome.record.id];
	const refused = await repo.run([...approve, ...reviewer]);
	expect(refused.exitCode).toBe(1);
	expect(refused.stderr).toContain('cannot set a baseline for service.title');
	expect(refused.stderr).toContain('is in seconds, not ms');
	await repo.dispose();
}, 240_000);

test('a generic capture needs an explicit valid context: a label, a method or a request alone does not compare', async () => {
	const unlabelled = await withCost('10.2', { FIXTURE_NO_CONTEXT: '1' });
	expect(unlabelled.outcome.exitCode).toBe(1);
	expect(latencyFinding(unlabelled.outcome, 'service.title')).toMatchObject({
		status: 'incomplete',
		baseline: null,
		measured: 10.2
	});
	expect(unlabelled.outcome.record.failures).toEqual([
		`${title} has no complete comparison context: the measurement states no comparison context`
	]);
	const approve = ['budget', 'approve', 'service.title', '--record'];
	const refused = await unlabelled.repo.run([
		...approve,
		unlabelled.outcome.record.id,
		...reviewer
	]);
	expect(refused.exitCode).toBe(1);
	expect(refused.stderr).toContain('cannot set a baseline for service.title');
	expect(refused.stderr).toContain('states no comparison context');
	await unlabelled.repo.dispose();

	const malformed = await withCost('10.2', { FIXTURE_BAD_CONTEXT: '1' });
	expect(malformed.outcome.exitCode).toBe(1);
	expect(malformed.outcome.record.failures).toContainEqual(
		expect.stringMatching(
			/^titles-boundary: capture benchmark\.json is not a valid benchmark: measurements\.0\.comparison\.request/
		)
	);
	expect(latencyFinding(malformed.outcome, 'service.title')?.status).not.toBe('passed');
	await malformed.repo.dispose();

	const other = await withCost('10.2', { FIXTURE_BENCH_TITLES: '10' });
	expect(latencyFinding(other.outcome, 'service.title')).toMatchObject({ status: 'incompatible' });
	expect(other.outcome.record.failures[0]).toMatch(
		/cannot be compared with its baseline: request [0-9a-f]{12} differs from the baseline request [0-9a-f]{12}$/
	);
	await other.repo.dispose();

	const method = await withCost('10.2', { FIXTURE_BENCH_METHOD: 'Timed an inner helper only.' });
	expect(method.outcome.record.failures).toEqual([
		`${title} cannot be compared with its baseline: method description differs from the baseline`
	]);
	await method.repo.dispose();
}, 300_000);

test('the same workload name with a cheaper request is incompatible until a reviewer approves the new definition', async () => {
	const repo = await cloneRepo(baseline);
	const [established] = await performanceHistory(repo, 'function.rank');
	const original = established.performance[0];
	expect(original).toMatchObject({
		workload: 'rank-20k',
		metric: 'latency-floor-ms',
		unitOfMeasure: 'ms',
		comparison: { boundary: 'public-invocation', sampling }
	});
	expect(original.method).toMatch(/Fastest of 5 rounds of 30 end-to-end calls/);

	await changeWorkload(repo, (workload) => ({
		...workload,
		request: { ...workload.request, input: { ...workload.request.input, size: 1 } }
	}));
	const cheaper = await repo.verify();
	expect([cheaper.exitCode, cheaper.record.status]).toEqual([1, 'failed']);
	const finding = latencyFinding(cheaper, 'function.rank');
	expect(finding).toMatchObject({ status: 'incompatible', baseline: null });
	expect(finding?.measured as number).toBeLessThan(original.value / 10);
	expect(cheaper.record.failures).toEqual([
		expect.stringMatching(
			new RegExp(
				`^${rank} cannot be compared with its baseline: request [0-9a-f]{12} differs from the baseline request ${original.comparison.request.slice(0, 12)}$`
			)
		)
	]);
	const measured = cheaper.record.measurements.find(
		(item) => item.unit === 'function.rank' && item.metric === 'latency-floor-ms'
	);
	expect(measured?.comparison?.request).not.toBe(original.comparison.request);
	expect(measured?.comparison?.sampling).toEqual(sampling);

	const approve = ['budget', 'approve', 'function.rank', '--record', cheaper.record.id];
	await repo.harness([...approve, ...reviewer]);
	await repo.commit('chore: approve the new workload definition');
	const history = await performanceHistory(repo, 'function.rank');
	expect(history.map((event) => event.type)).toEqual(['baseline', 'approval']);
	expect(history[0].performance[0]).toEqual(original);
	expect(history[1].performance[0].comparison.request).toBe(measured?.comparison?.request);
	expect(history[1].performance[0].value).toBeLessThan(original.value / 10);

	// The new definition is now comparable. Whether a microsecond-scale timing then stays within
	// five percent is a real measurement, so only comparability is asserted here.
	const approved = await repo.verify();
	const compared = latencyFinding(approved, 'function.rank');
	expect(['passed', 'exceeded']).toContain(compared?.status);
	expect(compared?.baseline).toBe(history[1].performance[0].value);
	expect(approved.record.failures.filter((text) => !text.includes('the limit is'))).toEqual([]);
	await repo.dispose();
}, 300_000);

test('fewer samples under the same workload name are incompatible too', async () => {
	const repo = await cloneRepo(baseline);
	await changeWorkload(repo, (workload) => ({ ...workload, iterations: 3 }));
	const outcome = await repo.verify();
	expect(outcome.exitCode).toBe(1);
	expect(latencyFinding(outcome, 'function.rank')).toMatchObject({
		status: 'incompatible',
		baseline: null
	});
	expect(outcome.record.failures).toEqual([
		expect.stringContaining(
			`${rank} cannot be compared with its baseline: sampling is 5 rounds of 3 calls after 3 warm-up calls, the baseline used 5 rounds of 30 calls after 3 warm-up calls`
		)
	]);
	await repo.dispose();
}, 240_000);
