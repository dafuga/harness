import { expect, test } from 'vitest';
import type { HarnessIndex, HarnessRevisionSummary } from '../../src/models/Harness.types';
import {
	branchCommits,
	branchNames,
	branchOf,
	defaultCommit,
	harnessAncestry,
	retainedBranch
} from '../../src/utils/harnessAncestry';

const id = (letter: string) => letter.repeat(40);
function revision(letter: string, extra: Partial<HarnessRevisionSummary>): HarnessRevisionSummary {
	return {
		commit: id(letter),
		parents: [],
		subject: letter,
		author: 'Fixture',
		committedAt: '2026-10-10T00:00:00.000Z',
		branches: [],
		retained: false,
		coverage: 'unverified',
		gaps: [],
		records: [],
		legacy: [],
		...extra
	};
}
function index(revisions: HarnessRevisionSummary[], heads: Record<string, string>): HarnessIndex {
	return {
		branches: Object.entries(heads).map(([name, head]) => ({ name, head })),
		revisions,
		units: [],
		benchmarks: [],
		profiles: [],
		legacy: [],
		truncated: false,
		problems: []
	};
}

test('a branch whose commits the index left out is not offered, and never chosen by default', () => {
	// The index was cut to the newest commits: only the feature branch still has any in it.
	const truncated = index(
		[
			revision('c', { parents: [id('b')], branches: ['feature'] }),
			revision('b', { parents: [id('a')], branches: ['feature'] })
		],
		{ archive: id('z'), feature: id('c'), main: id('y') }
	);
	expect(branchNames(truncated)).toEqual(['feature']);
	expect(defaultCommit(truncated, id('z'))).toBe(id('c'));
	expect(defaultCommit(truncated, '')).toBe(id('c'));
	expect(defaultCommit(truncated, id('b'))).toBe(id('b'));
	expect(branchOf(truncated, id('c'))).toBe('feature');
	expect(defaultCommit(index([], { main: id('y') }), '')).toBe('');
});

test('ancestry follows recorded parents, and retained commits form their own entry', () => {
	const history = index(
		[
			revision('c', { parents: [id('b')], branches: ['main'] }),
			revision('b', { parents: [id('a')], branches: ['main'] }),
			revision('a', { branches: ['main'] }),
			revision('r', { parents: [id('a')], retained: true })
		],
		{ main: id('c') }
	);
	expect([...harnessAncestry(history, id('c'))].sort()).toEqual([id('a'), id('b')]);
	expect(harnessAncestry(history, id('r'))).toEqual(new Set([id('a')]));
	expect(branchNames(history)).toEqual(['main', retainedBranch]);
	expect(branchCommits(history, retainedBranch).map((item) => item.commit)).toEqual([id('r')]);
	expect(branchOf(history, id('r'))).toBe(retainedBranch);
	expect(defaultCommit(history, '')).toBe(id('c'));
});
