import { expect, test } from 'vitest';
import type { Measurement } from '../../src/core/verificationTypes';
import { chooseRuntime } from '../../src/utils/chooseRuntime';

const commit = 'a'.repeat(40);

function cold(target: 'module' | 'wasm' | 'process' | 'http', value: number | null): Measurement {
	return {
		unit: target === 'module' ? 'function.impact-kernel' : 'kernel.impact-kernel',
		metric: 'latency-cold-ms',
		unitOfMeasure: 'ms',
		value,
		...(value === null ? { unavailable: 'Runtime artifact is not built.' } : {}),
		method: 'Median of fresh-process samples.',
		workload: 'graph-1k',
		profile: 'profile-1',
		target,
		testedRevision: commit,
		artifacts: []
	};
}

const choose = (measurements: Measurement[]) =>
	chooseRuntime({ measurements, workload: 'graph-1k', profile: 'profile-1' });

test('the default is the measured fastest cold runtime, whichever implementation that is', () => {
	expect(choose([cold('module', 4), cold('wasm', 9), cold('process', 14)])).toMatchObject({
		runtime: 'module',
		basis: 'measured'
	});
	expect(choose([cold('module', 9), cold('wasm', 4), cold('process', 14)]).runtime).toBe('wasm');
	expect(choose([cold('module', 9), cold('wasm', 14), cold('process', 4)]).runtime).toBe('process');
});

test('a tie within five percent goes to the simpler runtime', () => {
	expect(choose([cold('module', 10.4), cold('wasm', 10), cold('process', 30)]).runtime).toBe(
		'module'
	);
	expect(choose([cold('module', 10.6), cold('wasm', 10), cold('process', 30)]).runtime).toBe(
		'wasm'
	);
	expect(choose([cold('module', 30), cold('wasm', 10.4), cold('process', 10)]).runtime).toBe(
		'wasm'
	);
});

test('missing, unavailable or mismatched measurements never win and are reported', () => {
	const unavailable = choose([cold('module', 9), cold('wasm', null), cold('process', 14)]);
	expect(unavailable.runtime).toBe('module');
	expect(unavailable.excluded).toEqual([
		{ runtime: 'wasm', reason: 'Runtime artifact is not built.' }
	]);

	const http = choose([cold('module', 9), cold('http', 1)]);
	expect(http.runtime).toBe('module');
	expect(http.excluded).toEqual([
		{ runtime: 'wasm', reason: 'No measurement for this workload and profile.' },
		{ runtime: 'process', reason: 'No measurement for this workload and profile.' },
		{ runtime: 'http', reason: 'Needs an independently served unit; never chosen automatically.' }
	]);

	const other = chooseRuntime({
		measurements: [cold('wasm', 1)],
		workload: 'graph-1k',
		profile: 'another-machine'
	});
	expect(other).toMatchObject({ runtime: 'module', basis: 'unmeasured' });
	expect(other.excluded).toEqual(
		['module', 'wasm', 'process'].map((runtime) => ({
			runtime,
			reason: 'No measurement for this workload and profile.'
		}))
	);
});
