import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	defaultRuntimeTimeoutMs,
	runtimeFailure,
	runtimeTimeout
} from '../../src/core/execution-runtimes/runtimeTypes';

test('Builds a failure response with the supplied transport detail', () => {
	const cases = [
		{
			name: 'worker exits unexpectedly',
			input: { code: 'runtime-failed', message: 'worker exited unexpectedly' },
			output: runtimeFailure('runtime-failed', 'worker exited unexpectedly')
		},
		{
			name: 'response validation fails',
			input: { code: 'invalid-response', message: 'response shape is unsupported' },
			output: runtimeFailure('invalid-response', 'response shape is unsupported')
		}
	];
	expect(cases.map(({ output }) => output)).toEqual([
		{
			ok: false,
			error: { code: 'runtime-failed', message: 'worker exited unexpectedly' }
		},
		{
			ok: false,
			error: { code: 'invalid-response', message: 'response shape is unsupported' }
		}
	]);
	recordExampleCases(
		{
			unitId: 'function.runtime-types',
			symbol: 'runtimeFailure',
			state: 'builds-a-failure-response-with-the-supplied-transport-detail',
			evidence: 'examples-cases',
			file: 'builds-a-failure-response-with-the-supplied-transport-detail.json'
		},
		cases
	);
});

test('Formats timeout failures without enforcing a deadline', () => {
	const cases = [
		{ name: 'short runtime limit', input: 5000, output: runtimeTimeout(5000) },
		{ name: 'default runtime limit', input: 30000, output: runtimeTimeout(30000) }
	];
	expect(defaultRuntimeTimeoutMs).toBe(30000);
	expect(cases.map(({ output }) => output)).toEqual([
		{
			ok: false,
			error: { code: 'runtime-timeout', message: 'no response within 5000 ms' }
		},
		{
			ok: false,
			error: { code: 'runtime-timeout', message: 'no response within 30000 ms' }
		}
	]);
	recordExampleCases(
		{
			unitId: 'function.runtime-types',
			symbol: 'runtimeTimeout',
			state: 'formats-timeout-failures-without-enforcing-a-deadline',
			evidence: 'examples-cases',
			file: 'formats-timeout-failures-without-enforcing-a-deadline.json'
		},
		cases
	);
});
