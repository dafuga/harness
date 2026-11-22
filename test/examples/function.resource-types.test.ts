import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	resourcePriorities,
	resourcePriority,
	resourceConfigSchema,
	resourceRequestSchema,
	resourceJobSchema,
	mib,
	scopedVerificationLabel
} from '../../src/core/execution-runtimes/resourceTypes';

const state = 'validates-resource-schemas-and-stable-constants';

const jobInput = {
	id: '123e4567-e89b-42d3-a456-426614174000',
	sequence: 1,
	ownerPid: 42,
	ownerStarted: 'started-at-fixture',
	state: 'queued' as const,
	createdAt: 100,
	heartbeatAt: 100,
	notice: null
};

test('Validates resource schemas and stable constants', () => {
	const config = resourceConfigSchema.parse({});
	const request = resourceRequestSchema.parse({});
	const job = resourceJobSchema.parse(jobInput);
	const priorities = resourcePriorities.filter((priority) => resourcePriority.safeParse(priority).success);
	const rejected = [resourcePriority, resourceConfigSchema, resourceRequestSchema].map((schema, index) =>
		schema.safeParse(index === 0 ? 'urgent' : { unexpected: true }).success
	);
	expect({ config, request, job, priorities, mib, scopedVerificationLabel }).toEqual({
		config: {
			schemaVersion: 1,
			cpuReservePercent: 10,
			memoryReservePercent: 10,
			minMemoryReserveMiB: 2048,
			pollMs: 1000,
			staleSampleMs: 5000
		},
		request: { priority: 'coding', cpus: 1, memoryMiB: 512, label: 'Managed work' },
		job: {
			priority: 'coding', cpus: 1, memoryMiB: 512, label: 'Managed work',
			id: '123e4567-e89b-42d3-a456-426614174000', sequence: 1, ownerPid: 42,
			ownerStarted: 'started-at-fixture', state: 'queued', createdAt: 100,
			heartbeatAt: 100, notice: null
		},
		priorities: ['agent-test', 'coding', 'environment'],
		mib: 1048576,
		scopedVerificationLabel: 'Scoped verification'
	});
	expect(rejected).toEqual([false, false, false]);
	recordExampleCases(
		{
			unitId: 'function.resource-types',
			symbol: 'resourceConfigSchema',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{ name: 'configuration defaults and request defaults', input: {}, output: { config, request } },
			{ name: 'job defaults and required lifecycle fields', input: jobInput, output: job },
			{
				name: 'priority order and exported constants',
				input: resourcePriorities,
				output: { priorities, mib, scopedVerificationLabel, rejected }
			}
		]
	);
});
