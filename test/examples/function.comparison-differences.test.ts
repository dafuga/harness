import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { comparisonDifferences } from '../../src/services/verification-evidence/budget-service/comparisonDifferences';
import type { MeasuredDefinition } from '../../src/utils/verification-evidence/comparisonDifferences';

const METHOD = 'warm-up calls, then rounds of timed whole invocations';
const REQUEST = '9c4e1a7f3b0d52e86a1f4c9b7d20e35a8f6b1c4d9e2a7f0b3c5d8e1a6f4b2c09';
const OTHER_REQUEST = 'd61b8f2a0c7e4953b1a6d8f0e2c75a94b3e1f7d02c8a6b5e9f4d13a7c0e26b18';

const context = (request: string, iterations: number) => ({
	request,
	boundary: 'public-invocation',
	protocol: 'harness-rounds/1',
	sampling: { warmup: 3, rounds: 10, iterations }
});

const definition = (comparison?: unknown): MeasuredDefinition => ({
	unitOfMeasure: 'ms',
	method: METHOD,
	...(comparison === undefined ? {} : { comparison })
});

const meta = (state: string) => ({
	unitId: 'function.comparison-differences',
	symbol: 'comparisonDifferences',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('Identical latency definitions are comparable', () => {
	const metric = 'latency-warm-ms';
	const measured = definition(context(REQUEST, 100));
	const baseline = definition(context(REQUEST, 100));
	const verdict = comparisonDifferences(metric, measured, baseline);

	expect(verdict).toEqual({ status: 'comparable', differences: [] });
	recordExampleCases(meta('identical-latency-definitions-are-comparable'), [
		{
			name: 'same request, sampling, unit and method as the baseline',
			input: { metric, measured, baseline },
			output: verdict
		}
	]);
});

test('Missing comparison context makes the verdict incomplete', () => {
	const metric = 'latency-warm-ms';
	const measured = definition();
	const baseline = definition(context(REQUEST, 100));
	const verdict = comparisonDifferences(metric, measured, baseline);

	expect(verdict).toEqual({
		status: 'incomplete',
		differences: ['the measurement states no comparison context']
	});
	recordExampleCases(meta('missing-comparison-context-makes-the-verdict-incomplete'), [
		{
			name: 'measurement states no comparison, baseline is complete',
			input: { metric, measured, baseline },
			output: verdict
		}
	]);
});

test('Different request and sampling are incompatible', () => {
	const metric = 'latency-warm-ms';
	const measured = definition(context(REQUEST, 100));
	const baseline = definition(context(OTHER_REQUEST, 50));
	const verdict = comparisonDifferences(metric, measured, baseline);

	expect(verdict.status).toBe('incompatible');
	expect(verdict.differences).toEqual([
		'request 9c4e1a7f3b0d differs from the baseline request d61b8f2a0c7e',
		'sampling is 10 rounds of 100 calls after 3 warm-up calls, the baseline used 10 rounds of 50 calls after 3 warm-up calls'
	]);
	recordExampleCases(meta('different-request-and-sampling-are-incompatible'), [
		{
			name: 'different request digest and iterations than the baseline',
			input: { metric, measured, baseline },
			output: verdict
		}
	]);
});
