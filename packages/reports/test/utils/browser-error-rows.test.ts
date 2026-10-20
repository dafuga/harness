import { expect, test } from 'vitest';
import { browserErrorRows } from '../../src/components/browser-errors/browserErrorRows';

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
const run = { test: 'Retries', file: 'orders.spec.ts', project: 'chromium', retry: 0 };

test('one expectation accounts for one occurrence, preserving diagnostics and reasons', () => {
	const errors = [observed, { ...observed, stack: 'Repeated error' }];
	const rows = browserErrorRows({ ...run, errors, expected: [expected] });
	expect(rows).toEqual([
		{ ...observed, status: 'Expected', reason: expected.reason },
		{ ...errors[1], status: 'Unexpected' }
	]);
	expect(errors).toHaveLength(2);
});

test('a different source or error type does not fulfill the expected log', () => {
	const errors = [
		{ ...observed, source: 'other.js' },
		{ ...observed, type: 'pageerror' as const }
	];
	const rows = browserErrorRows({ ...run, errors, expected: [expected] });
	expect(rows.map((row) => row.status)).toEqual([
		'Unexpected',
		'Unexpected',
		'Missing expected error'
	]);
	expect(rows[2]).toMatchObject({ message: 'Unavailable', reason: 'Tests retry.' });
});

test('expected-only runs retain their missing error while clean runs have no rows', () => {
	expect(browserErrorRows({ ...run, errors: [], expected: [expected] })[0].status).toBe(
		'Missing expected error'
	);
	expect(browserErrorRows({ ...run, errors: [], expected: [] })).toEqual([]);
});
