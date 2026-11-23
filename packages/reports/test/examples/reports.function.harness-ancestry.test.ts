import { test } from 'vitest';
import type {
	HarnessIndex,
	HarnessRevisionSummary
} from '../../src/models/explorer-ui/Harness.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { branchCommits } from '../../src/components/explorer-ui/harness-navbar/harnessAncestry';
import { revisionLabel } from '../../src/components/explorer-ui/harness-selectors/harnessAncestry';
import { harnessAncestry } from '../../src/utils/explorer-ui/explorer-history/harnessAncestry';
import {
	retainedBranch,
	branchNames,
	defaultCommit,
	branchOf
} from '../../src/utils/explorer-ui/harnessAncestry';

const headCommit = '0123456789abcdef0123456789abcdef01234567';
const parentCommit = '89abcdef0123456789abcdef0123456789abcdef';
const unindexedCommit = 'fedcba9876543210fedcba9876543210fedcba98';

function revision(
	commit: string,
	overrides: Partial<HarnessRevisionSummary> = {}
): HarnessRevisionSummary {
	return {
		commit,
		parents: [],
		subject: 'Add report explorer',
		author: 'Ada Lovelace',
		committedAt: '2026-11-13T10:00:00.000Z',
		branches: [],
		retained: false,
		coverage: 'verified',
		gaps: [],
		records: [],
		legacy: [],
		...overrides
	};
}

function indexOf(
	revisions: HarnessRevisionSummary[],
	branches: HarnessIndex['branches'] = []
): HarnessIndex {
	return {
		branches,
		revisions,
		units: [],
		benchmarks: [],
		profiles: [],
		legacy: [],
		truncated: false,
		problems: []
	};
}

function mainIndex(): HarnessIndex {
	return indexOf(
		[
			revision(headCommit, {
				parents: [parentCommit],
				subject: 'Add ancestry selector',
				branches: ['main']
			}),
			revision(parentCommit, { retained: true, coverage: 'unverified' })
		],
		[{ name: 'main', head: headCommit }]
	);
}

test('Branch commits filter by branch and retained flag', () => {
	const index = mainIndex();
	const main = branchCommits(index, 'main').map((item) => item.commit);
	const retained = branchCommits(index, retainedBranch).map((item) => item.commit);
	const unknown = branchCommits(index, 'missing').map((item) => item.commit);
	expect(main).toEqual([headCommit]);
	expect(retained).toEqual([parentCommit]);
	expect(unknown).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.function.harness-ancestry',
			symbol: 'branchCommits',
			state: 'branch-commits-filter-by-branch-and-retained-flag',
			evidence: 'examples-cases',
			file: 'branch-commits-filter-by-branch-and-retained-flag.json'
		},
		[
			{ name: 'main branch lists its indexed commit', input: { branch: 'main' }, output: main },
			{
				name: 'Retained commits lists retained revisions',
				input: { branch: retainedBranch },
				output: retained
			},
			{ name: 'unknown branch yields nothing', input: { branch: 'missing' }, output: unknown }
		]
	);
});

test('Revision label joins hash, subject and coverage', () => {
	const verified = revisionLabel(
		revision(headCommit, { subject: 'Add ancestry selector', coverage: 'verified' })
	);
	const invalid = revisionLabel(revision(parentCommit, { coverage: 'invalid' }));
	const unverified = revisionLabel(revision(parentCommit, { coverage: 'unverified' }));
	expect(verified).toBe('0123456 Add ancestry selector · verified');
	expect(invalid).toBe('89abcde Add report explorer · evidence unusable');
	expect(unverified).toBe('89abcde Add report explorer · no evidence');
	recordExampleCases(
		{
			unitId: 'reports.function.harness-ancestry',
			symbol: 'revisionLabel',
			state: 'revision-label-joins-hash-subject-and-coverage',
			evidence: 'examples-cases',
			file: 'revision-label-joins-hash-subject-and-coverage.json'
		},
		[
			{ name: 'verified revision', input: { coverage: 'verified' }, output: verified },
			{ name: 'invalid evidence', input: { coverage: 'invalid' }, output: invalid },
			{ name: 'unverified revision', input: { coverage: 'unverified' }, output: unverified }
		]
	);
});

