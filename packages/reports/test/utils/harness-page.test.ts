import { expect, test } from 'vitest';
import { harnessPage, homePath } from '../../src/utils/harness-page/harnessPage';
import { history, sha, summary } from '../explorerFixture';

const kept = 'feature/kept#1';
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
const encoded = 'feature%2Fkept%231';
const shown = (path: string, search = '') => {
	const page = harnessPage(index, path, search);
	return page.kind === 'page' ? page.scope : page;
};

test('the root opens Pages at the tip of the main branch', () => {
	expect(homePath(index)).toBe('/branch/main/pages');
	expect(harnessPage(index, '')).toEqual({ kind: 'redirect', path: '/branch/main/pages' });
	expect(harnessPage(index, '/')).toEqual({ kind: 'redirect', path: '/branch/main/pages' });
	expect(homePath(history())).toBeNull();
	expect(harnessPage(history(), '')).toMatchObject({ kind: 'missing', home: null });
});

test('a branch address is a page bound to the tip of that branch', () => {
	expect(
		shown('/branch/main/functions/function.case', '?tab=contract&helper=toKebabCase'),
		'callable URLs resolve a page rather than a redirect loop'
	).toMatchObject({ location: { helper: 'toKebabCase', tab: 'contract' } });
	expect(shown(`/branch/${encoded}/components`)).toMatchObject({
		mode: 'current',
		branch: kept,
		tip: sha('d'),
		commit: sha('d'),
		parent: sha('b'),
		location: { branch: kept, commit: null, category: 'components' }
	});
	expect(shown('/branch/main/functions/function.slugify/details', '?tab=source')).toEqual({
		kind: 'redirect',
		path: '/branch/main/functions/function.slugify?tab=source'
	});
	expect(shown('/branch/main/functions/function.slugify', '?tab=source')).toMatchObject({
		commit: sha('c'),
		location: { entity: 'function.slugify', tab: 'source' }
	});
});

test('a commit address is a page bound to that commit, with the tip beside it', () => {
	expect(shown(`/branch/main/commit/${sha('b')}/services/service.title/history`)).toMatchObject({
		mode: 'commit',
		tip: sha('c'),
		commit: sha('b'),
		parent: sha('a'),
		atTip: false
	});
});

test('a branch or a commit alone opens its Pages, keeping the scope', () => {
	expect(shown('/branch/main')).toEqual({ kind: 'redirect', path: '/branch/main/pages' });
	expect(shown(`/branch/${encoded}/commit/${sha('b')}`)).toEqual({
		kind: 'redirect',
		path: `/branch/${encoded}/commit/${sha('b')}/pages`
	});
	for (const path of [
		`/branch/${encoded}/pages/page.titles`,
		`/branch/${encoded}/commit/${sha('b')}/pages/page.titles`
	])
		expect(shown(path, '?tab=used-in')).toEqual({ kind: 'redirect', path });
});

test('an earlier page leads to the entity it showed, at the commit it named', () => {
	const earlier = `/branch/feature/kept%231/commit/${sha('b')}`;
	const scope = `/branch/${encoded}/commit/${sha('b')}`;
	expect(shown(`${earlier}/map`)).toEqual({ kind: 'redirect', path: `${scope}/pages` });
	expect(shown(`${earlier}/map/unit/page.titles`)).toEqual({
		kind: 'redirect',
		path: `${scope}/pages/page.titles`
	});
	expect(shown(`${earlier}/compare/${sha('a')}/unit/function.slugify`)).toEqual({
		kind: 'redirect',
		path: `${scope}/functions/function.slugify`
	});
	expect(shown(`${earlier}/growth/unit/service.title`)).toEqual({
		kind: 'redirect',
		path: `${scope}/services/service.title/history`
	});
	expect(shown(`${earlier}/activity`)).toEqual({ kind: 'redirect', path: `${scope}/pages` });
	expect(shown('', `?view=map&commit=${sha('b')}&unit=function.slugify`)).toEqual({
		kind: 'redirect',
		path: `/branch/main/commit/${sha('b')}/functions/function.slugify`
	});
});

test('a commit under the branchless form gets its branch, and a retained one keeps none', () => {
	expect(shown(`/commit/${sha('b')}/functions`)).toEqual({
		kind: 'redirect',
		path: `/branch/main/commit/${sha('b')}/functions`
	});
	expect(shown(`/commit/${sha('e')}/functions`)).toMatchObject({
		mode: 'commit',
		branch: null,
		tip: null,
		commit: sha('e')
	});
});

test('what the history does not hold is missing; no other revision is shown for it', () => {
	const home = '/branch/main/pages';
	expect(shown('/branch/nowhere/pages')).toEqual({
		kind: 'missing',
		message: 'Branch nowhere is not in this history.',
		home
	});
	expect(shown(`/branch/main/commit/${sha('d')}/pages`)).toEqual({
		kind: 'missing',
		message: 'Branch main does not contain commit ddddddd.',
		home
	});
	expect(shown(`/branch/main/commit/${sha('f')}/pages`)).toMatchObject({
		kind: 'missing',
		message: 'Commit fffffff is not in this history.'
	});
	expect(shown('/branch/main/nothing')).toMatchObject({
		kind: 'missing',
		message: 'This address names no page of the explorer.'
	});
	expect(shown('/branch/feature/kept%231/pages')).toMatchObject({ kind: 'missing' });
});
