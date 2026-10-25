import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HarnessHeader from '../../src/components/explorer-ui/HarnessHeader.svelte';
import HarnessSelectors from '../../src/components/explorer-ui/harness-selectors/HarnessSelectors.svelte';
import HarnessTabs from '../../src/components/explorer-ui/HarnessTabs.svelte';
import {
	sha,
	shellBranch,
	shellCommits,
	shellHref,
	shellIndex,
	shellMount,
	shellScope
} from '../../tests/e2e/support/shellData';

/**
 * The three components the console already calls keep the calls it makes, and each takes one
 * more thing: the header a navbar, the selectors a tip, the tabs a list of their own.
 */
const clean = (html: string) => html.replace(/<!--.*?-->/g, '');
const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
const missing = { message: 'No commit a1b2c3d is in this history.', home: '/branch/main/pages' };
const header = (changes: object = {}) =>
	clean(
		render(HarnessHeader, {
			props: { base: shellMount, problem: 'The history could not be loaded.', missing, ...changes }
		} as never).body
	);
const selectors = (changes: object = {}) =>
	clean(
		render(HarnessSelectors, {
			props: {
				index: shellIndex,
				branch: shellBranch,
				commit: sha(4),
				commits: shellCommits(shellBranch),
				bases: null,
				from: '',
				onbranch: () => {},
				oncommit: () => {},
				onbase: () => {},
				...changes
			}
		} as never).body
	);
const tabs = (changes: object = {}) =>
	clean(
		render(HarnessTabs, { props: { view: 'map', onview: () => {}, ...changes } } as never).body
	);
const notices = (html: string) =>
	[...html.matchAll(/<p class="hc-notice[^"]*" role="alert">(.*?)<\/p>/gs)].map(
		([, inner]) => inner
	);

test('the header without a navbar is the title row the console had', () => {
	const html = header({ links: [{ label: 'Reports', href: '/harness/reports' }] });
	expect(html).toMatch(/<header class="hc-top"[^>]*>.*<h1>Harness<\/h1>/s);
	expect(html).toContain('<nav aria-label="Other views"><a href="/harness/reports">Reports</a>');
	expect(notices(html).map(text)).toEqual([
		'The history could not be loaded.',
		`${missing.message} Open the newest commit`
	]);
});

test('the header with a navbar is the unified bar, and the notices it always showed follow it', () => {
	const scope = shellScope({ branch: shellBranch, commit: sha(4), category: 'configs' });
	const navbar = {
		repository: 'synthetic-repository',
		scope,
		index: shellIndex,
		commits: shellCommits(shellBranch),
		href: shellHref,
		onroute: () => {}
	};
	const html = header({ navbar });
	expect(html).toMatch(/^\s*<div class="hx-header[^"]*"[^>]*>\s*<header class="hx-nav"/);
	expect(
		text(/<nav\b[^>]*aria-label="Harness categories"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? '')
	).toBe('Pages APIs Code Modules Translations Platforms');
	// The title row and its links to other views are gone, with or without links to draw.
	expect(html).not.toMatch(/hc-top|<h1\b|Other views|brand-symbol/);
	expect(header({ navbar, links: [{ label: 'Reports', href: '/harness/reports' }] })).not.toMatch(
		/Reports|Other views/
	);
	expect(html.indexOf('</header>')).toBeLessThan(html.search(/<p\b[^>]*role="alert"/));
	expect(notices(html).map(text)).toEqual([
		'The history could not be loaded.',
		`${missing.message} Open the newest commit`
	]);
	expect(html).toContain(`href="${shellMount}/branch/main/pages">Open the newest commit</a>`);
});

test('the selectors without a tip are the fields the console had', () => {
	const html = selectors({ bases: shellCommits('main'), from: sha(2) });
	expect(html).toMatch(/^\s*<div class="hc-controls"[^>]*>/);
	expect(
		html.match(/<select\b[^>]*aria-label="([^"]*)"/g)?.map((tag) => /"(.*)"/.exec(tag)?.[1])
	).toEqual(['Branch', 'Commit', 'Base commit']);
	expect(html).not.toMatch(/Go to tip|Tip ·|hx-shown|<small\b|<svg\b[^>]*viewBox="0 0 24 24"/);
});

