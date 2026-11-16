import { test } from 'vitest';
import { CpuIntervalError } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/resourceCpu.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Creates a named CPU interval error', () => {
	const error = new CpuIntervalError('counter reset');

	expect(error).toBeInstanceOf(Error);
	expect(error.name).toBe('CpuIntervalError');
	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-resource-queue-service-resource-monitor-service-host-resources-adapter-resource-cpu-types',
			symbol: 'CpuIntervalError',
			state: 'creates-a-named-cpu-interval-error',
			evidence: 'examples-cases',
			file: 'creates-a-named-cpu-interval-error.json'
		},
		[
			{
				name: 'a counter reset produces the dedicated interval error type',
				input: { message: 'counter reset' },
				output: { name: error.name, message: error.message }
			}
		]
	);
});
