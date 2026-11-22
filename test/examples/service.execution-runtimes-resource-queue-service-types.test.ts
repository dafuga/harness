import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ResourceQueueError } from '../../src/services/execution-runtimes/ResourceQueueService.types';
import type { RunOptions, Dependencies } from '../../src/services/execution-runtimes/ResourceQueueService.types';

const runOptions: RunOptions = { waitTimeoutMs: 0, env: { EXAMPLE_OWNER: 'example-owner' } };
const dependencies: Dependencies = { home: '/example/home', env: { EXAMPLE_FLAG: '1' } };

test('Builds a ResourceQueueError named for the refusal', () => {
	const message = `wait timeout must be positive, got ${runOptions.waitTimeoutMs ?? 'unset'}`;
	const error = new ResourceQueueError(message);

	expect(error).toBeInstanceOf(Error);
	expect(error.name).toBe('ResourceQueueError');
	expect(error.message).toBe('wait timeout must be positive, got 0');

	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-resource-queue-service-types',
			symbol: 'ResourceQueueError',
			state: 'builds-a-resourcequeueerror-named-for-the-refusal',
			evidence: 'examples-cases',
			file: 'builds-a-resourcequeueerror-named-for-the-refusal.json'
		},
		[
			{
				name: 'refused non-positive wait timeout yields a named error',
				input: { waitTimeoutMs: runOptions.waitTimeoutMs },
				error: { name: error.name, message: error.message }
			},
			{
				name: 'dependencies carry home and env keys without a monitor',
				input: { home: dependencies.home, envKeys: Object.keys(dependencies.env ?? {}) },
				output: { home: dependencies.home, envKeys: ['EXAMPLE_FLAG'], hasMonitor: dependencies.monitor !== undefined }
			}
		]
	);
});
