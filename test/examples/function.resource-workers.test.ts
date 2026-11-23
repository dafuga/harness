import { test } from 'vitest';
import { InvalidTestWorkerCeilingError } from '../../src/utils/execution-runtimes/resourceWorkers.types';
import {
	resourceThreads,
	resourceWorkers
} from '../../src/utils/execution-runtimes/resourceWorkers';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const UNIT_ID = 'function.resource-workers';
const reservedHost = { HARNESS_RESOURCE_CPUS: '4', HARNESS_RESOURCE_MEMORY_MIB: '8192' };

function failureOf(run: () => unknown): { name: string; message: string } {
	try {
		run();
	} catch (error) {
		const { name, message } = error as Error;
		return { name, message };
	}
	return { name: 'none', message: 'did not throw' };
}

test('Caps test workers at the reservation and partitions memory', () => {
	const uncapped = resourceWorkers(reservedHost);
	const capped = resourceWorkers(reservedHost, 2);
	expect(uncapped).toEqual({
		maxWorkers: 4,
		minWorkers: 1,
		env: {
			HARNESS_RESOURCE_CPUS: '1',
			CARGO_BUILD_JOBS: '1',
			RAYON_NUM_THREADS: '1',
			GOMAXPROCS: '1',
			OMP_NUM_THREADS: '1',
			HARNESS_RESOURCE_MEMORY_MIB: '2048'
		}
	});
	expect(capped.maxWorkers).toBe(2);
	expect(capped.env?.HARNESS_RESOURCE_MEMORY_MIB).toBe('4096');
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'resourceWorkers',
			state: 'caps-test-workers-at-the-reservation-and-partitions-memory',
			evidence: 'examples-cases',
			file: 'caps-test-workers-at-the-reservation-and-partitions-memory.json'
		},
		[
			{
				name: 'four CPUs and 8192 MiB with no caller ceiling',
				input: { env: reservedHost },
				output: uncapped
			},
			{
				name: 'same reservation with a caller ceiling of 2 workers',
				input: { env: reservedHost, maximumWorkers: 2 },
				output: capped
			}
		]
	);
});

test('Returns no worker limits without a positive CPU reservation', () => {
	const none = resourceWorkers({});
	const zero = resourceWorkers({ HARNESS_RESOURCE_CPUS: '0' });
	const text = resourceWorkers({ HARNESS_RESOURCE_CPUS: 'many' }, 0);
	expect([none, zero, text]).toEqual([{}, {}, {}]);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'resourceWorkers',
			state: 'returns-no-worker-limits-without-a-positive-cpu-reservation',
			evidence: 'examples-cases',
			file: 'returns-no-worker-limits-without-a-positive-cpu-reservation.json'
		},
		[
			{ name: 'no reservation variable set', input: { env: {} }, output: none },
			{
				name: 'reservation of zero CPUs',
				input: { env: { HARNESS_RESOURCE_CPUS: '0' } },
				output: zero
			},
			{
				name: 'non-numeric reservation ignores a zero ceiling',
				input: { env: { HARNESS_RESOURCE_CPUS: 'many' }, maximumWorkers: 0 },
				output: text
			}
		]
	);
});

test('Rejects a worker ceiling below one when CPUs are reserved', () => {
	const zeroCeiling = failureOf(() => resourceWorkers(reservedHost, 0));
	const nanCeiling = failureOf(() => resourceWorkers(reservedHost, Number.NaN));
	const invalidReservation = resourceWorkers({ HARNESS_RESOURCE_CPUS: 'x' }, 0);
	const expected = {
		name: 'InvalidTestWorkerCeilingError',
		message: 'Invalid test worker ceiling'
	};
	expect(zeroCeiling).toEqual(expected);
	expect(nanCeiling).toEqual(expected);
	expect(invalidReservation).toEqual({});
	expect(() => resourceWorkers(reservedHost, 0)).toThrow(InvalidTestWorkerCeilingError);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'resourceWorkers',
			state: 'rejects-a-worker-ceiling-below-one-when-cpus-are-reserved',
			evidence: 'examples-cases',
			file: 'rejects-a-worker-ceiling-below-one-when-cpus-are-reserved.json'
		},
		[
			{
				name: 'zero ceiling with four reserved CPUs',
				input: { env: reservedHost, maximumWorkers: 0 },
				error: zeroCeiling
			},
			{
				name: 'NaN ceiling with four reserved CPUs',
				input: { env: reservedHost, maximumWorkers: Number.NaN },
				error: nanCeiling
			},
			{
				name: 'zero ceiling with an invalid reservation does not throw',
				input: { env: { HARNESS_RESOURCE_CPUS: 'x' }, maximumWorkers: 0 },
				output: invalidReservation
			}
		]
	);
});

test('Caps native thread variables at the reservation and caller values', () => {
	const reservedOnly = resourceThreads({ HARNESS_RESOURCE_CPUS: '4' });
	const lowerCallers = resourceThreads({
		HARNESS_RESOURCE_CPUS: '4',
		OMP_NUM_THREADS: '2',
		RAYON_NUM_THREADS: '16'
	});
	const mixedCallers = resourceThreads({
		HARNESS_RESOURCE_CPUS: '8',
		CARGO_BUILD_JOBS: '3',
		GOMAXPROCS: '8'
	});
	expect(reservedOnly).toEqual({
		CARGO_BUILD_JOBS: '4',
		RAYON_NUM_THREADS: '4',
		GOMAXPROCS: '4',
		OMP_NUM_THREADS: '4'
	});
	expect(lowerCallers.OMP_NUM_THREADS).toBe('2');
	expect(lowerCallers.RAYON_NUM_THREADS).toBe('4');
	expect(mixedCallers).toEqual({
		CARGO_BUILD_JOBS: '3',
		RAYON_NUM_THREADS: '8',
		GOMAXPROCS: '8',
		OMP_NUM_THREADS: '8'
	});
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'resourceThreads',
			state: 'caps-native-thread-variables-at-the-reservation-and-caller-v',
			evidence: 'examples-cases',
			file: 'caps-native-thread-variables-at-the-reservation-and-caller-values.json'
		},
		[
			{
				name: 'four reserved CPUs with no caller thread values',
				input: { HARNESS_RESOURCE_CPUS: '4' },
				output: reservedOnly
			},
			{
				name: 'four reserved CPUs with lower OpenMP and higher Rayon callers',
				input: { HARNESS_RESOURCE_CPUS: '4', OMP_NUM_THREADS: '2', RAYON_NUM_THREADS: '16' },
				output: lowerCallers
			},
			{
				name: 'eight reserved CPUs with a cargo caller of 3 and a Go caller of 8',
				input: { HARNESS_RESOURCE_CPUS: '8', CARGO_BUILD_JOBS: '3', GOMAXPROCS: '8' },
				output: mixedCallers
			}
		]
	);
});
