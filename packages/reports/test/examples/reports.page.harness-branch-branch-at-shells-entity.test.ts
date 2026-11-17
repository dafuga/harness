import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/shells/[entity]/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

// The page reads its address from the app's page state and gives its screen to the explorer's
// console, which reads the revisions in the browser. Neither exists in a unit test, so the page
// state is set here to the request's URL, the console is replaced by a probe that shows the address
// it is given, and the screen is replaced by a stand-in. The page and its title run as they are.
const app = vi.hoisted(() => ({ page: { url: new URL('http://localhost/harness') } }));
vi.mock('$app/state', () => app);
vi.mock('$app/navigation', () => ({ goto: () => Promise.resolve() }));
vi.mock(
	'../../src/components/explorer-ui/HarnessConsole.svelte',
	() => import('../components/AddressProbe.svelte')
);
vi.mock(
	'../../src/components/explorer-ui/EntityVisualScreen.svelte',
	() => import('../components/ScreenProbe.svelte')
);

const sha = '8b41d07c2e9f4a6b1d3e5f7a9b0c2d4e6f8a1b3c';
const tip = 'http://localhost/harness/branch/main/shells/app.layout.shell';
const commit = `http://localhost/harness/branch/main/commit/${sha}/shells/app.layout.shell?tab=source`;

/** The evidence of one state: its cases, under the unit and the page they show. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-branch-branch-at-shells-entity',
	symbol: '+page',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** Renders the page as the app would at this URL. */
function at(href: string) {
	app.page.url = new URL(href);
	return render(Page);
}

test('Titles every shell page with the Shell title', () => {
	const cases = [
		{ name: 'a shell at a branch tip', href: tip },
		{ name: 'a shell at a selected commit, on its Source tab', href: commit }
	].map(({ name, href }) => {
		const { head } = at(href);
		const title = /<title>(.*?)<\/title>/.exec(head)?.[1] ?? null;
		return { name, input: { url: href }, output: { title } };
	});
	recordExampleCases(where('titles-every-shell-page-with-the-shell-title'), cases);
	for (const { output } of cases) expect(output.title).toBe('Shell · Harness');
	expect(cases).toHaveLength(2);
});

test('Hands its console the shell address with its query', () => {
	const cases = [
		{ name: 'a shell at a branch tip', href: tip },
		{ name: 'a shell at a selected commit, on its Source tab', href: commit }
	].map(({ name, href }) => {
		const { body } = at(href);
		const shown = /<output data-mount="([^"]*)">([^<]*)<\/output>/.exec(body);
		return {
			name,
			input: { url: href },
			output: { base: shown?.[1] ?? null, path: shown?.[2]?.replaceAll('&amp;', '&') ?? null }
		};
	});
	recordExampleCases(where('hands-its-console-the-shell-address-with-its-query'), cases);
	expect(cases[0]!.output).toEqual({
		base: '/harness',
		path: '/branch/main/shells/app.layout.shell'
	});
	expect(cases[1]!.output).toEqual({
		base: '/harness',
		path: `/branch/main/commit/${sha}/shells/app.layout.shell?tab=source`
	});
});
