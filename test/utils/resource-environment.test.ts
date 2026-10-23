import { expect, test } from 'vitest';
import { resourceEnvironment } from '../../src/utils/execution-runtimes/resourceEnvironment';
test('only scheduling context is forwarded separately from application and credential environment', () => {
	expect(
		resourceEnvironment({
			HARNESS_RESOURCE_LEASE: 'lease',
			HARNESS_RESOURCE_CPUS: '2',
			OPENAI_API_KEY: 'synthetic-key',
			OTHER: 'value'
		})
	).toEqual({ HARNESS_RESOURCE_LEASE: 'lease', HARNESS_RESOURCE_CPUS: '2' });
});
