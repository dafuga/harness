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
test('global search starts as a single icon button with its query inside a closed modal', () => {
	const html = bar({ branch: shellBranch, commit: null, category: 'pages' });
	expect(html).toMatch(/aria-label="Search entities"/);
	expect(html).not.toMatch(/role="combobox"|role="listbox"|<input\b/);
	expect(html).toMatch(/aria-haspopup="dialog"/);
});
