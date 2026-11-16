import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { behaviorFacts } from '../../src/helpers/verification-evidence/behaviorFacts';
import type { BehaviorFactOptions, BehaviorScenario } from '../../src/helpers/verification-evidence/behaviorFacts.types';

test('Formats paired scenario outcomes and highlighted duration', () => {
	const scenarios: BehaviorScenario[] = [
		{ id: 'checkout', title: 'Checkout', before: 'passed', after: 'failed' },
		{ id: 'search', title: 'Search', before: null, after: null }
	];
	const options: BehaviorFactOptions = { durationLabel: 'Wall time', highlight: true };
	const output = behaviorFacts('Not measured', scenarios, true, options);
	expect(output).toEqual([
		{ key: 'duration', label: 'Wall time', value: 'Not measured', className: 'unmeasured' },
		{ key: 'checkout', label: 'Checkout', value: 'passed → failed', className: 'failed' },
		{ key: 'search', label: 'Search', value: 'not run → not run', className: 'failed' }
	]);
	recordExampleCases(
		{
			unitId: 'reports.helper.verification-evidence-behavior-facts',
			symbol: 'behaviorFacts',
			state: 'formats-paired-scenario-outcomes-and-highlighted-duration',
			evidence: 'examples-cases',
			file: 'formats-paired-scenario-outcomes-and-highlighted-duration.json'
		},
		[
			{
				name: 'highlights missing duration and both unsuccessful paired outcomes',
				input: { duration: 'Not measured', scenarios, paired: true, options },
				output
			}
		]
	);
});
