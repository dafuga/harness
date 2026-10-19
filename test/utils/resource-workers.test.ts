import { expect, test } from 'vitest';
import { resourceWorkers, resourceThreads } from '../../src/utils/resourceWorkers';
test('test worker limits use only the managed reservation and retain normal defaults outside it', () => {
	expect(resourceWorkers({})).toEqual({});
	expect(resourceWorkers({ HARNESS_RESOURCE_CPUS: '3.8' })).toEqual({
		maxWorkers: 3,
		minWorkers: 1
	});
	expect(resourceWorkers({ HARNESS_RESOURCE_CPUS: '0.5' })).toEqual({
		maxWorkers: 1,
		minWorkers: 1
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
