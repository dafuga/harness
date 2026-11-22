import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { parseParameters, splitTopLevel, normalizeType } from '../../src/utils/development-tooling/parseParameters';

test('Extracts parameter fields and respects nested syntax', () => {
	const code = 'url: string, retries = 3, label?: string, callback: (value: Map<string, number>) => void';
	const options = { owner: 'request' };
	const parameters = parseParameters(code, code, options).map(({ name, type, required, default: value }) => ({
		name,
		type,
		required,
		...(value === undefined ? {} : { default: value })
	}));
	const nested = 'fn(a, b), next';
	const cuts = splitTopLevel(nested, ',');
	const normalized = normalizeType('  Promise < string > ; ');

	expect(parameters).toEqual([
		{ name: 'request.url', type: 'string', required: true },
		{ name: 'request.retries', type: 'number', required: false, default: 3 },
		{ name: 'request.label', type: 'string', required: false },
		{ name: 'request.callback', type: '(value: Map<string, number>) => void', required: true }
	]);
	expect(cuts).toEqual([8]);
	expect(normalized).toBe('Promise < string >');
	recordExampleCases(
		{
			unitId: 'function.parse-parameters',
			symbol: 'parseParameters',
			state: 'extracts-parameter-fields-and-respects-nested-syntax',
			evidence: 'examples-cases',
			file: 'extracts-parameter-fields-and-respects-nested-syntax.json'
		},
		[
			{ name: 'typed options with optional default and callback', input: { code, options }, output: parameters },
			{ name: 'top-level separator in nested call', input: { text: nested, separators: ',' }, output: cuts },
			{ name: 'collapse type whitespace and trailing punctuation', input: '  Promise < string > ; ', output: normalized }
		]
	);
});
