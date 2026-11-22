import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { skipsAnalytics } from '../../src/workflows/reports-media/skipsAnalytics';

const lookupInputs = [[], ['help'], ['info', 'topic'], ['--version'], ['-V']];
const helpInputs = [['export', '--help'], ['run', '-h'], ['export', '--', '--help']];
const ordinaryInputs = [['export'], ['run', '--', '-h'], ['export', '--', '--help']];

function labelled(inputs: readonly (readonly string[])[], outputs: readonly boolean[]) {
	return inputs.map((args, index) => ({
		name: `args ${JSON.stringify(args)}`,
		input: args,
		output: outputs[index]
	}));
}

test('Skips analytics for empty and lookup invocations', () => {
	const outputs = lookupInputs.map((args) => skipsAnalytics(args));
	expect(outputs).toEqual([true, true, true, true, true]);
	recordExampleCases(
		{
			unitId: 'workflow.reports-media-skips-analytics',
			symbol: 'skipsAnalytics',
			state: 'skips-analytics-for-empty-and-lookup-invocations',
			evidence: 'examples-cases',
			file: 'skips-analytics-for-empty-and-lookup-invocations.json'
		},
		labelled(lookupInputs, outputs)
	);
});

test('Skips analytics when help is before the option terminator', () => {
	const outputs = helpInputs.map((args) => skipsAnalytics(args));
	expect(outputs).toEqual([true, true, false]);
	recordExampleCases(
		{
			unitId: 'workflow.reports-media-skips-analytics',
			symbol: 'skipsAnalytics',
			state: 'skips-analytics-when-help-is-before-the-option-terminator',
			evidence: 'examples-cases',
			file: 'skips-analytics-when-help-is-before-the-option-terminator.json'
		},
		labelled(helpInputs, outputs)
	);
});

test('Keeps analytics for ordinary commands and help after the terminator', () => {
	const outputs = ordinaryInputs.map((args) => skipsAnalytics(args));
	expect(outputs).toEqual([false, false, false]);
	recordExampleCases(
		{
			unitId: 'workflow.reports-media-skips-analytics',
			symbol: 'skipsAnalytics',
			state: 'keeps-analytics-for-ordinary-commands-and-help-after-the-ter',
			evidence: 'examples-cases',
			file: 'keeps-analytics-for-ordinary-commands-and-help-after-the-ter.json'
		},
		labelled(ordinaryInputs, outputs)
	);
});
