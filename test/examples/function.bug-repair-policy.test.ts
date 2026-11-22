import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { bugRepairPolicy } from '../../src/utils/development-tooling/bugRepairPolicy';

test('Returns the nine shared bug repair rules', () => {
	const rules = bugRepairPolicy();
	const summary = {
		count: rules.length,
		coverageDiagnosis: rules[0],
		standardizedRegression: rules[1],
		separateRedGreenCommits: rules[4],
		causalNaming: rules[6],
		selectedCallable: rules[7],
		readOnlyPlanning: rules[8]
	};

	expect(rules).toHaveLength(9);
	expect(rules[4]).toContain('--phase red');
	expect(rules[4]).toContain('--phase green');
	expect(rules[8]).toContain('During read-only planning');
	recordExampleCases(
		{
			unitId: 'function.bug-repair-policy',
			symbol: 'bugRepairPolicy',
			state: 'returns-the-nine-shared-bug-repair-rules',
			evidence: 'examples-cases',
			file: 'returns-the-nine-shared-bug-repair-rules.json'
		},
		[
			{
				name: 'caller receives all nine policy rules and key procedures',
				input: {},
				output: summary
			}
		]
	);
});
