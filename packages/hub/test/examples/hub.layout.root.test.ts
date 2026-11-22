import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import RootLayout from '../../src/routes/+layout.svelte';
import { ssr } from '../../src/routes/+layout';

test('Disables server rendering', () => {
	expect(ssr).toBe(false);
	recordExampleCases(
		{ unitId: 'hub.layout.root', symbol: 'ssr', state: 'disables-server-rendering', evidence: 'examples-cases', file: 'disables-server-rendering.json' },
		[{ name: 'Hosted pages render in the browser', input: {}, output: false }],
	);
});

test('Renders the page snippet once without a wrapper', () => {
	const children = createRawSnippet(() => ({ render: () => '<p>PAGE_CONTENT</p>' }));
	const html = render(RootLayout, { props: { children } }).body;
	expect(html).toContain('<p>PAGE_CONTENT</p>');
	expect(html).not.toContain('<div');
	expect(html.match(/PAGE_CONTENT/g)).toHaveLength(1);
	recordExampleCases(
		{ unitId: 'hub.layout.root', symbol: '+layout', state: 'renders-the-page-snippet-once-without-a-wrapper', evidence: 'examples-cases', file: 'renders-the-page-snippet-once-without-a-wrapper.json' },
		[{ name: 'Renders supplied page markup once', input: { page: '<p>PAGE_CONTENT</p>' }, output: { html: '<p>PAGE_CONTENT</p>', occurrences: 1, wrapper: false } }],
	);
});
