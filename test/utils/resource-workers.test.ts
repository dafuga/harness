import { expect, test } from 'vitest';
import {
	resourceThreads,
	resourceWorkers
} from '../../src/utils/execution-runtimes/resourceWorkers';
test('test worker limits use only the managed reservation and retain normal defaults outside it', () => {
	expect(resourceWorkers({})).toEqual({});
	expect(resourceWorkers({ HARNESS_RESOURCE_CPUS: '3.8' })).toEqual({
		maxWorkers: 3,
		minWorkers: 1,
		env: {
			HARNESS_RESOURCE_CPUS: '1',
			CARGO_BUILD_JOBS: '1',
			RAYON_NUM_THREADS: '1',
			GOMAXPROCS: '1',
			OMP_NUM_THREADS: '1'
		}
	});
	expect(resourceWorkers({ HARNESS_RESOURCE_CPUS: '0.5' })).toEqual({
		maxWorkers: 1,
		minWorkers: 1,
		env: {
			HARNESS_RESOURCE_CPUS: '0.5',
			CARGO_BUILD_JOBS: '1',
			RAYON_NUM_THREADS: '1',
			GOMAXPROCS: '1',
			OMP_NUM_THREADS: '1'
		}
	});
	expect(resourceWorkers({ HARNESS_RESOURCE_CPUS: 'invalid' })).toEqual({});
});

test('native worker budgets preserve stricter caller limits and cap larger values', () => {
	expect(
		resourceThreads({
			HARNESS_RESOURCE_CPUS: '3',
			CARGO_BUILD_JOBS: '1',
			GOMAXPROCS: '20',
			OMP_NUM_THREADS: '0'
		})
	).toEqual({
		CARGO_BUILD_JOBS: '1',
		GOMAXPROCS: '3',
		OMP_NUM_THREADS: '3',
		RAYON_NUM_THREADS: '3'
	});
	expect(resourceThreads({})).toEqual({});
});

test('parallel test workers partition the parent CPU and memory budget for their subprocesses', () => {
	const options = resourceWorkers({
		HARNESS_RESOURCE_CPUS: '3',
		HARNESS_RESOURCE_MEMORY_MIB: '1792'
	});
	expect(options.env?.HARNESS_RESOURCE_CPUS).toBe('1');
	expect(Number(options.env?.HARNESS_RESOURCE_MEMORY_MIB) * 3).toBeLessThanOrEqual(1792);
	expect(options.env?.CARGO_BUILD_JOBS).toBe('1');
});

test('a caller ceiling retains its one-worker limit and full per-worker memory reservation', () => {
	const options = resourceWorkers(
		{ HARNESS_RESOURCE_CPUS: '3', HARNESS_RESOURCE_MEMORY_MIB: '1792' },
		1
	);
	expect(options.maxWorkers).toBe(1);
	expect(options.env?.HARNESS_RESOURCE_CPUS).toBe('1');
	expect(options.env?.HARNESS_RESOURCE_MEMORY_MIB).toBe('1792');
});