test('the selectors of the bar say where the tip is, what is viewed, and lead back to the tip', () => {
	const tip = {
		note: 'Tip · 0505050',
		viewed: 'Historical commit',
		href: '/harness/tip',
		onfollow: () => {}
	};
	const html = selectors({ tip });
	expect(html).toMatch(/^\s*<div class="hx-revision"[^>]*>/);
	expect(html).not.toContain('hc-controls');
	const labels = [...html.matchAll(/<label>(.*?)<\/label>/gs)].map(([, inner]) => inner);
	expect(labels.map(text)).toEqual([
		expect.stringMatching(/^Branch .* Tip · 0505050$/),
		expect.stringMatching(/^Commit .* 0404040 Historical commit$/)
	]);
	// Each field name has its outline icon before it, and each field is still the shared select.
	for (const label of labels)
		expect(label).toMatch(/^\s*<span\b[^>]*>\s*<svg\b[^>]*viewBox="0 0 24 24"/);
	expect(html.match(/class="report-select(?:\s|")/g)).toHaveLength(2);
	expect(html).toMatch(/<span[^>]*class="report-select-value[^>]*>0404040<\/span>/);
	expect(html).toMatch(/<a\b[^>]*href="\/harness\/tip"[^>]*>(?:(?!<\/a>).)*Go to tip/s);
	// With nowhere to go the same control is a disabled button.
	const there = selectors({ tip: { ...tip, viewed: 'Current · branch tip', href: null } });
	expect(there).toMatch(/<button\b[^>]*\sdisabled\b[^>]*>(?:(?!<\/button>).)*Go to tip/s);
	expect(there).not.toContain('href="/harness/tip"');
});

test('the tabs without a list are the five views the console had', () => {
	const html = tabs({ view: 'compare' });
	expect(html).toMatch(/^\s*<div class="hc-tabs" role="tablist" aria-label="Views"[^>]*>/);
	expect(
		[...html.matchAll(/<button type="button" role="tab" aria-selected="(\w+)">([^<]*)</g)].map(
			([, selected, label]) => [label, selected]
		)
	).toEqual([
		['Component map', 'false'],
		['Compare', 'true'],
		['History', 'false'],
		['Growth', 'false'],
		['Activity', 'false']
	]);
});

test('the tabs of an entity are the list they are given: links where a tab has an address', () => {
	const list = [
		{ id: 'contract', label: 'Contract', href: '/harness/branch/main/pages/page.titles/details' },
		{ id: 'measurements', label: 'Measurements' },
		{ id: 'source', label: 'Source', disabled: true, href: '/harness/never' }
	];
	const html = tabs({ view: 'measurements', tabs: list, label: 'Details of Page explorer' });
	expect(html).toMatch(
		/^\s*<div class="hx-tabs" role="tablist" aria-label="Details of Page explorer"[^>]*>/
	);
	expect(text(html)).toBe('Contract Measurements Source');
	expect(html).not.toMatch(/Component map|Compare|Growth|Activity|hc-tabs/);
	expect(html).toMatch(
		/<a\b[^>]*role="tab"[^>]*href="\/harness\/branch\/main\/pages\/page.titles\/details"[^>]*aria-selected="false"[^>]*>Contract<\/a>/
	);
	expect(html).toMatch(
		/<button\b[^>]*role="tab"[^>]*aria-selected="true"[^>]*>Measurements<\/button>/
	);
	// A tab that cannot be opened is a disabled button, never a link.
	expect(html).toMatch(/<button\b[^>]*role="tab"[^>]*\sdisabled\b[^>]*>Source<\/button>/);
	expect(html).not.toContain('/harness/never');
});
