import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import Layout from '../../src/routes/+layout.svelte';

const pageState = vi.hoisted(() => ({ url: { pathname: '', search: '' } }));

vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const content = 'layout-child-content';
const children = createRawSnippet(() => ({ render: () => `<main>${content}</main>` }));

function renderAt(pathname: string) {
	pageState.url.pathname = pathname;
	pageState.url.search = '';
	return render(Layout, { props: { children } }).body;
}

test('Renders children without ConsoleChat on the harness root', () => {
	const html = renderAt('/harness');
	expect(html.match(/layout-child-content/g)).toHaveLength(1);
	expect(html).not.toContain('console-chat');
	recordExampleCases(
		{
			unitId: 'reports.layout.root',
			symbol: '+layout',
			state: 'renders-children-without-consolechat-on-the-harness-root',
			evidence: 'examples-cases',
			file: 'renders-children-without-consolechat-on-the-harness-root.json'
		},
		[
			{
				name: 'harness root',
				input: { pathname: '/harness' },
				output: { contentOccurrences: 1, consoleChat: false }
			}
		]
	);
});

test('Renders ConsoleChat after children on a branch page', () => {
	const html = renderAt('/harness/branch/main/pages');
	expect(html.match(/layout-child-content/g)).toHaveLength(1);
	expect(html.indexOf('layout-child-content')).toBeLessThan(html.indexOf('console-chat'));
	recordExampleCases(
		{
			unitId: 'reports.layout.root',
			symbol: '+layout',
			state: 'renders-consolechat-after-children-on-a-branch-page',
			evidence: 'examples-cases',
			file: 'renders-consolechat-after-children-on-a-branch-page.json'
		},
		[
			{
				name: 'branch pages',
				input: { pathname: '/harness/branch/main/pages' },
				output: { contentOccurrences: 1, consoleChatAfterContent: true }
			}
		]
	);
});

test('Renders ConsoleChat after children on a commit page', () => {
	const html = renderAt('/harness/commit/3f9c2a1b/pages');
	expect(html.match(/layout-child-content/g)).toHaveLength(1);
	expect(html.indexOf('layout-child-content')).toBeLessThan(html.indexOf('console-chat'));
	recordExampleCases(
		{
			unitId: 'reports.layout.root',
			symbol: '+layout',
			state: 'renders-consolechat-after-children-on-a-commit-page',
			evidence: 'examples-cases',
			file: 'renders-consolechat-after-children-on-a-commit-page.json'
		},
		[
			{
				name: 'commit pages',
				input: { pathname: '/harness/commit/3f9c2a1b/pages' },
				output: { contentOccurrences: 1, consoleChatAfterContent: true }
			}
		]
	);
});
