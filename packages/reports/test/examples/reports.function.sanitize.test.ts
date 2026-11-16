import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { sanitize, cleanData } from '../../src/utils/development-tooling/sanitize';

test('Sanitize redacts credentials and URL details', () => {
	const input =
		'Retry with Bearer abc.def-123; DB_PASSWORD=hunter2; GET https://user:pw@api.example.com/v1/items?page=2#top';
	const output =
		'Retry with [REDACTED]; DB_PASSWORD=[REDACTED]; GET https://api.example.com/v1/items';
	expect(sanitize(input)).toBe(output);
	recordExampleCases(
		{
			unitId: 'reports.function.sanitize',
			symbol: 'sanitize',
			state: 'sanitize-redacts-credentials-and-url-details',
			evidence: 'examples-cases',
			file: 'sanitize-redacts-credentials-and-url-details.json'
		},
		[{ name: 'text with credential forms and a private URL', input, output }]
	);
});

test('Clean data recursively redacts sensitive fields', () => {
	const input = {
		event: 'deploy',
		target: 'https://user:pw@deploy.example.com/hook?token=abc',
		headers: { Authorization: 'Bearer abc.def' },
		attempt: 2
	};
	const output = {
		event: 'deploy',
		target: 'https://deploy.example.com/hook',
		headers: { Authorization: '[REDACTED]' },
		attempt: 2
	};
	expect(cleanData(input)).toEqual(output);
	recordExampleCases(
		{
			unitId: 'reports.function.sanitize',
			symbol: 'cleanData',
			state: 'clean-data-recursively-redacts-sensitive-fields',
			evidence: 'examples-cases',
			file: 'clean-data-recursively-redacts-sensitive-fields.json'
		},
		[{ name: 'deployment event with nested authorization', input, output }]
	);
});
