import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ExplorerFrame from '../../src/components/explorer-ui/ExplorerFrame.svelte';
import { revision } from '../entityFixture';
import { hostProps, words } from '../entityRender';
import { commits } from '../entityUnits';

const children = createRawSnippet(() => ({ render: () => '<p>the screen</p>' }));

test('a screen is drawn inside the content of its revision mode', () => {
	const body = render(ExplorerFrame, { props: { host: hostProps('commit'), children } }).body;
	expect(body).toMatch(/<div class="ex-content" data-mode="commit">/);
	expect(words(body)).toContain('the screen');
	expect(render(ExplorerFrame, { props: { host: hostProps('current'), children } }).body).toContain(
		'data-mode="current"'
	);
});

test('a revision without a registry shows its gap, and nothing of the screen in its place', () => {
	const bare = revision(commits.middle, []);
	bare.registry = { ...bare.registry, available: false };
	const host = hostProps('commit', { category: 'functions' }, { head: bare });
	const body = render(ExplorerFrame, { props: { host, children } }).body;
	expect(words(body)).toContain('No registry at this revision');
	expect(words(body)).toContain('No unit registry is stored at bbbbbbb.');
	expect(words(body)).not.toContain('the screen');
	expect(body).toContain(
		`href="/harness/branch/feature%2Forders/commit/${commits.middle}/functions"`
	);
});
