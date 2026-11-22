import { test } from 'vitest';
import type { ExplorerLocation } from '../../../../src/utils/explorerRoute';
import { explorerScope, type ExplorerResolved } from '../../src/utils/explorer-ui/explorerScope';
import { history, sha, summary } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const unitId = 'reports.function.explorer-scope';
const index = history({
	branches: [
		{ name: 'main', head: sha('c') },
		{ name: 'feature/x', head: sha('d') },
		{ name: 'gone', head: sha('9') }
	],
	revisions: [
		summary(sha('d'), { parents: [sha('b')], branches: ['feature/x'] }),
		summary(sha('c'), { parents: [sha('b'), sha('d')], branches: ['main'] }),
		summary(sha('b'), { parents: [sha('a')], branches: ['main', 'feature/x'] }),
		summary(sha('a'), { parents: [], branches: ['main', 'feature/x'] }),
		summary(sha('e'), { parents: [sha('a')], branches: [], retained: true })
	]
});
const at = (branch: string | null, commit: string | null = null) =>
	({ branch, commit, category: 'functions' }) as ExplorerLocation;

/** The fields a reader sees of a resolution: the scope's pointers, or the missing message. */
function shown(found: ExplorerResolved): unknown {
	if (found.kind === 'missing') return found.message;
	const { mode, branch, tip, commit, atTip, parent } = found.scope;
	return { mode, branch, tip, commit, atTip, parent };
}

function resolveRows(rows: readonly (readonly [string, ExplorerLocation])[]) {
	return rows.map(([name, input]) => ({ name, input, output: explorerScope(index, input) }));
}

function record(state: string, cases: ReturnType<typeof resolveRows>): void {
	recordExampleCases(
		{ unitId, symbol: 'explorerScope', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('a branch address without a commit shows the recorded head of that branch', () => {
	const cases = resolveRows([
		['main shows its recorded head', at('main')],
		['feature branch shows its own head', at('feature/x')]
	]);
	expect(cases.map((item) => shown(item.output))).toEqual([
		{
			mode: 'current',
			branch: 'main',
			tip: sha('c'),
			commit: sha('c'),
			atTip: true,
			parent: sha('b')
		},
		{
			mode: 'current',
			branch: 'feature/x',
			tip: sha('d'),
			commit: sha('d'),
			atTip: true,
			parent: sha('b')
		}
	]);
	record('explorer-scope-branch-tip-default', cases);
});

test('a selected historical commit stays selected, with the branch tip beside it', () => {
	const cases = resolveRows([
		['ancestor stays selected', at('main', sha('b'))],
		['selected tip is still a commit selection', at('main', sha('c'))],
		['first commit of history has no parent', at('main', sha('a'))]
	]);
	expect(cases.map((item) => shown(item.output))).toEqual([
		{
			mode: 'commit',
			branch: 'main',
			tip: sha('c'),
			commit: sha('b'),
			atTip: false,
			parent: sha('a')
		},
		{
			mode: 'commit',
			branch: 'main',
			tip: sha('c'),
			commit: sha('c'),
			atTip: true,
			parent: sha('b')
		},
		{
			mode: 'commit',
			branch: 'main',
			tip: sha('c'),
			commit: sha('a'),
			atTip: false,
			parent: null
		}
	]);
	record('explorer-scope-selected-historical-commit', cases);
});

test('a stored commit that no branch reaches has no branch and no tip', () => {
	const cases = resolveRows([['unbranched commit keeps its first parent', at(null, sha('e'))]]);
	expect(cases.map((item) => shown(item.output))).toEqual([
		{
			mode: 'commit',
			branch: null,
			tip: null,
			commit: sha('e'),
			atTip: false,
			parent: sha('a')
		}
	]);
	record('explorer-scope-unbranched-commit-without-tip', cases);
});

test('an absent branch, tip, commit or pairing is reported and no other revision is shown', () => {
	const cases = resolveRows([
		['branch not in history', at('nowhere')],
		['branch whose recorded tip is absent', at('gone')],
		['commit not in history', at('main', sha('f'))],
		['commit not on the named branch', at('main', sha('d'))],
		['unknown commit without branch', at(null, sha('f'))]
	]);
	expect(cases.map((item) => shown(item.output))).toEqual([
		'Branch nowhere is not in this history.',
		'The tip of branch gone (9999999) is not in this history.',
		'Commit fffffff is not in this history.',
		'Branch main does not contain commit ddddddd.',
		'Commit fffffff is not in this history.'
	]);
	record('explorer-scope-absent-branch-or-revision-missing', cases);
});
