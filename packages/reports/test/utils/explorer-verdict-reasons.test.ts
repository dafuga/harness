import { expect, test } from 'vitest';
import type { HarnessRecord, HarnessRevision } from '../../src/models/Harness.types';
import { explorerVerdict } from '../../src/utils/explorerVerdict';
import { capture, complete, declared, record, result, revision, unit } from '../explorerFixture';

const page = unit('page.titles', 'page');
const proven = (records: HarnessRecord[], extra: Partial<HarnessRevision> = {}) =>
	explorerVerdict(page, revision([page], [declared()], records, extra));

test('what the record says failed about a unit is told for that unit, and for no other', () => {
	const failures = [
		'page.titles: source-bytes is 148 bytes against a baseline of 87 bytes',
		'function.other: has no baseline',
		'page.titles-extra: is another unit'
	];
	const said = record([result(complete())], { status: 'failed', failures });
	expect(proven([said])).toMatchObject({ passed: false, label: 'Verification failed' });
	expect(proven([said]).reasons).toEqual([failures[0]]);
	const other = unit('function.clock', 'function');
	const covered = declared({ units: ['page.titles', 'function.clock'] });
	expect(explorerVerdict(other, revision([other], [covered], [said])).passed).toBe(true);
});

test('a reason never names a source or runner file; a failed file test is counted, not located', () => {
	const tests = [
		{
			id: 'packages/app/test/a.test.ts',
			kind: 'unit',
			target: 'packages/app/test/a.test.ts',
			status: 'failed' as const,
			durationMs: 1
		},
		{
			id: 'packages/app/test/b.test.ts',
			kind: 'unit',
			target: 'packages/app/test/b.test.ts',
			status: 'failed' as const,
			durationMs: 1
		},
		{
			id: 'titles-page:page',
			kind: 'e2e',
			target: 'tests/e2e/page.spec.ts',
			status: 'passed' as const,
			durationMs: 1
		}
	];
	const failures = [
		'page.titles: +page in src/routes/titles/+page.svelte was modified without a reason'
	];
	const gone = capture({
		media: null,
		gap: 'evidence/a9/titles-page/empty-desktop.png is not stored'
	});
	const said = record([result([gone, complete()[1]])], { status: 'failed', tests, failures });
	const told = proven([said]).reasons;
	expect(told).toContain('2 tests of the record did not pass.');
	expect(told).toContain('page.titles: +page was modified without a reason');
	expect(told.join(' ')).not.toMatch(/[\w.-]+\/[\w./+-]+/);
	expect(told.join(' ')).toContain('is not stored');
	// A scenario check has a logical name, and that is what is said.
	const scoped = tests.map((item) =>
		item.id === 'titles-page:page'
			? { ...item, status: 'failed' as const }
			: { ...item, status: 'passed' as const }
	);
	expect(proven([record([result(complete())], { tests: scoped })]).reasons).toContain(
		'Test titles-page:page is failed, not passed.'
	);
});
