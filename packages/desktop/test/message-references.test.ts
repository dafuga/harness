import { render } from 'svelte/server';
import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import MessageList from '../src/components/MessageList.svelte';
import { createWorkspaceStore } from '../src/lib/stores/workspace.svelte';
import type { CatalogEntity, ProjectSnapshot } from '../src/models/Desktop.types';
import type { ThreadEntry } from '../src/utils/commentEntries';
import { explorerName } from '../../reports/src/utils/explorerName';

/**
 * Agent text names units as [[unit:<id>]]. A reference to an entity of the shown project at the
 * shown revision is a link to its address there; anything else stays exactly the text it was.
 */
const [tip, earlier] = ['a'.repeat(40), 'c'.repeat(40)];
const entity = (id: string, category: CatalogEntity['category'], kind: string, title: string) =>
	({
		...{ id, category, kind, title, summary: `${title}.`, changed: false, planned: false },
		...{ hasPlan: false, lifecycle: null, verification: 'unverified', verificationNote: '' },
		...{ latestVersion: null, approvedVersion: null, threadCount: 0, thumbnail: null }
	}) as CatalogEntity;
const entities = [
	entity('app.function.format-time', 'functions', 'function', 'Format time'),
	entity('app.shell.order-frame', 'shells', 'shell', 'Order frame')
];
function workspace(commit: string) {
	const shown = createWorkspaceStore();
	shown.snapshot = {
		project: { name: 'Alpha', root: '/alpha', id: 'local-alpha' },
		revision: { branch: 'feat/alpha', commit, tip, atTip: commit === tip },
		...{ branches: [], commits: [], entities, writable: commit === tip }
	} as ProjectSnapshot;
	shown.pinned = commit !== tip;
	return shown;
}
const said = (text: string): ThreadEntry => ({
	...{ id: 'agent-1', at: '2026-10-14T09:00:00.000Z', author: 'agent', text, mode: 'plan' },
	...{ provider: 'codex', model: 'selected', version: null, imageSha256: null }
});
const drawn = (text: string, commit = tip) =>
	render(MessageList, { props: { messages: [said(text)], workspace: workspace(commit) } }).body;
const plain = (html: string) =>
	html
		.replace(/<!--.*?-->/gs, '')
		.replace(/<[^>]+>/g, '')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&');
/** The text of the message itself, as a reader sees it. */
const content = (html: string) => plain(/<p\b[^>]*>(.*?)<\/p>/s.exec(html)?.[1] ?? '');
const links = (html: string) =>
	[...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs)].map(([, href, inner]) => [
		href,
		plain(inner).trim()
	]);
const branch = '/projects/local-alpha/harness/branch/feat%2Falpha';

test('a unit the agent names is a link to its address, a shell under Shells', () => {
	const body = drawn(
		'I change [[unit:app.function.format-time]] in [[unit:app.shell.order-frame]].'
	);
	expect(links(body)).toEqual([
		[`${branch}/functions/app.function.format-time`, explorerName(entities[0])],
		[`${branch}/shells/app.shell.order-frame`, explorerName(entities[1])]
	]);
	expect(content(body)).toBe(
		`I change ${explorerName(entities[0])} in ${explorerName(entities[1])}.`
	);
});

test('at a pinned commit the link keeps the commit it was read at', () => {
	expect(links(drawn('Is [[unit:app.function.format-time]] right?', earlier))).toEqual([
		[`${branch}/commit/${earlier}/functions/app.function.format-time`, explorerName(entities[0])]
	]);
});

test.each([
	['an id the registry does not hold', 'Check [[unit:app.function.missing]] first.'],
	['a unit of another project', 'Compare [[unit:beta.function.only]].'],
	['an address', 'Open [[unit:https://evil.example/x]] now.'],
	['a script', 'Run [[unit:javascript:alert(1)]].'],
	['a path', 'Read [[unit:../../etc/passwd]].'],
	['an id in capitals', 'See [[unit:App.Function.Format-Time]].'],
	['a reference that is not closed', 'Then [[unit:app.function.format-time']
])('%s stays the text it was and is no link', (_name, text) => {
	const body = drawn(text);
	expect(links(body)).toEqual([]);
	expect(content(body)).toBe(text);
});

test('markup in agent text is shown as text and never interpreted', () => {
	const text =
		'<img src=x onerror=alert(1)><a href="https://evil.example">[[unit:app.shell.order-frame]]</a>';
	const body = drawn(text);
	expect(body).not.toMatch(/<img\b|<a\b[^>]*href="https:\/\/evil/);
	expect(links(body)).toEqual([
		[`${branch}/shells/app.shell.order-frame`, explorerName(entities[1])]
	]);
});

test('a message written before references renders exactly its words', () => {
	const body = drawn('Keep the filters on one line.');
	expect(links(body)).toEqual([]);
	expect(content(body)).toBe('Keep the filters on one line.');
});
