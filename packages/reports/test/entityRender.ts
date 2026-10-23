import type { Given } from './entityRender.types';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import type { ExplorerScreenProps } from '../src/models/ExplorerScreen.types';
import type { HarnessIndex } from '../src/models/Harness.types';
import ExplorerContent from '../src/components/explorer-ui/ExplorerContent.svelte';
import EntityTests from '../src/components/explorer-ui/entity-tests/EntityTests.svelte';
import { explorerRoutePath } from '../../../src/utils/explorerRoute';
import { explorerEntities } from '../src/utils/explorerEntities';
import { index } from './entityFixture';
import { lens, place, view, type View } from './entityPlaces';

/** What a host gives the content of a screen for one view at one address. */
export function hostProps(
	mode: 'current' | 'commit',
	route: Partial<ExplorerLocation> = {},
	changed: Partial<View> = {},
	history: HarnessIndex = index
): ExplorerScreenProps {
	const shown = view(mode, changed);
	const address = place({ commit: mode === 'current' ? null : shown.scope.commit, ...route });
	return {
		index: history,
		head: shown.head,
		parent: shown.parent,
		scope: { ...shown.scope, location: address },
		route: address,
		entities: shown.head.registry.available ? explorerEntities(shown.head) : [],
		lens: lens(shown, history),
		client: { revision: () => Promise.reject(new Error('not read in a test')) },
		mediaBase: '/harness/media/',
		onroute: () => {},
		exportHref: ''
	};
}

/** One screen as a route page mounts it, rendered to markup. */
export const screen = (entry: Component<ExplorerScreenProps>, ...given: Given): string =>
	render(entry, { props: hostProps(...given) }).body;

/** Markup as it is drawn, without the marks a renderer leaves for itself between elements. */
export function drawn(body: string): string {
	let shown = body.replace(/<!--.*?-->/gs, '');
	// Strip only the known attribution-only container; any semantic attribute keeps it visible.
	const wrapper = /<div class="ex-shown(?: svelte-[\w-]+)?" data-harness-component="[^"]+">/;
	while (wrapper.test(shown))
		shown = replaced(shown, wrapper, 'div', (whole) =>
			whole.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '')
		);
	return shown;
}

/** The content that shows any address, as a host without route pages mounts it. */
export const content = (...given: Given): string => screen(ExplorerContent, ...given);

/** Where the element that opens at `from` ends: after the close that pairs with its tag. */
function closed(markup: string, from: number, tag: string): number {
	const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
	tags.lastIndex = from;
	let depth = 0;
	for (let found = tags.exec(markup); found; found = tags.exec(markup)) {
		depth += found[1] ? -1 : 1;
		if (depth === 0) return tags.lastIndex;
	}
	return markup.length;
}

/** Markup with every element an opener finds replaced by what is kept of it. */
function replaced(body: string, opener: RegExp, tag: string, kept: (whole: string) => string) {
	let [out, rest] = ['', body];
	for (let at = rest.search(opener); at >= 0; at = rest.search(opener)) {
		const end = closed(rest, at, tag);
		out += rest.slice(0, at) + kept(rest.slice(at, end));
		rest = rest.slice(end);
	}
	return out + rest;
}

const tooltip = /<span[^>]*role="tooltip"[^>]*\shidden\b/;
const disclosure = /<details\b(?![^>]*\sopen\b)/;
function summary(whole: string): string {
	return /<summary\b.*?<\/summary>/s.exec(whole)?.[0] ?? '';
}
const text = (markup: string): string =>
	markup
		// Code decorations and zero-width break opportunities preserve the original identifier.
		.replace(
			/<code\b[^>]*>([\s\S]*?)<\/code>/g,
			(_whole, inline: string) => `<code>${inline.replace(/<\/?(?:span|wbr)\b[^>]*>/g, '')}</code>`
		)
		.replace(/<!--.*?-->/gs, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');

/**
 * The words a page shows as it is first drawn. What a closed tooltip holds and what a closed
 * disclosure holds under its summary is told on request, so it is not among them.
 */
export const words = (body: string): string =>
	text(
		replaced(
			replaced(body, tooltip, 'span', () => ''),
			disclosure,
			'details',
			summary
		)
	);

/** The words every disclosure of a page holds, shown once it is opened. */
export const disclosed = (body: string): string =>
	[...body.matchAll(/<details\b.*?<\/details>/gs)].map((found) => text(found[0])).join(' ');

/** How many times a pattern occurs in markup. */
export const count = (body: string, pattern: RegExp): number => (body.match(pattern) ?? []).length;

const named = /<button\b[^>]*\saria-label="([^"]*)"/;
const plain = (markup: string) => text(markup).trim().replace(/&amp;/g, '&');

/**
 * Every verification badge in markup: whether it is the check or the cross, the name a reader
 * of the screen is given for it, and the reasons its tooltip tells when it is asked for.
 */
export function verdicts(
	body: string
): Array<{ passed: boolean; name: string; reasons: string[] }> {
	return body
		.split('class="hx-verdict')
		.slice(1)
		.map((rest) => {
			const tip = rest.slice(rest.search(/<span[^>]*role="tooltip"/));
			const told = tip.slice(0, closed(tip, 0, 'span')).replace(/<strong>.*?<\/strong>/s, '');
			return {
				passed: /^[^"]*\bpassed\b/.test(rest),
				name: plain(named.exec(rest)?.[1] ?? ''),
				reasons: [...told.matchAll(/<span>(.*?)<\/span>/gs)].map((found) => plain(found[1]))
			};
		});
}

/** Recorded diagnostics are tested independently from the initially closed Examples disclosure. */
export function verificationPanel(...given: Given): string {
	const host = hostProps(...given);
	const entity = host.entities.find((item) => item.id === host.route.entity)!;
	return render(EntityTests, {
		props: {
			entity,
			scope: host.scope,
			evidence: host.lens.evidence(entity.unit),
			behavior: host.lens.behavior(entity.unit),
			mediaBase: host.mediaBase,
			nav: { route: host.route, href: (to) => '/harness' + explorerRoutePath(to), go: host.onroute }
		}
	}).body;
}
