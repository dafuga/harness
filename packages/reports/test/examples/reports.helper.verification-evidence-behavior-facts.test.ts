import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { behaviorFacts } from '../../src/helpers/verification-evidence/behaviorFacts';
import type {
	BehaviorFactOptions,
	BehaviorScenario
} from '../../src/helpers/verification-evidence/behaviorFacts.types';

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

test('Throws Input access error when reading a scenario title', () => {
	const scenario = {
		id: 'checkout',
		get title(): string {
			throw new Error('title access failed');
		},
		before: null,
		after: 'failed'
	} as BehaviorScenario;
	const input = { duration: '1s', scenarios: [scenario], paired: false };
	expect(() => behaviorFacts(input.duration, input.scenarios, input.paired)).toThrow(
		'title access failed'
	);
	recordExampleCases(
		{
			unitId: 'reports.helper.verification-evidence-behavior-facts',
			symbol: 'behaviorFacts',
			state: 'throws-input-access-error-when-reading-a-scenario-title',
			evidence: 'examples-cases',
			file: 'throws-input-access-error-when-reading-a-scenario-title.json'
		},
		[
			{
				name: 'propagates an exception from the scenario title getter',
				input: {
					duration: '1s',
					scenarios: [{ id: 'checkout', title: '[throws]', before: null, after: 'failed' }],
					paired: false
				},
				error: 'title access failed'
			}
		]
	);
});
