import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { browserErrorRows } from '../../src/components/shared-primitives/browser-errors/browserErrorRows';
import type { BrowserDiagnostic } from '../../../../src/core/development-tooling/browserDiagnostics';
import type { Cases } from './reports.function.browser-error-rows.test.types';
const unitId = 'reports.function.browser-error-rows';
const record = (state: string, cases: Cases) =>
	recordExampleCases(
		{
			unitId,
			symbol: 'browserErrorRows',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);

const run = { test: 'Retries', file: 'orders.spec.ts', project: 'chromium', retry: 0 };
const observed = {
	type: 'console' as const,
	message: 'Unavailable',
	page: '/orders',
	source: 'orders.js'
};
const expected = {
	type: 'console' as const,
	message: 'Unavailable',
	reason: 'Tests retry.',
	source: 'orders.js'
};

function diagnostic(
	errors: BrowserDiagnostic['errors'],
	expectations: BrowserDiagnostic['expected']
) {
	return { ...run, errors, expected: expectations } as BrowserDiagnostic;
}

test('An expectation matches one observed error with equal type, message and source, once', () => {
	const errors = [observed, { ...observed, stack: 'Repeated error' }];
	const rows = browserErrorRows(diagnostic(errors, [expected]));
	expect(rows).toEqual([
		{ ...observed, status: 'Expected', reason: 'Tests retry.' },
		{ ...errors[1], status: 'Unexpected' }
	]);
	record('exact-type-message-and-source-match-once', [
		{
			name: 'one expectation and two identical-looking errors',
			input: { errors, expected: [expected] },
			output: rows
		}
	]);
});

test('Different type, message or source stays Unexpected, while a sourceless expectation matches any source', () => {
	const sourceless = { type: 'console' as const, message: 'Unavailable', reason: 'Any source.' };
	const mismatched = [
		{ ...observed, source: 'other.js' },
		{ ...observed, type: 'pageerror' as const },
		{ ...observed, message: 'Unavailable later' }
	];
	const exactRows = browserErrorRows(diagnostic(mismatched, [expected]));
	expect(exactRows.map((row) => row.status)).toEqual([
		'Unexpected',
		'Unexpected',
		'Unexpected',
		'Missing expected error'
	]);
	expect(exactRows[3]).toMatchObject({ source: 'orders.js', reason: 'Tests retry.' });

	const elsewhere = { ...observed, source: 'elsewhere.js' };
	const sourcelessRows = browserErrorRows(diagnostic([elsewhere], [sourceless]));
	expect(sourcelessRows).toEqual([{ ...elsewhere, status: 'Expected', reason: 'Any source.' }]);
	record('mismatched-type-message-or-source-stays-unexpected', [
		{
			name: 'source, type and message differences against an exact expectation',
			input: { errors: mismatched, expected: [expected] },
			output: exactRows
		},
		{
			name: 'sourceless expectation matches an error from any source',
			input: { errors: [elsewhere], expected: [sourceless] },
			output: sourcelessRows
		}
	]);
});

test('Expectations left unused follow the observed rows as Missing expected error rows', () => {
	const second = { type: 'pageerror' as const, message: 'Boom', reason: 'Known crash.' };
	const rows = browserErrorRows(diagnostic([observed], [expected, second]));
	expect(rows).toEqual([
		{ ...observed, status: 'Expected', reason: 'Tests retry.' },
		{ ...second, status: 'Missing expected error' }
	]);
	expect(rows[1]).not.toHaveProperty('page');
	record('unused-expectations-become-missing-rows', [
		{
			name: 'one matched and one unused expectation in declaration order',
			input: { errors: [observed], expected: [expected, second] },
			output: rows
		}
	]);
});

test('Line, column, stack and page never affect whether an expectation matches', () => {
	const located = {
		...observed,
		page: '/checkout',
		line: 3,
		column: 4,
		stack: 'at orders.js:4:5'
	};
	const rows = browserErrorRows(diagnostic([located], [expected]));
	expect(rows).toEqual([{ ...located, status: 'Expected', reason: 'Tests retry.' }]);
	record('line-column-stack-and-page-are-not-compared', [
		{
			name: 'located error with a page, line, column and stack against a sourced expectation',
			input: { error: located, expected: [expected] },
			output: rows
		}
	]);
});

test('Observed rows keep their fields and the input diagnostic is left unchanged', () => {
	const input = diagnostic([observed, { ...observed, message: 'Other' }], [expected]);
	const before = structuredClone(input);
	const rows = browserErrorRows(input);
	expect(input).toEqual(before);
	expect(rows[0]).toEqual({ ...observed, status: 'Expected', reason: 'Tests retry.' });
	expect(rows[1]).toEqual({ ...observed, message: 'Other', status: 'Unexpected' });
	record('input-diagnostic-is-not-modified', [
		{
			name: 'two errors, one expectation; input compared before and after',
			input: before,
			output: { rows, inputUnchanged: true }
		}
	]);
});

test('A clean run with no expectations returns no rows', () => {
	const rows = browserErrorRows(diagnostic([], []));
	expect(rows).toEqual([]);
	record('clean-runs-without-expectations-return-no-rows', [
		{ name: 'no errors and no expectations', input: { errors: [], expected: [] }, output: rows }
	]);
});