test('Ancestry follows indexed parents and stops at gaps', () => {
	const gapCommit = 'aaaa111122223333444455556666777788889999';
	const index = indexOf([
		revision(headCommit, { parents: [parentCommit] }),
		revision(parentCommit, { parents: [gapCommit] })
	]);
	const chain = Array.from(harnessAncestry(index, headCommit));
	const none = Array.from(harnessAncestry(index, unindexedCommit));
	expect(chain).toEqual([parentCommit, gapCommit]);
	expect(none).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.function.harness-ancestry',
			symbol: 'harnessAncestry',
			state: 'ancestry-follows-indexed-parents-and-stops-at-gaps',
			evidence: 'examples-cases',
			file: 'ancestry-follows-indexed-parents-and-stops-at-gaps.json'
		},
		[
			{
				name: 'indexed chain reaches the unindexed gap once',
				input: { commit: headCommit },
				output: chain
			},
			{ name: 'unindexed start has no parents', input: { commit: unindexedCommit }, output: none }
		]
	);
});

test('Branch names list indexed branches then retained', () => {
	const index = mainIndex();
	const names = branchNames(index);
	const withoutRetained = branchNames(
		indexOf([revision(headCommit, { branches: ['main'] })], [{ name: 'main', head: headCommit }])
	);
	expect(names).toEqual(['main', retainedBranch]);
	expect(withoutRetained).toEqual(['main']);
	recordExampleCases(
		{
			unitId: 'reports.function.harness-ancestry',
			symbol: 'branchNames',
			state: 'branch-names-list-indexed-branches-then-retained',
			evidence: 'examples-cases',
			file: 'branch-names-list-indexed-branches-then-retained.json'
		},
		[
			{ name: 'index with a retained revision', input: { branches: ['main'] }, output: names },
			{
				name: 'index without retained revisions',
				input: { branches: ['main'] },
				output: withoutRetained
			}
		]
	);
});

test('Default commit prefers asked commit then branch head', () => {
	const index = mainIndex();
	const asked = defaultCommit(index, parentCommit);
	const fallback = defaultCommit(index, unindexedCommit);
	expect(asked).toBe(parentCommit);
	expect(fallback).toBe(headCommit);
	recordExampleCases(
		{
			unitId: 'reports.function.harness-ancestry',
			symbol: 'defaultCommit',
			state: 'default-commit-prefers-asked-commit-then-branch-head',
			evidence: 'examples-cases',
			file: 'default-commit-prefers-asked-commit-then-branch-head.json'
		},
		[
			{ name: 'asked commit is indexed', input: { asked: parentCommit }, output: asked },
			{
				name: 'asked commit is unknown, branch head used',
				input: { asked: unindexedCommit },
				output: fallback
			}
		]
	);
});

test('Branch of commit gives retained or first branch', () => {
	const index = mainIndex();
	const retained = branchOf(index, parentCommit);
	const onBranch = branchOf(index, headCommit);
	const unknown = branchOf(index, unindexedCommit);
	expect(retained).toBe(retainedBranch);
	expect(onBranch).toBe('main');
	expect(unknown).toBe('main');
	recordExampleCases(
		{
			unitId: 'reports.function.harness-ancestry',
			symbol: 'branchOf',
			state: 'branch-of-commit-gives-retained-or-first-branch',
			evidence: 'examples-cases',
			file: 'branch-of-commit-gives-retained-or-first-branch.json'
		},
		[
			{ name: 'retained revision', input: { commit: parentCommit }, output: retained },
			{ name: 'revision on a source branch', input: { commit: headCommit }, output: onBranch },
			{
				name: 'unknown commit falls back to first branch',
				input: { commit: unindexedCommit },
				output: unknown
			}
		]
	);
});
