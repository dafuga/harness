import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import { explorerRoute, explorerRoutePath } from '../../../src/utils/explorerRoute';
import EntityRelations from '../src/components/explorer-ui/entity-relations/EntityRelations.svelte';
import type { ExplorerRelations } from '../src/models/Explorer.types';
import type { EntityNav } from '../src/utils/entityLens';
import { content, hostProps, words } from './entityRender';
import { commits, ids } from './entityUnits';

/**
 * What an entity is shown with of the things around it: a section named Used In and one named
 * Uses, each in its own tab and absent from the overview. Nothing is called a relationship, and neither
 * section shows the path of a source file.
 */
const base = `/harness/branch/feature%2Forders/commit/${commits.middle}`;
const list = { category: 'components', entity: ids.list } as const;
const filter = { category: 'functions', entity: ids.filter } as const;
const page = { category: 'pages', entity: ids.page } as const;
/** The cards of a screen by the name each is read out with, in the order they are drawn. */
const sections = (body: string) =>
	[...body.matchAll(/<section class="ex-card[^"]*" aria-label="([^"]+)"/g)].map(
		(match) => match[1]
	);
const tabs = (body: string) =>
	[...body.matchAll(/role="tab"[^>]*>(.*?)<\/(?:a|button)>/gs)].map((match) =>
		words(match[1]).trim()
	);
/** The words of one card, from its name to its end; empty when the screen has no such card. */
function card(body: string, name: string): string {
	const from = body.indexOf(`aria-label="${name}"`);
	if (from < 0) return '';
	const text = words(body.slice(body.indexOf('>', from) + 1, body.indexOf('</section>', from)));
	return text.replace(/\s+/g, ' ').trim();
}

test('the sections of an entity are named Used In and Uses, and none is a relationship', () => {
	for (const entity of [list, filter, page]) {
		const body = content('commit', entity);
		expect(tabs(body)).toEqual([
			'Overview',
			entity.category === 'pages' ? 'Models' : 'Contract',
			...(entity.category === 'pages' ? ['APIs'] : []),
			...(entity.category === 'pages' ? [] : ['Used In']),
			'Uses',
			...(entity.category === 'components' ? ['Audio'] : []),
			entity.category === 'functions' ? 'Examples' : 'States',
			'History',
			'Source'
		]);
		expect(words(body)).not.toMatch(/relationship|\brelated\b|Used by|Used on pages/i);
		expect(sections(body).filter((name) => /^Use/.test(name))).toEqual([]);
	}
});

test('Used In lists what uses the entity, the pages that show it too, each once and with what it is', () => {
	const body = content('commit', { ...filter, tab: 'used-in' });
	const used = card(body, 'Used In');
	expect(sections(body)).toEqual(['Used In']);
	expect(body).toContain('aria-label="filterOrders used in"');
	expect(used).toMatch(/^Used In 2 /);
	expect(used).toMatch(/Orders page/);
	expect(used).toMatch(/OrderList/);
	for (const name of ['Orders page', 'OrderList'])
		expect([...body.matchAll(new RegExp(`<article[^>]*aria-label="${name}"`, 'g'))]).toHaveLength(
			1
		);
	expect(body).toContain(`href="${base}/pages/${ids.page}"`);
	expect(body).toContain(`href="${base}/components/${ids.list}"`);
});

test('Uses keeps what the entity depends on apart by kind and leaves out a kind it uses nothing of', () => {
	const body = content('commit', { ...list, tab: 'uses' });
	const uses = card(body, 'Uses');
	expect(sections(body)).toEqual(['Uses']);
	expect(body).toContain('aria-label="OrderList uses"');
	expect(uses).toMatch(
		/Uses 3 .*Components 1 .*OrderCard.*Functions 1 .*filterOrders.*Services 1 .*OrderStore/
	);
	expect(uses).not.toContain('Configs');
	// Reused cards may mention their own consumers without listing them as dependencies.
	expect(body).not.toMatch(/<article\b[^>]*aria-label="Orders page"/);
	expect(body).toContain(`href="${base}/pages/${ids.page}"`);
	for (const [kind, id] of [
		['components', ids.card],
		['helpers', `filterOrders/in/${ids.filter}/contract`],
		['services', ids.store]
	])
		expect(body).toContain(`href="${base}/${kind}/${id}"`);
	expect(card(content('commit', { ...page, tab: 'uses' }), 'Uses')).toMatch(
		/Uses 3 .*Components 2 .*OrderList.*SearchBox.*Configs 1 .*orderSettings/
	);
});

test('the overview and both dedicated usage sections show no source paths', () => {
	const screens = ([undefined, 'used-in', 'uses'] as const).map((tab) =>
		content('commit', { ...list, tab })
	);
	for (const body of screens)
		for (const name of ['Used In', 'Uses'])
			expect(card(body, name)).not.toMatch(/src\/|\.ts\b|\.svelte\b/);
	expect(card(screens[1], 'Used In')).toMatch(/Orders page/);
	expect(card(screens[2], 'Uses')).toMatch(/Components 1 .*OrderCard/);
});

test('a former relationships address opens the overview without embedded usage sections', () => {
	const at = (search: string) => explorerRoute(`/branch/main/components/${ids.list}`, search);
	expect([at('?tab=used-in')?.tab, at('?tab=uses')?.tab]).toEqual(['used-in', 'uses']);
	expect(at('?tab=relationships')?.tab).toBe('relationships');
	const body = content('commit', { ...list, tab: 'relationships' });
	expect(body).toContain('aria-label="OrderList overview"');
	expect(sections(body).filter((name) => /^Use/.test(name))).toEqual([]);
	expect(body).toMatch(/aria-selected="true"[^>]*>\s*Overview/);
	expect(words(body)).not.toMatch(/relationship/i);
	for (const commit of [null, commits.middle]) {
		const location = { branch: 'main', commit, ...page };
		const path = `/branch/main${commit ? `/commit/${commit}` : ''}/pages/${ids.page}`;
		expect(explorerRoute(path, '?tab=used-in')).toEqual(location);
		expect(explorerRoutePath({ ...location, tab: 'used-in' })).toBe(path);
		const legacy = content(commit ? 'commit' : 'current', { ...page, tab: 'used-in' });
		expect(legacy).toContain('aria-label="Orders page overview"');
		expect(tabs(legacy)).not.toContain('Used In');
		expect(sections(legacy).filter((name) => /^Use/.test(name))).toEqual([]);
		expect(legacy).toMatch(/aria-selected="true"[^>]*>\s*Overview/);
	}
});

test('the audio section is available only on component details', () => {
	const at = (category: string) =>
		explorerRoute(`/branch/main/${category}/TitleList`, '?tab=audio');
	expect(at('components')?.tab).toBe('audio');
	for (const category of ['functions', 'configs', 'services'])
		expect(at(category)?.tab).toBeUndefined();
});

test('an entity nothing uses, one that uses nothing and one that was removed each say so', () => {
	expect(card(content('commit', { ...filter, tab: 'uses' }), 'Uses')).toContain(
		'Uses 0 It uses no component, function, config or service.'
	);
	const none: ExplorerRelations = {
		pages: [],
		layouts: [],
		components: [],
		functions: [],
		configs: [],
		services: [],
		usedBy: [],
		support: []
	};
	const route = { branch: 'main', commit: null, category: 'functions' } as const;
	const nav: EntityNav = { route, href: () => '/', go: () => {} };
	const empty = render(EntityRelations, {
		props: { relations: none, nav, host: hostProps('commit') }
	}).body;
	expect(card(empty, 'Used In')).toContain('Used In 0 No page shows it and nothing else uses it.');
	const body = render(EntityRelations, {
		props: { relations: none, nav, removed: true, host: hostProps('commit') }
	}).body;
	expect(card(body, 'Used In')).toContain(
		'Removed at this commit: nothing of this commit uses it.'
	);
	expect(card(body, 'Uses')).toContain('Removed at this commit: what it used is not listed here.');
});
