import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { PerformanceProfileService } from '../../src/services/verification-evidence/PerformanceProfileService';
import type {
	Measured,
	ObservationInput,
	ProfileInput
} from '../../src/services/verification-evidence/PerformanceProfileService.types';

const unit = 'service.performance-profile';
const subject: ObservationInput = {
	unit,
	workload: unit,
	callable: 'PerformanceProfileService.observe'
};
const replay: ProfileInput = {
	unit,
	workload: unit,
	callable: 'PerformanceProfileService.measure',
	rounds: 2,
	iterations: 5,
	warmups: 1
};

function summarise(measurements: Measured[]) {
	return measurements.map(({ metric, unitOfMeasure, samples, value }) => ({
		metric,
		unitOfMeasure,
		samples,
		valueIsFinite: Number.isFinite(value)
	}));
}

test('Observes a synchronous return and passes it back', async () => {
	await withTempDir('perf-profile-observe-', async () => {
		const service = new PerformanceProfileService();
		const value = { count: 12, status: 'ready' };
		const returned = service.observe(subject, () => value);
		const measurements = service.flush();

		expect(returned).toBe(value);
		expect(measurements.map((item) => item.metric)).toEqual([
			'latency-observed-ms',
			'process-peak-rss-bytes'
		]);
		recordExampleCases(
			{
				unitId: 'service.performance-profile',
				symbol: 'observe',
				state: 'observes-a-synchronous-return-and-passes-it-back',
				evidence: 'examples-cases',
				file: 'observes-a-synchronous-return-and-passes-it-back.json'
			},
			[
				{
					name: 'synchronous object return is passed back and flushed as two measurements',
					input: subject,
					output: { returned, measurements: summarise(measurements) }
				}
			]
		);
	});
});

test('Rejects observation input with a replay count', () => {
	const service = new PerformanceProfileService();
	const withReplay = { ...subject, rounds: 2 };
	let calls = 0;
	let error: unknown;
	try {
		service.observe(withReplay, () => {
			calls++;
			return 1;
		});
	} catch (caught) {
		error = caught;
	}

	expect((error as Error).name).toBe('ZodError');
	expect(calls).toBe(0);
	recordExampleCases(
		{
			unitId: 'service.performance-profile',
			symbol: 'observe',
			state: 'rejects-observation-input-with-a-replay-count',
			evidence: 'examples-cases',
			file: 'rejects-observation-input-with-a-replay-count.json'
		},
		[
			{
				name: 'rounds key is rejected before the operation runs',
				input: withReplay,
				error: { name: (error as Error).name }
			}
		]
	);
});

test('Flushes awaited observations as two measurements', async () => {
	await withTempDir('perf-profile-flush-', async () => {
		const service = new PerformanceProfileService();
		for (let index = 0; index < 3; index++) {
			await service.observeAsync(subject, async () => ({ count: index, status: 'ready' }));
		}
		await expect(
			service.observeAsync(subject, () => Promise.reject(new Error('boom')))
		).rejects.toThrow('boom');
		const measurements = service.flush();

		expect(measurements.map((item) => item.metric)).toEqual([
			'latency-observed-ms',
			'process-peak-rss-bytes'
		]);
		expect(measurements.map((item) => item.samples)).toEqual([3, 3]);
		expect(service.flush()).toEqual([]);
		recordExampleCases(
			{
				unitId: 'service.performance-profile',
				symbol: 'flush',
				state: 'flushes-awaited-observations-as-two-measurements',
				evidence: 'examples-cases',
				file: 'flushes-awaited-observations-as-two-measurements.json'
			},
			[
				{
					name: 'three resolved awaits aggregate; a rejected await is not counted',
					input: { subject, awaitedCalls: 3, rejectedCalls: 1 },
					output: { measurements: summarise(measurements) }
				}
			]
		);
	});
});

test('Measures warm latency and process memory from a replay', async () => {
	const service = new PerformanceProfileService();
	let calls = 0;
	const measurements = await service.measure(replay, () => {
		calls++;
		return calls;
	});

	expect(calls).toBe(11);
	expect(measurements.map((item) => item.metric)).toEqual([
		'latency-warm-ms',
		'process-peak-rss-bytes'
	]);
	expect(measurements.map((item) => item.samples)).toEqual([10, 10]);
	expect(measurements[1].value).toBeGreaterThan(0);
	recordExampleCases(
		{
			unitId: 'service.performance-profile',
			symbol: 'measure',
			state: 'measures-warm-latency-and-process-memory-from-a-replay',
			evidence: 'examples-cases',
			file: 'measures-warm-latency-and-process-memory-from-a-replay.json'
		},
		[
			{
				name: 'one warmup plus two batches of five calls yields two measurements',
				input: replay,
				output: { calls, measurements: summarise(measurements) }
			}
		]
	);
});

test('Rejects a replay with an out-of-range round count', async () => {
	const service = new PerformanceProfileService();
	const invalid = { ...replay, rounds: 0 };
	let calls = 0;
	await expect(
		service.measure(invalid, () => {
			calls++;
			return calls;
		})
	).rejects.toMatchObject({ name: 'ZodError' });

	expect(calls).toBe(0);
	recordExampleCases(
		{
			unitId: 'service.performance-profile',
			symbol: 'measure',
			state: 'rejects-a-replay-with-an-out-of-range-round-count',
			evidence: 'examples-cases',
			file: 'rejects-a-replay-with-an-out-of-range-round-count.json'
		},
		[
			{
				name: 'rounds of zero is rejected before any operation call',
				input: invalid,
				error: { name: 'ZodError' }
			}
		]
	);
});
