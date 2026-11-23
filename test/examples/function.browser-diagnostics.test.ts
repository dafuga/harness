import type { Refusal, ExampleCase } from './function.browser-diagnostics.test.types';
import { test } from 'vitest';
import { browserDiagnosticSchema } from '../../src/core/development-tooling/browserDiagnostics';
import type { BrowserDiagnostic } from '../../src/core/development-tooling/browserDiagnostics.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const complete: BrowserDiagnostic = {
	test: 'Shows the dashboard with its recorded browser errors',
	file: 'test/e2e/dashboard.spec.ts',
	project: 'desktop',
	retry: 0,
	browser: 'chromium',
	errors: [
		{
			type: 'console',
			message: 'Failed to load resource: 503',
			page: '/dashboard',
			source: 'https://localhost/api/items',
			line: 0,
			column: 0
		},
		{
			type: 'pageerror',
			message: 'ResizeObserver loop limit exceeded',
			page: '/dashboard',
			source: 'app.js',
			line: 12,
			column: 4,
			stack: 'Error: ResizeObserver loop limit exceeded\n    at app.js:12:4'
		}
	],
	expected: [
		{
			type: 'pageerror',
			message: 'ResizeObserver loop limit exceeded',
			reason: 'Benign browser notice declared by this test.',
			source: 'app.js'
		}
	]
};

const empty: BrowserDiagnostic = {
	test: 'Loads a page without recorded errors',
	file: '',
	project: '',
	retry: 1,
	errors: [],
	expected: []
};

const blankObserved: BrowserDiagnostic = {
	test: 'Keeps an observed entry whose message and page are empty',
	file: 'test/e2e/blank.spec.ts',
	project: 'desktop',
	retry: 0,
	errors: [{ type: 'console', message: '', page: '' }],
	expected: []
};

/** Each zod issue as its path and code; the root of the value is named record. */
function refusals(error: {
	issues: ReadonlyArray<{ code: string; path: PropertyKey[] }>;
}): Refusal[] {
	return error.issues.map((issue) => ({
		code: issue.code,
		path: issue.path.length > 0 ? issue.path.map(String).join('.') : 'record'
	}));
}

/** A value with one defect, copied from a complete attempt so only that defect differs. */
function withDefect(change: Record<string, unknown>): unknown {
	return { ...complete, ...change };
}

const malformed: Array<{ name: string; input: unknown; expected: Refusal[] }> = [
	{
		name: 'empty test name',
		input: withDefect({ test: '' }),
		expected: [{ code: 'too_small', path: 'test' }]
	},
	{
		name: 'negative retry',
		input: withDefect({ retry: -1 }),
		expected: [{ code: 'too_small', path: 'retry' }]
	},
	{
		name: 'fractional retry',
		input: withDefect({ retry: 1.5 }),
		expected: [{ code: 'invalid_type', path: 'retry' }]
	},
	{
		name: 'missing expected array',
		input: { ...complete, expected: undefined },
		expected: [{ code: 'invalid_type', path: 'expected' }]
	},
	{
		name: 'unknown observed type',
		input: withDefect({
			errors: [{ type: 'warning', message: 'Slow', page: '/dashboard' }]
		}),
		expected: [{ code: 'invalid_value', path: 'errors.0.type' }]
	},
	{
		name: 'negative observed line',
		input: withDefect({
			errors: [{ type: 'pageerror', message: 'Boom', page: '/', line: -3 }]
		}),
		expected: [{ code: 'too_small', path: 'errors.0.line' }]
	},
	{
		name: 'observed entry with an undeclared key',
		input: withDefect({
			errors: [{ type: 'console', message: 'Boom', page: '/', retries: 2 }]
		}),
		expected: [{ code: 'unrecognized_keys', path: 'errors.0' }]
	},
	{
		name: 'expected entry with an empty reason',
		input: withDefect({
			expected: [{ type: 'console', message: 'Boom', reason: '' }]
		}),
		expected: [{ code: 'too_small', path: 'expected.0.reason' }]
	},
	{
		name: 'undeclared key on the attempt',
		input: withDefect({ duration: 12 }),
		expected: [{ code: 'unrecognized_keys', path: 'record' }]
	},
	{
		name: 'attempt that is not an object',
		input: 'Shows the dashboard',
		expected: [{ code: 'invalid_type', path: 'record' }]
	}
];

test('Accepts recorded attempts with observed and expected diagnostics', () => {
	const values = [complete, empty, blankObserved];
	const results = values.map((value) => browserDiagnosticSchema.safeParse(value));
	for (const [index, result] of results.entries()) {
		expect(result.success).toBe(true);
		expect(result.data).toEqual(values[index]);
	}
	const cases: ExampleCase[] = [
		{
			name: 'complete attempt with console and pageerror entries and a declared expectation',
			input: complete,
			output: results[0].data
		},
		{ name: 'empty file, project, errors and expected', input: empty, output: results[1].data },
		{
			name: 'observed entry whose message and page are empty strings',
			input: blankObserved,
			output: results[2].data
		}
	];
	recordExampleCases(
		{
			unitId: 'function.browser-diagnostics',
			symbol: 'browserDiagnosticSchema',
			state: 'accepts-recorded-attempts',
			evidence: 'examples-cases',
			file: 'accepts-recorded-attempts.json'
		},
		cases
	);
});

test('Refuses malformed attempts and undeclared keys with exact reasons', () => {
	const cases: ExampleCase[] = malformed.map(({ name, input, expected }) => {
		const result = browserDiagnosticSchema.safeParse(input);
		expect(result.success).toBe(false);
		const found = result.success ? [] : refusals(result.error);
		expect(found).toEqual(expected);
		return { name, input, error: found };
	});
	recordExampleCases(
		{
			unitId: 'function.browser-diagnostics',
			symbol: 'browserDiagnosticSchema',
			state: 'refuses-malformed-attempts',
			evidence: 'examples-cases',
			file: 'refuses-malformed-attempts.json'
		},
		cases
	);
});
