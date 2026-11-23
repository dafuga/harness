import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { provideBrowser } from '../../src/routes/browserContext';
import { key, browserContext } from '../../src/utils/development-tooling/browserContext';

const unitId = 'hub.function.browser-context';

/** Runs a call that is expected to throw and returns the Error it threw. */
function errorOf(run: () => unknown): Error {
	try {
		run();
	} catch (error) {
		if (error instanceof Error) return error;
	}
	throw new Error('expected the call to throw an Error');
}

test('Context key is a symbol described as hosted browser', () => {
	expect(typeof key).toBe('symbol');
	expect(key.description).toBe('hosted browser');
	recordExampleCases(
		{
			unitId,
			symbol: 'key',
			state: 'context-key-is-a-symbol-described-as-hosted-browser',
			evidence: 'examples-cases',
			file: 'context-key-is-a-symbol-described-as-hosted-browser.json'
		},
		[
			{
				name: 'shared context key used by both functions',
				input: {},
				output: { type: 'symbol', description: key.description }
			}
		]
	);
});

test('Provide browser outside a component throws the Svelte error', () => {
	expect(() => provideBrowser()).toThrow(Error);
	const error = errorOf(() => provideBrowser());
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId,
			symbol: 'provideBrowser',
			state: 'provide-browser-outside-a-component-throws-the-svelte-error',
			evidence: 'examples-cases',
			file: 'provide-browser-outside-a-component-throws-the-svelte-error.json'
		},
		[{ name: 'called with no component initialization running', input: {}, error: error.name }]
	);
});

test('Browser context outside a component throws the Svelte error', () => {
	expect(() => browserContext()).toThrow(Error);
	const error = errorOf(() => browserContext());
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId,
			symbol: 'browserContext',
			state: 'browser-context-outside-a-component-throws-the-svelte-error',
			evidence: 'examples-cases',
			file: 'browser-context-outside-a-component-throws-the-svelte-error.json'
		},
		[{ name: 'called with no component initialization running', input: {}, error: error.name }]
	);
});
