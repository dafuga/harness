import { expect, test } from 'vitest';
import { resourceWorkers } from '../../src/utils/resourceWorkers';
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
