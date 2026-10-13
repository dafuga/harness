import { expect, test } from 'vitest';
import { revisionSummary } from '../../src/utils/revisionSummary';

const commit = 'a'.repeat(40);
const evidence = { commit, path: 'records/x', manifest: 'b'.repeat(64) };
const attached = (record: string, status: 'passed' | 'failed', problems: string[] = []) => ({
	record,
	status,
	valid: problems.length === 0,
	problems,
	evidence
});
const view = (id: string, base: string | null = null) => ({
	id,
	profile: 'profile-1',
	finishedAt: '2026-10-01T00:00:00.000Z',
	source: { commit, tree: commit, base }
});
const unverified = 'no verification record is attached to this commit';

test('a commit without a record is unverified, and says so', () => {
	expect(revisionSummary({ records: [] }, [])).toEqual({
		coverage: 'unverified',
		gaps: [unverified],
		records: []
	});
});

test('a usable passing record verifies the commit, whatever else is attached', () => {
	const status = { records: [attached('failed-1', 'failed'), attached('passed-1', 'passed')] };
	const summary = revisionSummary(status, [view('failed-1'), view('passed-1', commit)]);
	expect(summary.coverage).toBe('verified');
	expect(summary.gaps).toEqual([]);
	expect(summary.records).toEqual([
		{
			id: 'failed-1',
			status: 'failed',
			profile: 'profile-1',
			finishedAt: '2026-10-01T00:00:00.000Z',
			base: null,
			valid: true,
			problems: []
		},
		{
			id: 'passed-1',
			status: 'passed',
			profile: 'profile-1',
			finishedAt: '2026-10-01T00:00:00.000Z',
			base: commit,
			valid: true,
			problems: []
		}
	]);
	const failed = revisionSummary({ records: [attached('failed-1', 'failed')] }, [view('failed-1')]);
	expect(failed.coverage).toBe('failed');
});

test('records that cannot be used prove nothing, and each problem is a named gap', () => {
	const broken = attached('0123456789abcdef', 'passed', ['manifest is not valid', 'no seal']);
	const summary = revisionSummary({ records: [broken] }, []);
	expect(summary.coverage).toBe('invalid');
	expect(summary.gaps).toEqual([
		'record 0123456789ab: manifest is not valid',
		'record 0123456789ab: no seal'
	]);
	// A record that could not be read has no view: what it would state is not made up.
	expect(summary.records).toMatchObject([
		{ id: '0123456789abcdef', profile: 'unknown', finishedAt: 'unknown', base: null, valid: false }
	]);
	const beside = revisionSummary({ records: [broken, attached('passed-1', 'passed')] }, [
		view('passed-1')
	]);
	expect([beside.coverage, beside.gaps.length]).toEqual(['verified', 2]);
});
