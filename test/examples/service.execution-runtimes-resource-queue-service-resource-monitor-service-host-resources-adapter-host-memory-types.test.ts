import { test } from 'vitest';
import { HostMemoryReadError } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/hostMemory.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Identifies invalid host memory reads', () => {
	const error = new HostMemoryReadError('Host memory counters are invalid');
	expect(error).toBeInstanceOf(Error);
	expect(error.name).toBe('HostMemoryReadError');
	expect(error.message).toBe('Host memory counters are invalid');
	recordExampleCases(
		{
			unitId:
				'service.execution-runtimes-resource-queue-service-resource-monitor-service-host-resources-adapter-host-memory-types',
			symbol: 'HostMemoryReadError',
			state: 'identifies-invalid-host-memory-reads',
			evidence: 'examples-cases',
			file: 'identifies-invalid-host-memory-reads.json'
		},
		[
			{
				name: 'invalid host counters expose a named read error',
				input: { message: 'Host memory counters are invalid' },
				output: { name: error.name, message: error.message }
			}
		]
	);
});
