import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HarnessNavbar from '../src/components/harness/HarnessNavbar.svelte';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import type { SearchEntry } from '../src/utils/entitySearch';
import {
	sha,
	shellBranch,
	shellCommits,
	shellHref,
	shellIndex,
	shellMount,
	shellScope
} from '../tests/e2e/support/shellData';

/**
 * The bar of every explorer route holds one search over the revision in view. It says which
 * commit it searches when one is selected, and says it is loading while there is nothing to search.
 */
const entries: SearchEntry[] = [
	{
		id: 'app.page.orders',
		category: 'pages',
		name: 'Orders',
		purpose: 'Lists orders.',
		terms: [],
		commit: sha(5)
	}
];
const bar = (location: ExplorerLocation, search: { entries: SearchEntry[] | null } = { entries }) =>
	render(HarnessNavbar, {
		props: {
			base: shellMount,
			repository: 'synthetic-repository',
			scope: shellScope(location),
			index: shellIndex,
			commits: shellCommits(location.branch),
			href: shellHref,
			onroute: () => {},
			search
		}
	}).body.replace(/<!--.*?-->/gs, '');
const field = (html: string) => /<input\b[^>]*role="combobox"[^>]*>/s.exec(html)?.[0] ?? '';

test('the bar holds one search field labelled for entities, as a combobox of a listbox', () => {
	const html = bar({ branch: shellBranch, commit: null, category: 'pages' });
	expect(html.match(/role="combobox"/g)).toHaveLength(1);
	expect(field(html)).toMatch(/aria-label="Search entities"/);
	expect(field(html)).toMatch(/aria-expanded="false"/);
	expect(field(html)).toMatch(/placeholder="Search entities"/);
});

test('with a commit selected the field says the commit it searches', () => {
	const html = bar({ branch: shellBranch, commit: sha(3), category: 'functions' });
	expect(field(html)).toMatch(new RegExp(`placeholder="Search at ${sha(3).slice(0, 7)}"`));
});

test('while the revision is read the field says so and offers no results', () => {
	const html = bar({ branch: shellBranch, commit: null, category: 'pages' }, { entries: null });
	expect(field(html)).toMatch(/placeholder="Loading entities…"/);
	expect(html).not.toMatch(/role="option"/);
});
