import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	runtimeResponse,
	runtimeResponseText,
	runtimeDeadline
} from '../../src/utils/execution-runtimes/runtimeResponse';
import type { RuntimeDeadline } from '../../src/utils/execution-runtimes/runtimeResponse.types';

test('Validates runtime response envelopes', () => {
	const success = { ok: true, output: { exitCode: 0, stdout: 'built 12 files\n' } };
	const failure = { ok: false, error: { code: 'invalid-response', message: 'bad reply' } };
	const invalid = runtimeResponse({ result: 42 });
	expect(runtimeResponse(success)).toBe(success);
	expect(runtimeResponse(failure)).toBe(failure);
	expect(invalid).toEqual({
		ok: false,
		error: {
			code: 'invalid-response',
			message: 'runtime returned a value that is not a response envelope'
		}
	});
	recordExampleCases(
		{
			unitId: 'function.runtime-response',
			symbol: 'runtimeResponse',
			state: 'validates-runtime-response-envelopes',
			evidence: 'examples-cases',
			file: 'validates-runtime-response-envelopes.json'
		},
		[
			{ name: 'successful build response', input: success, output: success },
			{ name: 'runtime failure response', input: failure, output: failure },
			{ name: 'non-envelope value', input: { result: 42 }, output: invalid }
		]
	);
});

test('Parses runtime response text', () => {
	const text = '{"ok":true,"output":{"exitCode":0}}';
	const parsed = runtimeResponseText(text);
	const malformed = runtimeResponseText('runtime exited with code 137 before writing a reply');
	const invalidJsonValue = runtimeResponseText('{"result":42}');
	expect(parsed).toEqual({ ok: true, output: { exitCode: 0 } });
	expect(malformed).toMatchObject({
		ok: false,
		error: { code: 'invalid-response', message: 'runtime returned text that is not JSON' }
	});
	expect(invalidJsonValue).toMatchObject({
		ok: false,
		error: {
			code: 'invalid-response',
			message: 'runtime returned a value that is not a response envelope'
		}
	});
	recordExampleCases(
		{
			unitId: 'function.runtime-response',
			symbol: 'runtimeResponseText',
			state: 'parses-runtime-response-text',
			evidence: 'examples-cases',
			file: 'parses-runtime-response-text.json'
		},
		[
			{ name: 'valid JSON envelope', input: text, output: parsed },
			{
				name: 'transport text is not JSON',
				input: 'runtime exited with code 137 before writing a reply',
				output: malformed
			},
			{ name: 'JSON value is not an envelope', input: '{"result":42}', output: invalidJsonValue }
		]
	);
});

test('Applies runtime deadline to call results', async () => {
	const response = { ok: true, output: { exitCode: 0 } } as const;
	const immediate = runtimeDeadline(5000) satisfies RuntimeDeadline;
	const settled = immediate.settle(response);
	const expired = runtimeDeadline(0);
	const timeout = await expired.expired;
	expect(settled).toBe(response);
	expect(timeout).toMatchObject({ ok: false, error: { code: 'runtime-timeout' } });
	expect(expired.settle(response)).toMatchObject({ ok: false, error: { code: 'runtime-timeout' } });
	recordExampleCases(
		{
			unitId: 'function.runtime-response',
			symbol: 'runtimeDeadline',
			state: 'applies-runtime-deadline-to-call-results',
			evidence: 'examples-cases',
			file: 'applies-runtime-deadline-to-call-results.json'
		},
		[
			{
				name: 'result arrives within deadline',
				input: { timeoutMs: 5000, response },
				output: settled
			},
			{ name: 'deadline timer expires', input: { timeoutMs: 0 }, output: timeout },
			{
				name: 'settle checks elapsed time',
				input: { timeoutMs: 0, response },
				output: expired.settle(response)
			}
		]
	);
});
