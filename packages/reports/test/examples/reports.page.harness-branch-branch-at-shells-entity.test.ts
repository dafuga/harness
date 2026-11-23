import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/shells/[entity]/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import { history, sha as hashOf, summary } from '../explorerFixture';
import { consoleAccess } from '../../src/utils/explorer-ui/console-server/consoleAccess';
import { consolePolicy } from '../../src/utils/explorer-ui/console-server/consolePolicy';
import { harnessClient } from '../../src/utils/explorer-ui/harnessClient';
import { HarnessDataLoadError } from '../../src/utils/explorer-ui/harnessClient.types';
import { harnessPage } from '../../src/utils/explorer-ui/harness-page/harnessPage';

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

/** The name and message of a failure, as a plain value; null when what was thrown is not an error. */
const failure = (caught: unknown) =>
	caught instanceof Error ? { name: caught.name, message: caught.message } : null;

/** A fetch that answers every request with the status it is given and no body. */
const answering = (status: number) =>
	(async () => new Response('', { status })) as unknown as typeof fetch;

test('Refuses with 403 Forbidden when the owner policy denies', async () => {
	const owner = { mode: 'loopback', bind: '127.0.0.1' };
	const access = consoleAccess({
		policy: consolePolicy(owner),
		data: { json: async () => undefined, media: async () => undefined }
	});
	const cases = await Promise.all(
		[
			{ name: 'a request from a loopback client', address: '127.0.0.1' },
			{ name: 'a request from a remote client', address: '203.0.113.9' }
		].map(async ({ name, address }) => {
			const denied = await access.guard({
				url: new URL(tip),
				request: new Request(tip),
				getClientAddress: () => address
			});
			const input = { client: address, bind: owner.bind, url: tip };
			return denied
				? { name, input, error: { status: denied.status, body: await denied.text() } }
				: { name, input, output: { admitted: true } };
		})
	);
	recordExampleCases(where('refuses-with-403-forbidden-when-the-owner-policy-denies'), cases);
	expect(cases[0]!.output).toEqual({ admitted: true });
	expect(cases[1]!.error).toEqual({ status: 403, body: 'Forbidden' });
});

test('Throws HarnessDataLoadError when the index request fails', async () => {
	const failures = await Promise.all(
		[500, 404].map(async (status) => {
			const client = harnessClient('/harness', answering(status));
			const caught: unknown = await client.index().catch((error: unknown) => error);
			return { status, caught };
		})
	);
	const cases = failures.map(({ status, caught }) => ({
		name: `the index answers ${status}`,
		input: { path: 'index.json', status },
		error: failure(caught)
	}));
	recordExampleCases(where('throws-harnessdataloaderror-when-the-index-request-fails'), cases);
	for (const { caught } of failures) expect(caught).toBeInstanceOf(HarnessDataLoadError);
	expect(cases[0]!.error).toEqual({
		name: 'HarnessDataLoadError',
		message: 'index.json could not be loaded (500)'
	});
});

test('Throws HarnessDataLoadError when a revision request fails', async () => {
	const commit = hashOf('d');
	const client = harnessClient('/harness', answering(500));
	const caught: unknown = await client.revision(commit).catch((error: unknown) => error);
	const cases = [
		{
			name: 'the detail of a revision answers 500',
			input: { path: `revisions/${commit}.json`, status: 500 },
			error: failure(caught)
		}
	];
	recordExampleCases(where('throws-harnessdataloaderror-when-a-revision-request-fails'), cases);
	expect(caught).toBeInstanceOf(HarnessDataLoadError);
	expect(cases[0]!.error).toEqual({
		name: 'HarnessDataLoadError',
		message: `revisions/${commit}.json could not be loaded (500)`
	});
});

test('Reports not-in-history when a commit is not held', () => {
	const tipHeld = summary(hashOf('c'), { branches: ['main'] });
	const cases = [
		{
			name: 'a commit that the history does not hold',
			path: `/branch/main/commit/${hashOf('e')}/layouts/app.layout.shell`,
			index: history({ branches: [{ name: 'main', head: hashOf('c') }], revisions: [tipHeld] })
		},
		{
			name: 'a branch whose recorded tip it does not hold',
			path: '/branch/main/layouts/app.layout.shell',
			index: history({ branches: [{ name: 'main', head: hashOf('z') }], revisions: [tipHeld] })
		}
	].map(({ name, path, index }) => {
		const page = harnessPage(index, path);
		return {
			name,
			input: { path },
			output: { kind: page.kind, message: page.kind === 'missing' ? page.message : null }
		};
	});
	recordExampleCases(where('reports-not-in-history-when-a-commit-is-not-held'), cases);
	expect(cases.map((item) => item.output.kind)).toEqual(['missing', 'missing']);
	expect(cases[1]!.output.message).toBe('The tip of branch main (zzzzzzz) is not in this history.');
});
