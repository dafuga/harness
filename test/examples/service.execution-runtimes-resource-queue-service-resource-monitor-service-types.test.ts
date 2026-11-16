import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { MonitorOptions } from '../../src/services/execution-runtimes/resource-queue-service/ResourceMonitorService.types';

test('Accepts resource monitor options', () => {
	const options: MonitorOptions = {
		home: '/tmp/resource-monitor-example',
		queue: {} as MonitorOptions['queue']
	};
	expect(options.home).toBe('/tmp/resource-monitor-example');
	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-resource-queue-service-resource-monitor-service-types',
			symbol: 'MonitorOptions',
			state: 'accepts-resource-monitor-options',
			evidence: 'examples-cases',
			file: 'accepts-resource-monitor-options.json'
		},
		[
			{
				name: 'typed options retain the configured home path',
				input: { home: options.home },
				output: { home: options.home }
			}
		]
	);
});
