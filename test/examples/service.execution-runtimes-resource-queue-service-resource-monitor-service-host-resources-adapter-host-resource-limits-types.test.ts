import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { HostResourceLimitsError } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/hostResourceLimits.types';

const MISSING_CGROUP_MESSAGE = 'cgroup v2 host limits are unavailable';
const INVALID_MEMBERSHIP_MESSAGE = 'cgroup membership path is invalid';

function describeError(message: string) {
	const error = new HostResourceLimitsError(message);
	return {
		name: error.name,
		message: error.message,
		isError: error instanceof Error,
		isHostResourceLimitsError: error instanceof HostResourceLimitsError
	};
}

test('Reports a host resource limits error with its name', () => {
	const missing = describeError(MISSING_CGROUP_MESSAGE);
	const invalid = describeError(INVALID_MEMBERSHIP_MESSAGE);

	expect(missing.name).toBe('HostResourceLimitsError');
	expect(missing.message).toBe(MISSING_CGROUP_MESSAGE);
	expect(missing.isError).toBe(true);
	expect(missing.isHostResourceLimitsError).toBe(true);
	expect(invalid.name).toBe('HostResourceLimitsError');
	expect(invalid.message).toBe(INVALID_MEMBERSHIP_MESSAGE);

	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-resource-queue-service-resource-monitor-service-host-resources-adapter-host-resource-limits-types',
			symbol: 'HostResourceLimitsError',
			state: 'reports-a-host-resource-limits-error-with-its-name',
			evidence: 'examples-cases',
			file: 'reports-a-host-resource-limits-error-with-its-name.json'
		},
		[
			{
				name: 'cgroup v2 limits unavailable builds a named error',
				input: { message: MISSING_CGROUP_MESSAGE },
				output: missing
			},
			{
				name: 'invalid membership path builds a named error',
				input: { message: INVALID_MEMBERSHIP_MESSAGE },
				output: invalid
			}
		]
	);
});
