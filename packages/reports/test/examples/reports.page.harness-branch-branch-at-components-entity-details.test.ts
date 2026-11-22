import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/components/[entity]/details/+page.svelte';
import { correctedLocation } from '../../src/utils/development-tooling/correctedLocation';
import { explorerRoute } from '../../../../src/utils/explorer-ui/explorerRoute';
import { harnessPage } from '../../src/utils/explorer-ui/harness-page/harnessPage';
import {
	HarnessDataLoadError
} from '../../src/utils/explorer-ui/harnessClient.types';
import { harnessClient } from '../../src/utils/explorer-ui/harnessClient';
import { history, sha, summary } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

// The address the page is at is held here, so each test names it as the browser would.
const location = vi.hoisted(() => ({ url: new URL('http://localhost/harness') }));

// The router state the explorer frame reads; a test sets the address before it renders.
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return location.url;
		}
	}
}));
vi.mock('$app/navigation', () => ({ goto: () => Promise.resolve() }));

const commit = 'a'.repeat(40);
const entity = 'reports.component.harness-entity-details';

/** The evidence of one state: its cases, under the page and the function it renders. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-branch-branch-at-components-entity-details',
	symbol: '+page',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** Renders the page at an address and returns its document title and the words it draws. */
function shownAt(href: string): { title: string; words: string; head: string } {
	location.url = new URL(href);
	const { head, body } = render(Page);
	const title = /<title>(.*?)<\/title>/s.exec(head)?.[1] ?? '';
	const words = body
		.replace(/<!--.*?-->/gs, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return { title, words, head };
}

test('Renders the component details page with the document title Component details · Harness', () => {
	const contract = `/harness/branch/main/components/${entity}/details`;
	const shown = shownAt(`http://localhost${contract}`);
	recordExampleCases(where('renders-the-component-details-page-with-the-document-title-c'), [
		{
			name: 'the details page of a component opened with no tab',
			input: { url: contract },
			output: { title: shown.title, words: shown.words }
		}
	]);
	expect(shown.title).toBe('Component details · Harness');
	expect(shown.head).toContain('<title>Component details · Harness</title>');
});

test('Renders the measurements and source tab addresses of a component without another revision content', () => {
	const at = `/harness/branch/main/commit/${commit}/components/${entity}/details`;
	const measured = shownAt(`http://localhost${at}?tab=measurements`);
	const source = shownAt(`http://localhost${at}?tab=source`);
	recordExampleCases(where('renders-the-measurements-and-source-tab-addresses-of-a-compo'), [
		{
			name: 'a commit address with the measurements tab, before the revision is read',
			input: { url: `${at}?tab=measurements` },
			output: { title: measured.title, words: measured.words }
		},
		{
			name: 'a commit address with the source tab, before the revision is read',
			input: { url: `${at}?tab=source` },
			output: { title: source.title, words: source.words }
		}
	]);
	expect(measured.title).toBe('Component details · Harness');
	expect(source.title).toBe('Component details · Harness');
	expect(measured.words).not.toContain('Measurements and frozen limits');
	expect(source.words).not.toContain('src/routes/');
});

test('Reports not-in-history when the history lacks the address', () => {
	// The page reads its address through harnessPage; a missing branch or commit is the notice.
	const index = history({
		branches: [
			{ name: 'main', head: sha('c') },
			{ name: 'feature/kept', head: sha('d') }
		],
		revisions: [
			summary(sha('c'), { branches: ['main'] }),
			summary(sha('d'), { branches: ['feature/kept'] })
		]
	});
	const paths = [
		`/branch/release/components/${entity}`,
		`/branch/main/commit/${sha('e')}/components/${entity}`,
		`/branch/feature%2Fkept/commit/${sha('c')}/components/${entity}`
	];
	const notices = paths.map((path) => {
		const page = harnessPage(index, path);
		return page.kind === 'missing' ? page.message : page.kind;
	});
	recordExampleCases(where('reports-not-in-history-when-the-history-lacks-the-address'), [
		{
			name: 'a branch the history does not hold',
			input: { path: paths[0] },
			output: { notice: notices[0] }
		},
		{
			name: 'a commit the history does not hold',
			input: { path: paths[1] },
			output: { notice: notices[1] }
		},
		{
			name: 'a branch that does not contain the commit',
			input: { path: paths[2] },
			output: { notice: notices[2] }
		}
	]);
	expect(notices[0]).toBe('Branch release is not in this history.');
	expect(notices[1]).toBe(`Commit ${sha('e').slice(0, 7)} is not in this history.`);
	expect(notices[2]).toBe(
		`Branch feature/kept does not contain commit ${sha('c').slice(0, 7)}.`
	);
});

test('Redirects other-category to the category that lists it', () => {
	// An address whose component is listed under another category is replaced by that category.
	const address = explorerRoute(`/branch/main/functions/${entity}/details`, '?tab=source');
	const listed = [{ id: entity, category: 'components' as const }];
	const moved = address && correctedLocation(address, listed);
	const kept = address && correctedLocation(address, [{ id: entity, category: 'functions' }]);
	recordExampleCases(where('redirects-other-category-to-the-category-that-lists-it'), [
		{
			name: 'a functions address whose component is listed under components',
			input: { entity, listedUnder: 'components', tab: 'source' },
			output: { category: moved?.category ?? null, entity: moved?.entity ?? null, tab: moved?.tab ?? null }
		},
		{
			name: 'the same address when the listed category is already right',
			input: { entity, listedUnder: 'functions', tab: 'source' },
			output: { redirect: kept ?? null }
		}
	]);
	expect(moved).toMatchObject({ category: 'components', entity, tab: 'source' });
	expect(kept).toBeNull();
});

test('Throws HarnessDataLoadError when a data request is not ok', async () => {
	// A stub answers each request with the status; no network is reached.
	const answer = (status: number) =>
		(async () => new Response(null, { status })) as unknown as typeof fetch;
	const index = await harnessClient('/harness', answer(404))
		.index()
		.catch((error: unknown) => error);
	const revision = await harnessClient('/harness', answer(403))
		.revision(sha('c'))
		.catch((error: unknown) => error);
	const described = (error: unknown) =>
		error instanceof Error ? { name: error.name, message: error.message } : { name: 'none' };
	recordExampleCases(where('throws-harnessdataloaderror-when-a-data-request-is-not-ok'), [
		{
			name: 'the index answered 404',
			input: { path: 'index.json', status: 404 },
			error: described(index)
		},
		{
			name: 'a revision answered 403',
			input: { path: `revisions/${sha('c')}.json`, status: 403 },
			error: described(revision)
		}
	]);
	expect(index).toBeInstanceOf(HarnessDataLoadError);
	expect(revision).toBeInstanceOf(HarnessDataLoadError);
	expect(described(index).message).toBe('index.json could not be loaded (404)');
	expect(described(revision).message).toBe(`revisions/${sha('c')}.json could not be loaded (403)`);
});
