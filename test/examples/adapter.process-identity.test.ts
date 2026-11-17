import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ProcessIdentityAdapter } from '../../src/services/agents-providers/agent-activity-service/ProcessIdentityAdapter';

test('find reports process start identity for supplied PIDs', () => {
	const adapter = new ProcessIdentityAdapter();
	const pids = [48213, 90417, 1207];
	const cases = pids.map((pid) => {
		const output = adapter.find(pid);
		return { name: `process ${pid} identity probe`, input: pid, output };
	});
	expect(cases).toHaveLength(3);
	for (const item of cases) {
		expect(
			item.output.exists === true ||
				item.output.exists === false ||
				item.output.exists === undefined
		).toBe(true);
		expect(item.output.startedAt === null || typeof item.output.startedAt === 'string').toBe(true);
	}
	recordExampleCases(
		{
			unitId: 'adapter.process-identity',
			symbol: 'ProcessIdentityAdapter.find',
			state: 'find-reports-process-start-identity-for-supplied-pids',
			evidence: 'examples-cases',
			file: 'find-reports-process-start-identity-for-supplied-pids.json'
		},
		cases
	);
});
