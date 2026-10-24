import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import type { ExplorerLocation } from '../../src/models/Explorer.types';
import { retainedBranch } from '../../src/utils/harnessAncestry';
import { harnessShell } from '../../src/components/explorer-ui/harness-navbar/harnessShell';
import { plainClick, type HarnessNavbarInput } from '../../src/utils/harnessShell';
import {
	sha,
	shellBranch,
	shellCommits,
	shellHref,
	shellIndex,
	shellMount,
	shellScope
} from '../../tests/e2e/support/shellData';

const input = (location: ExplorerLocation | null): HarnessNavbarInput => ({
	base: shellMount,
	repository: 'synthetic-repository',
	scope: location ? shellScope(location) : null,
	index: shellIndex,
	commits: shellCommits(location?.branch ?? null),
	href: shellHref,
	onroute: () => {}
});
const view = (location: ExplorerLocation | null) => harnessShell(input(location));
const scoped = `${shellMount}/branch/feature%2Fshell%231`;
const historical: ExplorerLocation = {
	branch: shellBranch,
	commit: sha(4),
	category: 'functions',
	entity: 'function.slugify',
	section: 'details',
	tab: 'source'
};
const canonical = { ...historical };
delete canonical.section;

test('the bar groups module categories under five scoped primary destinations', async () => {
	await measureWorkload('reports.function.harness-shell', 'scoped-navbar-destinations', () => {
		const { categories } = view(historical);
		expect(categories.map((item) => [item.id, item.label, item.icon])).toEqual([
			['pages', 'Pages', 'pages'],
			['modules', 'Code', 'layers'],
			['translations', 'Translations', 'web'],
			['platforms', 'Platforms', 'platforms']
		]);
		expect(categories.map((item) => item.href)).toEqual(
			['pages', 'components', 'translations', 'platforms'].map(
				(category) => `${scoped}/commit/${sha(4)}/${category}`
			)
		);
		expect(categories.filter((item) => item.active).map((item) => item.id)).toEqual(['modules']);
		for (const category of [
			'layouts',
			'components',
			'models',
			'services',
			'functions',
			'types',
			'pages',
			'configs',
			'platforms'
		]) {
			const place = { ...historical, category } as ExplorerLocation;
			expect(view(place)).toMatchObject({
				modules: [
					'layouts',
					'components',
					'models',
					'services',
					'functions',
					'types',
					'configs',
					'styles',
					'dependencies'
				].map((id) => ({
					id,
					href: `${scoped}/commit/${sha(4)}/${id}`,
					active: id === category
				}))
			});
		}
	});
});

test('on a current branch route the viewed commit is the tip, and there is no tip to go to', () => {
	const { revision, home, categories } = view({
		branch: shellBranch,
		commit: null,
		category: 'pages'
	});
	expect(home).toEqual({
		href: `${scoped}/pages`,
		to: { branch: shellBranch, commit: null, category: 'pages' }
	});
	expect(categories[1].href).toBe(`${scoped}/components`);
	expect(revision).toMatchObject({
		branch: shellBranch,
		commit: sha(5),
		note: 'Tip · 0505050',
		viewed: 'Current · branch tip',
		tip: null
	});
	expect(revision?.commits.map((item) => item.commit)).toEqual([5, 4, 3, 2, 1].map(sha));
});

test('on a selected commit the tip and the viewed commit are told apart, and Go to tip keeps the place', () => {
	const { revision, home } = view(historical);
	expect(revision).toMatchObject({
		commit: sha(4),
		note: 'Tip · 0505050',
		viewed: 'Historical commit'
	});
	// The equivalent route of the current branch: the same entity, section and tab, no commit.
	expect(revision?.tip).toEqual({
		href: `${scoped}/functions/function.slugify?tab=source`,
		to: { ...canonical, commit: null }
	});
	// The brand opens Pages at the tip of the branch, whatever is viewed.
	expect(home.href).toBe(`${scoped}/pages`);
});

test('a selected commit that is the tip says both, and still leads to the current branch route', () => {
	const { revision } = view({ branch: shellBranch, commit: sha(5), category: 'configs' });
	expect(revision?.viewed).toBe('Selected commit · branch tip');
	expect(revision?.tip?.href).toBe(`${scoped}/configs`);
});

test('a branch stays in current mode on the same entity, and a commit is always an explicit route', () => {
	const { revision } = view(historical);
	expect(revision?.branchTo('main')).toEqual({ ...canonical, branch: 'main', commit: null });
	expect(revision?.commitTo(sha(2))).toEqual({ ...canonical, commit: sha(2) });
	const current = view({ branch: shellBranch, commit: null, category: 'pages' }).revision;
	// Choosing the tip itself from the current branch still names the commit in the address.
	expect(current?.commitTo(sha(5))).toEqual({
		branch: shellBranch,
		commit: sha(5),
		category: 'pages'
	});
});

test('a commit no branch reaches has no tip, says so, and is listed although no branch lists it', () => {
	const retained: ExplorerLocation = { branch: null, commit: sha(9), category: 'services' };
	const { revision, categories, home } = harnessShell({ ...input(retained), commits: [] });
	expect(revision).toMatchObject({
		branch: retainedBranch,
		commit: sha(9),
		note: 'No branch tip',
		viewed: 'Retained commit',
		tip: null
	});
	expect(revision?.commits.map((item) => item.commit)).toEqual([sha(9)]);
	expect(categories[0].href).toBe(`${shellMount}/commit/${sha(9)}/pages`);
	// Without a branch there is no tip to open: the brand leads to the mount.
	expect(home).toEqual({ href: shellMount, to: null });
	// Leaving a branch for the retained commits opens the newest of them, on no branch.
	const branched = view(historical).revision;
	expect(branched?.branchTo(retainedBranch)).toEqual({
		...canonical,
		branch: null,
		commit: sha(9)
	});
});

test('without a resolved address the bar keeps its navigation and offers no revision', () => {
	const { revision, categories, home } = view(null);
	expect(revision).toBeNull();
	expect(home).toEqual({ href: shellMount, to: null });
	expect(categories.map((item) => item.label)).toEqual([
		'Pages',
		'Code',
		'Translations',
		'Platforms'
	]);
	expect(view(null)).toMatchObject({ modules: [] });
	expect(categories.every((item) => item.href === null && item.to === null && !item.active)).toBe(
		true
	);
});

test('Styles stays active across branch and commit selection without becoming an entity category', () => {
	const styles: ExplorerLocation = {
		branch: shellBranch,
		commit: sha(4),
		category: 'pages',
		screen: 'styles'
	};
	const { categories, revision } = view(styles);
	expect(categories.filter((item) => item.active).map((item) => item.id)).toEqual(['modules']);
	expect(view(styles).modules.find((item) => item.id === 'styles')).toMatchObject({
		href: `${scoped}/commit/${sha(4)}/styles`,
		to: styles
	});
	expect(revision?.branchTo('main')).toEqual({ ...styles, branch: 'main', commit: null });
	expect(revision?.commitTo(sha(3))).toEqual({ ...styles, commit: sha(3) });
});

test('only a plain left click is followed inside the application', () => {
	const click = (changes: Partial<MouseEvent> = {}) =>
		({
			button: 0,
			metaKey: false,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			...changes
		}) as MouseEvent;
	expect(plainClick(click())).toBe(true);
	for (const changed of [
		{ button: 1 },
		{ metaKey: true },
		{ ctrlKey: true },
		{ shiftKey: true },
		{ altKey: true },
		{ defaultPrevented: true }
	])
		expect([changed, plainClick(click(changed))]).toEqual([changed, false]);
});
