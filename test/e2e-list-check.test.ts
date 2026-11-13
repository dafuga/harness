import { expect, test } from 'vitest';
import { compareE2eTests, declaredE2eTests } from '../scripts/check-e2e-list';

test('detects E2E files missing from the declared scripts and stale paths', () => {
	const declared = declaredE2eTests(
		'vitest run test/kept.e2e.test.ts test/stale.e2e.test.ts --reporter=dot'
	);
	expect(declared).toEqual(['test/kept.e2e.test.ts', 'test/stale.e2e.test.ts']);
	expect(
		compareE2eTests(
			['test/kept.e2e.test.ts', 'test/new.e2e.test.ts'],
			[...declared, 'test/new.e2e.test.ts']
		)
	).toEqual({
		missing: [],
		stale: ['test/stale.e2e.test.ts']
	});
	expect(compareE2eTests(['test/new.e2e.test.ts'], declared).missing).toEqual([
		'test/new.e2e.test.ts'
	]);
});
