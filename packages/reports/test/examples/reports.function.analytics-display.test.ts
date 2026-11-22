import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { analyticsDisplay, analyticsCount } from '../../src/utils/reports-media/analyticsDisplay';

test('analytics-display-rounds-assessment-proportions-and-labels-m', () => {
	const inputs = [null, 0, 0.735];
	const cases = inputs.map((input) => ({
		name: input === null ? 'missing assessments' : `assessment fraction ${input}`,
		input,
		output: analyticsDisplay(input)
	}));
	expect(cases.map(({ output }) => output)).toEqual(['No assessments', '0%', '74%']);
	recordExampleCases(
		{
			unitId: 'reports.function.analytics-display',
			symbol: 'analyticsDisplay',
			state: 'analytics-display-rounds-assessment-proportions-and-labels-m',
			evidence: 'examples-cases',
			file: 'analytics-display-rounds-assessment-proportions-and-labels-m.json'
		},
		cases
	);
});

test('Analytics count uses the runtime locale formatting', () => {
	const inputs = [0, 1234, 1250.5];
	const cases = inputs.map((input) => ({
		name: `count ${input}`,
		input,
		output: analyticsCount(input)
	}));
	expect(cases.map(({ output }) => output)).toEqual(inputs.map((input) => input.toLocaleString()));
	recordExampleCases(
		{
			unitId: 'reports.function.analytics-display',
			symbol: 'analyticsCount',
			state: 'analytics-count-uses-the-runtime-locale-formatting',
			evidence: 'examples-cases',
			file: 'analytics-count-uses-the-runtime-locale-formatting.json'
		},
		cases
	);
});
