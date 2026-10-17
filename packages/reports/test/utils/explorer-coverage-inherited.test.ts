import { expect, test } from 'vitest';
import type { HarnessRecord, HarnessRevision } from '../../src/models/Harness.types';
import { explorerVerdict, verdictCoverage } from '../../src/utils/explorerVerdict';
import {
	complete,
	declared,
	impacted,
	record,
	result,
	revision,
	sha,
	unit
} from '../explorerFixture';

const page = unit('page.titles', 'page');
const proven = (records: HarnessRecord[], extra: Partial<HarnessRevision> = {}) =>
	explorerVerdict(page, revision([page], [declared()], records, extra));

const origin = { record: 'r0', commit: sha('b') };
const older = () =>
	complete().map((item) => ({ ...item, server: { buildId: 'build-0', revision: sha('b') } }));
const inherited = (extra: Parameters<typeof result>[1] = {}) =>
	record([
		result(older(), {
			status: 'referenced',
			inherited: true,
			originTests: [{ id: 'titles-page:page', status: 'passed' }],
			testedRevision: sha('b'),
			origin,
			...extra
		})
	]);

test('inherited proof needs the checks its origin ran: all of them, passed, and recorded at all', () => {
	const known = { sourceImpact: impacted(sha('b')) };
	expect(proven([inherited()], known).passed).toBe(true);
	// A history that does not keep the checks of the origin cannot show that they passed.
	const unstated = proven([inherited({ originTests: undefined })], known);
	expect(unstated).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	expect(unstated.reasons.join(' ')).toContain('does not record the checks');
	const absent = proven(
		[inherited({ originTests: [{ id: 'titles-page:other', status: 'passed' }] })],
		known
	);
	expect(absent).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	const failed = proven(
		[inherited({ originTests: [{ id: 'titles-page:page', status: 'failed' }] })],
		known
	);
	expect(failed).toMatchObject({ passed: false, label: 'Verification failed' });
	// The checks did not run again here, and a record that holds none of them still stands.
	const elsewhere = record(
		[
			result(older(), {
				status: 'referenced',
				inherited: true,
				originTests: [{ id: 'titles-page:page', status: 'passed' }],
				testedRevision: sha('b'),
				origin
			})
		],
		{
			tests: [{ id: 't1', kind: 'unit', target: 't1', status: 'passed', durationMs: 1 }]
		}
	);
	expect(proven([elsewhere], known).passed).toBe(true);
	const [covered] = verdictCoverage(page, revision([page], [declared()], [elsewhere], known));
	expect(covered.tests).toEqual([{ id: 'page', status: 'passed' }]);
});

test('inherited diagnostics belong to the origin check, never a different run at this commit', () => {
	const diagnostic = {
		test: 'Expected retry',
		file: 'orders.spec.ts',
		project: '',
		retry: 0,
		errors: [{ type: 'console' as const, message: 'Service unavailable', page: '/orders' }],
		expected: [{ type: 'console' as const, message: 'Service unavailable', reason: 'Tests retry.' }]
	};
	const originTests = [{ id: 'titles-page:page', status: 'passed', browserErrors: [diagnostic] }];
	const current = inherited({ originTests });
	current.tests.push({
		id: 'titles-page:page',
		kind: 'e2e',
		target: 'orders.spec.ts',
		status: 'failed',
		durationMs: 5,
		browserErrors: [{ ...diagnostic, test: 'Different run' }]
	});
	const [coverage] = verdictCoverage(
		page,
		revision([page], [declared()], [current], { sourceImpact: impacted(sha('b')) })
	);
	expect(coverage.inheritedFrom).toBe(sha('b'));
	expect(coverage.tests[0].browserErrors).toEqual([diagnostic]);
});
