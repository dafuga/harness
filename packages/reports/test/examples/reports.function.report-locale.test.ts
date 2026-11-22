import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportLocale } from '../../src/utils/reports-media/reportLocale';

test('Report locale resolves to English on every call', () => {
	const first = reportLocale();
	const second = reportLocale();
	expect(first).toBe('en');
	expect(second).toBe('en');
	recordExampleCases(
		{
			unitId: 'reports.function.report-locale',
			symbol: 'reportLocale',
			state: 'report-locale-resolves-to-english-on-every-call',
			evidence: 'examples-cases',
			file: 'report-locale-resolves-to-english-on-every-call.json'
		},
		[
			{
				name: 'first call with no arguments returns English',
				input: {},
				output: first
			},
			{
				name: 'repeated call with no arguments still returns English',
				input: {},
				output: second
			}
		]
	);
});
