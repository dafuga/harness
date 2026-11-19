import { test } from 'vitest';
import {
	commitBranch,
	consoleCanonical,
	defaultCommit,
	explorerHome,
	type IndexedHistory
} from '../../src/utils/console-canonical/consoleCanonical';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The console's canonical resolver is called as the console calls it: each case is a selected
 * revision, an indexed explorer home, or a revision the index does not hold, and what it returned
 * is asserted and recorded as the cases of its state.
 */

const id = (letter: string) => letter.repeat(40);
const index: IndexedHistory = {
	branches: [
		{ name: 'feature/kept#1', head: id('d') },
		{ name: 'main', head: id('c') },
		{ name: 'old', head: id('a') }
	],
	revisions: [
		{ commit: id('d'), branches: ['feature/kept#1'] },
		{ commit: id('c'), branches: ['main'] },
		{ commit: id('b'), branches: ['feature/kept#1', 'main'] },
		{ commit: id('e'), branches: [], retained: true }
	]
};
const empty: IndexedHistory = { branches: [], revisions: [] };
const retainedOnly: IndexedHistory = { branches: [], revisions: [index.revisions[3]] };
const feature: IndexedHistory = {
	branches: [index.branches[2], index.branches[0]],
	revisions: index.revisions
};
const root = (history: IndexedHistory) =>
	consoleCanonical(history, new URL('https://h/harness'), '/harness');
const address = (path: string) => consoleCanonical(index, new URL(`https://h${path}`), '/harness');

test('Preserves a selected console revision', () => {
	const indexed = defaultCommit(index, id('b'));
	const retained = defaultCommit(index, id('e'));
	const branch = commitBranch(index, id('b'));
	const retainedBranch = commitBranch(index, id('e'));
	const retainedPage = address(`/harness?commit=${id('e')}&view=growth`);
	const indexedPage = address(`/harness?commit=${id('b')}&view=history&unit=service.title`);
	expect(indexed).toBe(id('b'));
	expect(retained).toBe(id('e'));
	expect(branch).toBe('main');
	expect(retainedBranch).toBeNull();
	expect(retainedPage).toBe(`/harness/commit/${id('e')}/pages`);
	expect(indexedPage).toBe(`/harness/branch/main/commit/${id('b')}/services/service.title/history`);
	recordExampleCases(
		{
			unitId: 'function.console-canonical',
			symbol: 'defaultCommit',
			state: 'console-canonical-preserves-a-selected-console-revision',
			evidence: 'examples-cases',
			file: 'console-canonical-preserves-a-selected-console-revision.json'
		},
		[
			{ name: 'indexed commit asked for is kept', input: { asked: id('b') }, output: indexed },
			{ name: 'retained commit asked for is kept', input: { asked: id('e') }, output: retained }
		]
	);
});

test('Chooses an indexed explorer home', () => {
	const home = explorerHome(index);
	const featureHome = explorerHome(feature);
	const retainedHome = explorerHome(retainedOnly);
	const none = explorerHome(empty);
	expect(home).toEqual({ branch: 'main', commit: null, category: 'pages' });
	expect(featureHome).toEqual({ branch: 'feature/kept#1', commit: null, category: 'pages' });
	expect(retainedHome).toEqual({ branch: null, commit: id('e'), category: 'pages' });
	expect(none).toBeUndefined();
	expect(root(index)).toBe('/harness/branch/main/pages');
	recordExampleCases(
		{
			unitId: 'function.console-canonical',
			symbol: 'explorerHome',
			state: 'console-canonical-chooses-an-indexed-explorer-home',
			evidence: 'examples-cases',
			file: 'console-canonical-chooses-an-indexed-explorer-home.json'
		},
		[
			{
				name: 'main branch tip is indexed',
				input: { index: 'main and feature heads' },
				output: home
			},
			{
				name: 'only a feature branch tip is indexed',
				input: { index: 'feature head and main missing' },
				output: featureHome
			},
			{
				name: 'only retained commits are indexed',
				input: { index: 'retained commit' },
				output: retainedHome
			}
		]
	);
});

test('Handles an unavailable revision', () => {
	const unknown = id('f');
	const fallback = defaultCommit(index, unknown);
	const none = defaultCommit(empty, unknown);
	const branch = commitBranch(index, unknown);
	const page = address(`/harness?commit=${unknown}`);
	expect(fallback).toBe(id('c'));
	expect(none).toBe('');
	expect(branch).toBeNull();
	expect(page).toBe('/harness/branch/main/pages');
	recordExampleCases(
		{
			unitId: 'function.console-canonical',
			symbol: 'defaultCommit',
			state: 'console-canonical-handles-an-unavailable-revision',
			evidence: 'examples-cases',
			file: 'console-canonical-handles-an-unavailable-revision.json'
		},
		[
			{
				name: 'unindexed commit falls back to the main tip',
				input: { asked: unknown },
				output: fallback
			},
			{
				name: 'unindexed commit in empty history gives an empty commit',
				input: { asked: unknown, index: 'empty' },
				output: none
			}
		]
	);
});
