import { test } from 'vitest';
import { UnsupportedResourceQueueSchemaError } from '../../src/services/execution-runtimes/resource-queue-service/resourceDatabase.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Names unsupported resource queue schema errors', () => {
	const error = new UnsupportedResourceQueueSchemaError('schema version 9');
	expect(error).toBeInstanceOf(Error);
	expect(error.name).toBe('UnsupportedResourceQueueSchemaError');
	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-resource-queue-service-resource-database-types',
			symbol: 'UnsupportedResourceQueueSchemaError',
			state: 'names-unsupported-resource-queue-schema-errors',
			evidence: 'examples-cases',
			file: 'names-unsupported-resource-queue-schema-errors.json'
		},
		[
			{
				name: 'schema version 9 error exposes its stable name and message',
				input: { message: 'schema version 9' },
				output: { name: error.name, message: error.message }
			}
		]
	);
});
