import { expect, test } from 'vitest';
import type { SearchEntry } from '../../src/utils/entitySearch';
import { navbarSearch } from '../../src/components/harness/harness-navbar/navbarSearch';
import { sha, shellBranch, shellScope } from '../../tests/e2e/support/shellData';

/**
 * The search of the bar offers the entries of exactly the revision in view, and leads each result
 * to its entity in the branch and commit that are shown.
 */
const entry = (commit: string): SearchEntry => ({
	...{ id: 'app.shell.order-frame', category: 'layouts', name: 'Order frame', purpose: '' },
	...{ terms: [], commit }
});
const tip = shellScope({ branch: shellBranch, commit: null, category: 'pages' });
const pinned = shellScope({ branch: shellBranch, commit: sha(3), category: 'functions' });

test('at the tip a result leads to the entity at the tip, under its own category', () => {
	const search = navbarSearch(tip, [entry(sha(5))]);
	expect(search.entries).toEqual([entry(sha(5))]);
	expect(search.scope).toEqual({ label: `At the tip of ${shellBranch}`, pinned: null });
	expect(search.at(entry(sha(5)))).toEqual({
		branch: shellBranch,
		commit: null,
		category: 'layouts',
		entity: 'app.shell.order-frame'
	});
});

test('with a commit selected a result keeps the full commit', () => {
	const search = navbarSearch(pinned, [entry(sha(3))]);
	expect(search.scope).toEqual({
		label: `At commit ${sha(3).slice(0, 7)}`,
		pinned: sha(3).slice(0, 7)
	});
	expect(search.at(entry(sha(3)))).toMatchObject({ branch: shellBranch, commit: sha(3) });
});

test('entries read at another commit, or none yet, are not offered: the search is loading', () => {
	expect(navbarSearch(pinned, [entry(sha(5))]).entries).toBeNull();
	expect(navbarSearch(pinned, null).entries).toBeNull();
	expect(navbarSearch(null, [entry(sha(5))])).toMatchObject({
		entries: null,
		scope: { label: 'Reading the history', pinned: null }
	});
	expect(navbarSearch(pinned, []).entries).toEqual([]);
});

test('a result of an earlier commit is not followed at the commit now shown', () => {
	const search = navbarSearch(pinned, [entry(sha(3))]);
	expect(search.at(entry(sha(5)))).toBeNull();
	expect(search.at(entry(sha(3)))).not.toBeNull();
});

test('an id the accepted entries do not hold, or a held id under another category, is not followed', () => {
	const search = navbarSearch(pinned, [entry(sha(3))]);
	expect(search.at({ ...entry(sha(3)), id: 'app.shell.other-frame' })).toBeNull();
	expect(search.at({ ...entry(sha(3)), category: 'components' })).toBeNull();
});

test('while entries are read, refused or missing, no result is followed', () => {
	expect(navbarSearch(pinned, null).at(entry(sha(3)))).toBeNull();
	expect(navbarSearch(pinned, [entry(sha(5))]).at(entry(sha(5)))).toBeNull();
	expect(navbarSearch(null, [entry(sha(5))]).at(entry(sha(5)))).toBeNull();
});

test('a commit no branch keeps is searched alone, and its result keeps no branch', () => {
	const retained = shellScope({ branch: null, commit: sha(9), category: 'pages' });
	const search = navbarSearch(retained, [entry(sha(9))]);
	expect(search.scope).toEqual({
		label: `At commit ${sha(9).slice(0, 7)}`,
		pinned: sha(9).slice(0, 7)
	});
	expect(search.at(entry(sha(9)))).toEqual({
		branch: null,
		commit: sha(9),
		category: 'layouts',
		entity: 'app.shell.order-frame'
	});
});
