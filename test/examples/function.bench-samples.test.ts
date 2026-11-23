import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	benchSamples,
	median,
	timeCall,
	benchRounds,
	roundMeasurements
} from '../../src/utils/development-tooling/benchSamples';
import type { UnitRuntime } from '../../src/core/execution-runtimes/runtimeTypes';

test('Summarizes warmed runtime measurements', async () => {
	let calls = 0;
	const runtime: UnitRuntime = {
		kind: 'module',
		invoke: async () => {
			calls += 1;
			return { ok: true, output: { accepted: true } };
		},
		close: async () => {}
	};
	const request = { operation: 'echo', input: { message: 'hello' } };
	const warm = await benchSamples(runtime, request, 1);
	const elapsed = await timeCall(runtime, request);
	const rounds = await benchRounds(runtime, request, { rounds: 2, iterations: 1 });
	const measurements = roundMeasurements(rounds, 'runtime.invoke');

	expect(calls).toBe(10);
	expect(warm.iterations).toBe(1);
	expect(warm.medianMs).toBeGreaterThanOrEqual(0);
	expect(elapsed).toBeGreaterThanOrEqual(0);
	expect(rounds.samples).toBe(2);
	expect(median([2, 4, 8])).toBe(4);
	expect(measurements.map(({ metric }) => metric)).toEqual([
		'latency-floor-ms',
		'latency-warm-ms',
		'throughput-ops'
	]);
	const state = 'summarizes-warmed-runtime-measurements';
	recordExampleCases(
		{
			unitId: 'function.bench-samples',
			symbol: 'benchSamples',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'one measured echo call follows three warmups',
				input: { request, iterations: 1 },
				output: {
					iterations: warm.iterations,
					medianMsIsFinite: Number.isFinite(warm.medianMs),
					opsPerSecondIsFinite: Number.isFinite(warm.opsPerSecond)
				}
			}
		]
	);
});

test('Throws ExpectedCliError when runtime invocation fails', async () => {
	const runtime: UnitRuntime = {
		kind: 'module',
		invoke: async () => ({
			ok: false,
			error: { code: 'sample-error', message: 'sample failed' }
		}),
		close: async () => {}
	};
	const request = { operation: 'run' };
	let message = '';
	try {
		await timeCall(runtime, request);
	} catch (error) {
		if (error instanceof Error) message = error.message;
	}

	expect(message).toBe('module failed: sample failed');
	const state = 'throws-expectedclierror-when-runtime-invocation-fails';
	recordExampleCases(
		{
			unitId: 'function.bench-samples',
			symbol: 'timeCall',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'failed module response includes its runtime kind and message',
				input: {
					request,
					response: {
						ok: false,
						error: { code: 'sample-error', message: 'sample failed' }
					}
				},
				error: message
			}
		]
	);
});
