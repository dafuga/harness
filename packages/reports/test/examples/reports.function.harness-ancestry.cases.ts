import { test } from 'vitest';
import type {
	HarnessIndex,
	HarnessRevisionSummary
} from '../../src/models/explorer-ui/Harness.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { branchCommits } from '../../src/components/explorer-ui/harness-navbar/harnessAncestry';
import { retainedBranch } from '../../src/utils/explorer-ui/harnessAncestry';

export const headCommit = '0123456789abcdef0123456789abcdef01234567';
export const parentCommit = '89abcdef0123456789abcdef0123456789abcdef';

export function revision(
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

export function indexOf(
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

export function mainIndex(): HarnessIndex {
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
