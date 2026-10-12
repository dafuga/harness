import { render } from 'svelte/server';
import { afterEach, expect, test, vi } from 'vitest';
import HarnessShell from '../../src/components/harness/HarnessShell.svelte';

// The console is replaced by a probe that shows the address its host hands it.
vi.mock(
	'../../src/components/harness/HarnessConsole.svelte',
	() => import('./AddressProbe.svelte')
);

// The generic content is replaced by a mark, so the test sees which screen the host names.
vi.mock(
	'../../src/components/harness/ExplorerContent.svelte',
	() => import('./ScreenProbe.svelte')
);

afterEach(() => vi.unstubAllGlobals());

/** The address the console is given when the browser of an installed host is at a location. */
function given(pathname: string, search = ''): string {
	vi.stubGlobal('location', { pathname, search });
	const { body } = render(HarnessShell, { props: { base: '/harness' } });
	const shown = /<output data-mount="\/harness">(.*?)<\/output>/s.exec(body)?.[1];
	return (shown ?? 'nothing shown').replaceAll('&amp;', '&');
}

test('an installed console is given the address after its mount together with its query', () => {
	// The tab of a section is kept in the query: a reload or a link must not lose it.
	expect(given('/harness/branch/main/pages/page.titles/details', '?tab=source')).toBe(
		'/branch/main/pages/page.titles/details?tab=source'
	);
	expect(given('/harness/branch/feature%2Fkept%231/commit/' + 'a'.repeat(40) + '/functions')).toBe(
		'/branch/feature%2Fkept%231/commit/' + 'a'.repeat(40) + '/functions'
	);
});

test('an earlier query address reaches the console whole, so it can be led to its page', () => {
	expect(given('/harness', '?view=history&commit=abc&unit=service.title')).toBe(
		'?view=history&commit=abc&unit=service.title'
	);
	expect(given('/harness/branch/main/pages')).toBe('/branch/main/pages');
});

test('the standalone host names the generic content itself: the console has no screen of its own', () => {
	vi.stubGlobal('location', { pathname: '/harness/branch/main/pages', search: '' });
	const { body } = render(HarnessShell, { props: { base: '/harness' } });
	expect(body.match(/data-screen="([^"]+)"/g)).toEqual(['data-screen="generic"']);
});
