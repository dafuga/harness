import { render } from 'svelte/server';
import { test } from 'vitest';
import ShellsPage from '../../src/routes/harness/branch/[branch]/[...at]/shells/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The evidence of one state: its cases, under the page's markup output. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-branch-branch-at-shells',
	symbol: '+page',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/**
 * Renders the real page as SvelteKit would render it for a request: the page reads only the URL
 * of the request (through the harness screen), so the context names just that. The addresses are
 * made up for the example.
 */
const renderAt = (pathname: string) =>
	render(ShellsPage, {
		context: new Map([['__request__', { page: { url: new URL(`http://localhost${pathname}`) } }]])
	});

const titleOf = (head: string) => head.match(/<title>(.*?)<\/title>/)?.[1] ?? null;

const tip = '/harness/branch/main/shells';
const commit = `/harness/branch/feature%2Fshells/commit/${'a'.repeat(40)}/shells`;

test('Renders the shells page as the harness console while its history loads', () => {
	const { body, head } = renderAt(tip);
	const hasConsole = body.includes('data-harness-component="harness-harness-console"');
	const loading = body.includes('Loading history');
	recordExampleCases(where('renders-the-shells-page-as-the-harness-console-while-its-his'), [
		{
			name: 'the shells route is rendered at a branch tip with no route inputs',
			input: { url: tip },
			output: { hasConsole, loading, title: titleOf(head) }
		}
	]);
	// The server markup is the console with its loading state: the catalog mounts once history loads.
	expect(hasConsole).toBe(true);
	expect(loading).toBe(true);
});

test('Titles the harness screen Shells at a branch tip and at a selected commit', () => {
	const titles = [tip, commit].map((url) => ({ url, title: titleOf(renderAt(url).head) }));
	recordExampleCases(where('titles-the-harness-screen-shells-at-a-branch-tip-and-at-a-se'), [
		{
			name: 'the fixed title is the same at a branch tip and at a selected commit',
			input: { urls: [tip, commit] },
			output: titles
		}
	]);
	expect(titles).toEqual([
		{ url: tip, title: 'Shells · Harness' },
		{ url: commit, title: 'Shells · Harness' }
	]);
});
