import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HarnessNavbar from '../../src/components/harness/HarnessNavbar.svelte';
import type { ExplorerLocation } from '../../src/models/Explorer.types';
import {
	sha,
	shellBranch,
	shellCommits,
	shellHref,
	shellIndex,
	shellMount,
	shellScope
} from '../../tests/e2e/support/shellData';

const body = (location: ExplorerLocation | null, changes: object = {}) =>
	render(HarnessNavbar, {
		props: {
			base: shellMount,
			repository: 'synthetic-repository',
			scope: location ? shellScope(location) : null,
			index: shellIndex,
			commits: shellCommits(location?.branch ?? null),
			href: shellHref,
			onroute: () => {},
			...changes
		}
	}).body.replace(/<!--.*?-->/g, '');
const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
const categories = (html: string) =>
	/<nav\b[^>]*aria-label="Harness categories"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? '';
/** The links of the category row: where each leads, whether it is the current one, and its parts. */
const links = (html: string) =>
	[...categories(html).matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)].map(([, attributes, inner]) => ({
		label: text(inner),
		href: /href="([^"]*)"/.exec(attributes)?.[1],
		current: /aria-current="page"/.test(attributes),
		iconThenLabel: /^\s*<svg\b[^>]*aria-hidden="true".*<\/svg>\s*<span\b/s.test(inner)
	}));
const field = (html: string, name: string) =>
	new RegExp(`<select\\b[^>]*aria-label="${name}"[^>]*>(.*?)</select>`, 's').exec(html)?.[1];
const chosen = (html: string, name: string) =>
	/<option value="([^"]*)" selected[^>]*>([^<]*)</.exec(field(html, name) ?? '')?.slice(1);
const scoped = `${shellMount}/branch/feature%2Fshell%231`;
const current: ExplorerLocation = { branch: shellBranch, commit: null, category: 'pages' };
const historical: ExplorerLocation = {
	branch: shellBranch,
	commit: sha(4),
	category: 'functions',
	entity: 'function.slugify',
	section: 'details',
	tab: 'source'
};

test('one bar holds the brand, the repository and five categories with an icon above each label', () => {
	const html = body(historical);
	expect(html).toMatch(/^\s*<header class="hx-nav"/);
	expect(html.match(/<header\b/g)).toHaveLength(1);
	expect(links(html)).toEqual(
		['Pages', 'Components', 'Functions', 'Configs', 'Services'].map((label) => ({
			label,
			href: `${scoped}/commit/${sha(4)}/${label.toLowerCase()}`,
			current: label === 'Functions',
			iconThenLabel: true
		}))
	);
	const brand = /<a\b[^>]*class="hx-brand"[^>]*>(.*?)<\/a>/s.exec(html);
	expect(brand?.[0]).toContain(`href="${scoped}/pages"`);
	expect(text(brand?.[1] ?? '')).toBe('Harness');
	expect(html).toMatch(/<span class="hx-repository">synthetic-repository<\/span>/);
	// Brand, repository, categories and revision controls, in that order.
	const order = ['hx-brand', 'hx-repository', 'hx-categories', 'hx-revision'].map((name) =>
		html.indexOf(`class="${name}"`)
	);
	expect(order.every((at) => at >= 0)).toBe(true);
	expect([...order].sort((a, b) => a - b)).toEqual(order);
});

test('the bar has no reports, analytics, activity, growth or legacy view in it', () => {
	for (const location of [current, historical]) {
		const words = text(body(location));
		expect(words).not.toMatch(/Reports?|Analytics|Activity|Growth|Dashboard|Component map|Compare/);
		expect(body(location)).not.toMatch(/role="tab"|Other views|Base commit/);
	}
});

test('at the tip of a branch the commit is the tip, said as current, and Go to tip is disabled', () => {
	const html = body(current);
	expect(chosen(html, 'Branch')).toEqual([shellBranch, shellBranch]);
	expect(chosen(html, 'Commit')?.[0]).toBe(sha(5));
	expect(text(html)).toContain('Tip · 0505050');
	expect(text(html)).toContain('Current · branch tip');
	expect(html).toMatch(/<button\b[^>]*\sdisabled\b[^>]*>(?:(?!<\/button>).)*Go to tip/s);
	expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>).)*Go to tip/s);
	expect(
		links(html)
			.filter((item) => item.current)
			.map((item) => item.label)
	).toEqual(['Pages']);
	expect(links(html)[2].href).toBe(`${scoped}/functions`);
});

test('at a selected commit the tip and the viewed hash differ, and Go to tip is the current route', () => {
	const html = body(historical);
	expect(chosen(html, 'Commit')).toEqual([sha(4), '0404040 Sketch the explorer shell · failed']);
	// The closed field shows the short hash; the full line of each commit is in its options.
	expect(html).toMatch(/<span class="hx-shown" aria-hidden="true">0404040<\/span>/);
	expect(field(html, 'Commit')).toContain('0505050 Add the unified navbar · no evidence');
	expect(text(html)).toContain('Tip · 0505050');
	expect(text(html)).toContain('Historical commit');
	expect(text(html)).not.toContain('Current · branch tip');
	const tip = /<a\b([^>]*)>(?:(?!<\/a>).)*Go to tip/s.exec(html)?.[1];
	expect(tip).toContain(`href="${scoped}/functions/function.slugify/details?tab=source"`);
	expect(html).not.toMatch(/<button\b[^>]*\sdisabled/);
});

test('both selectors are the shared select, and the bar writes no field of its own', () => {
	const html = body(historical);
	expect(html.match(/class="report-select\b/g)).toHaveLength(2);
	expect(html.match(/<select\b/g)).toHaveLength(2);
	expect(field(html, 'Branch')).toContain('<option value="main">main</option>');
});

test('without a resolved address the bar keeps the five categories and offers nothing to choose', () => {
	const html = body(null, { repository: null, index: null });
	expect(text(categories(html))).toBe('Pages Components Functions Configs Services');
	expect(links(html)).toEqual([]);
	expect(categories(html).match(/aria-disabled="true"/g)).toHaveLength(5);
	expect(html).not.toMatch(/<select\b|Go to tip|hx-repository/);
	expect(html).toMatch(new RegExp(`<a\\b[^>]*class="hx-brand"[^>]*href="${shellMount}"`));
});

test('an index that left older commits out says so under the bar', () => {
	const html = body(current, { index: { ...shellIndex, truncated: true } });
	expect(text(html)).toContain('Older commits were left out of this index');
	expect(text(body(current))).not.toContain('Older commits were left out');
});
