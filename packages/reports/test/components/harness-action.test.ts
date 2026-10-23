import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HarnessAction from '../../src/components/explorer-ui/HarnessAction.svelte';
import { harnessIcons } from '../../src/utils/harnessIcons';

const words = createRawSnippet(() => ({ render: () => '<span>Go to tip</span>' }));
const markup = (props: Record<string, unknown> = {}) =>
	render(HarnessAction, { props: { children: words, ...props } as never }).body;
const first = (body: string) => body.match(/<(a|button)\b[^>]*>/)?.[0] ?? '';

test('an action with an address is a real link that a new tab can open', () => {
	const body = markup({ href: '/harness/branch/main/pages', icon: 'arrow-right' });
	expect(first(body)).toMatch(/^<a\b/);
	expect(first(body)).toContain('href="/harness/branch/main/pages"');
	expect(first(body)).toMatch(/class="hx-action[^"]*\bgold\b/);
	expect(body).not.toContain('<button');
	// The words come first and the arrow follows them.
	expect(body.indexOf('Go to tip')).toBeLessThan(
		body.indexOf(`d="${harnessIcons['arrow-right']}"`)
	);
});

test('a disabled action is a disabled button and never a link, whatever address it was given', () => {
	const body = markup({ href: '/harness/branch/main/pages', disabled: true });
	expect(first(body)).toMatch(/^<button\b[^>]*\sdisabled\b/);
	expect(first(body)).toContain('type="button"');
	expect(body).not.toContain('<a ');
	expect(body).not.toContain('href=');
});

test('an action without an address is a button, plain when asked, with its icon before the words', () => {
	const body = markup({ tone: 'plain', lead: 'arrow-left', label: 'Back to the overview' });
	expect(first(body)).toMatch(/^<button\b/);
	expect(first(body)).toContain('type="button"');
	expect(first(body)).toMatch(/class="hx-action[^"]*\bplain\b/);
	expect(first(body)).not.toMatch(/\bgold\b/);
	expect(first(body)).toContain('aria-label="Back to the overview"');
	expect(first(body)).not.toMatch(/\sdisabled\b/);
	expect(body.indexOf(`d="${harnessIcons['arrow-left']}"`)).toBeLessThan(body.indexOf('Go to tip'));
	expect(markup().match(/<svg\b/g)).toBeNull();
});
