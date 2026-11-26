import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { harnessPage, homePath } from '../../src/utils/explorer-ui/harness-page/harnessPage';
import { history, sha, summary } from '../explorerFixture';
import type { Cases } from './reports.function.harness-page.test.types';
const unitId = 'reports.function.harness-page';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const kept = 'feature/kept#1';
const encoded = 'feature%2Fkept%231';
const index = history({
	branches: [
		{ name: kept, head: sha('d') },
		{ name: 'main', head: sha('c') }
	],
	revisions: [
		summary(sha('d'), { parents: [sha('b')], branches: [kept] }),
		summary(sha('c'), { parents: [sha('b')], branches: ['main'] }),
		summary(sha('b'), { parents: [sha('a')], branches: [kept, 'main'] }),
		summary(sha('a'), { parents: [], branches: [kept, 'main'] }),
		summary(sha('e'), { parents: [sha('a')], branches: [], retained: true })
	]
});
const stale = history({
	branches: [
		{ name: 'main', head: sha('c') },
		{ name: 'stale', head: sha('z') }
	],
	revisions: [summary(sha('c'), { branches: ['main'] })]
});

/** One recorded case: the call's arguments and the actual page it returned. */
const probe = (name: string, path: string, search = '', source = index) => ({
	name,
	input: { index: source, path, search },
	output: harnessPage(source, path, search)
});

test('the root opens Pages at the tip of the main branch', () => {
	const empty = history();
	expect(homePath(index)).toBe('/branch/main/pages');
	expect(homePath(empty)).toBeNull();
	expect(harnessPage(index, '/')).toEqual({ kind: 'redirect', path: '/branch/main/pages' });
	record('homePath', 'the-root-opens-pages-at-the-tip-of-the-main-branch', [
		{ name: 'main branch head is a revision', input: index, output: homePath(index) },
		{ name: 'history with no revision', input: empty, output: homePath(empty) }
	]);
});

test('a branch address projects the page bound to the branch tip', () => {
	const branch = harnessPage(index, `/branch/${encoded}/components`);
	const named = harnessPage(index, '/branch/main/functions/function.slugify', '?tab=source');
	expect(branch).toMatchObject({
		kind: 'page',
		scope: {
			mode: 'current',
			branch: kept,
			tip: sha('d'),
			commit: sha('d'),
			parent: sha('b'),
			atTip: true,
			location: { branch: kept, category: 'components' }
		}
	});
	expect(named).toMatchObject({
		kind: 'page',
		scope: { commit: sha('c'), location: { entity: 'function.slugify', tab: 'source' } }
	});
	record('harnessPage', 'a-branch-address-projects-the-page-bound-to-the-branch-tip', [
		probe('branch address without a commit', `/branch/${encoded}/components`),
		probe(
			'branch entity address with a tab query',
			'/branch/main/functions/function.slugify',
			'?tab=source'
		)
	]);
});

test('a commit address projects its scope with the branch tip beside it', () => {
	const commit = harnessPage(
		index,
		`/branch/main/commit/${sha('b')}/services/service.title/history`
	);
	const retained = harnessPage(index, `/commit/${sha('e')}/functions`);
	expect(commit).toMatchObject({
		kind: 'page',
		scope: { mode: 'commit', tip: sha('c'), commit: sha('b'), parent: sha('a'), atTip: false }
	});
	expect(retained).toMatchObject({
		kind: 'page',
		scope: { mode: 'commit', branch: null, tip: null, commit: sha('e') }
	});
	record('harnessPage', 'a-commit-address-projects-its-scope-with-the-branch-tip-beside-it', [
		probe(
			'commit on a branch keeps the tip beside it',
			`/branch/main/commit/${sha('b')}/services/service.title/history`
		),
		probe('retained commit keeps no branch', `/commit/${sha('e')}/functions`)
	]);
});

test('a branch or commit the history does not hold is missing', () => {
	const home = '/branch/main/pages';
	expect(harnessPage(index, '/branch/nowhere/pages')).toEqual({
		kind: 'missing',
		message: 'Branch nowhere is not in this history.',
		home
	});
	expect(harnessPage(index, `/branch/main/commit/${sha('d')}/pages`)).toEqual({
		kind: 'missing',
		message: 'Branch main does not contain commit ddddddd.',
		home
	});
	expect(harnessPage(index, `/branch/main/commit/${sha('f')}/pages`)).toEqual({
		kind: 'missing',
		message: 'Commit fffffff is not in this history.',
		home
	});
	expect(harnessPage(index, '/branch/main/nothing')).toEqual({
		kind: 'missing',
		message: 'This address names no page of the explorer.',
		home
	});
	record('harnessPage', 'a-branch-or-commit-the-history-does-not-hold-is-missing', [
		probe('branch is not in the history', '/branch/nowhere/pages'),
		probe('commit is on no branch of the named branch', `/branch/main/commit/${sha('d')}/pages`),
		probe('commit is not in the history', `/branch/main/commit/${sha('f')}/pages`),
		probe('address names no page', '/branch/main/nothing')
	]);
});

test('a history with no revision has no home and a missing root', () => {
	const empty = history();
	expect(harnessPage(empty, '')).toEqual({
		kind: 'missing',
		message: 'This history holds no commit.',
		home: null
	});
	record('harnessPage', 'a-history-with-no-revision-has-no-home-and-a-missing-root', [
		probe('root of a history with no revision', '', '', empty)
	]);
});

test('a branch whose tip the history does not hold is unresolved', () => {
	expect(harnessPage(stale, '/branch/stale/pages')).toEqual({
		kind: 'missing',
		message: 'The tip of branch stale (zzzzzzz) is not in this history.',
		home: '/branch/main/pages'
	});
	record('harnessPage', 'a-branch-whose-tip-the-history-does-not-hold-is-unresolved', [
		probe('branch head is not a revision of the history', '/branch/stale/pages', '', stale)
	]);
});
