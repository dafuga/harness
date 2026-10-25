import { expect, test } from 'vitest';
import { content, sectionWords as card, words } from './entityRender';
import { commits, ids } from './entityUnits';

/**
 * A config and a service are shown with the things around them as every entity is: under Used In
 * and Uses, exclusively in their own tabs. What uses a config is listed once, never a second
 * time under another name.
 */
const base = `/harness/branch/feature%2Forders/commit/${commits.middle}`;
const settings = { category: 'configs', entity: ids.settings } as const;
const store = { category: 'services', entity: ids.store } as const;
const named = (evidence: 'Tests' | 'Examples') => [
	'Overview',
	'Contract',
	'Used In',
	'Uses',
	evidence,
	'History',
	'Source'
];
const sections = (body: string) =>
	[...body.matchAll(/<section class="ex-card[^"]*" aria-label="([^"]+)"/g)].map(
		(match) => match[1]
	);
const tabs = (body: string) =>
	[...body.matchAll(/role="tab"[^>]*>(.*?)<\/(?:a|button)>/gs)].map((match) =>
		words(match[1]).trim()
	);
const times = (text: string, part: string) => text.split(part).length - 1;

test('a config and a service have the sections of every entity, a service showing Examples where a config shows Tests, and none is named Used by', () => {
	for (const [entity, evidence] of [
		[settings, 'Tests'],
		[store, 'Examples']
	] as const)
		for (const tab of [undefined, 'used-in', 'uses'] as const) {
			const body = content('commit', { ...entity, tab });
			expect(tabs(body), `${entity.entity} ${tab}`).toEqual(named(evidence));
			expect(words(body), `${entity.entity} ${tab}`).not.toMatch(
				/relationship|Used by|Used on pages/i
			);
		}
});

test('a config overview omits usage and its Used In tab lists each consumer once', () => {
	const overview = content('commit', settings);
	expect(sections(overview).filter((name) => /^Use/.test(name))).toEqual([]);
	expect(times(overview, `href="${base}/pages/${ids.page}"`)).toBe(0);
	expect(words(overview)).toContain('Settings it provides');
	expect(words(overview)).not.toContain('Nothing in the registry uses it.');
	const used = content('commit', { ...settings, tab: 'used-in' });
	expect(sections(used)).toEqual(['Used In']);
	expect(times(used, `href="${base}/pages/${ids.page}"`)).toBe(1);
	expect(card(used, 'Used In')).toMatch(/^Used In 1 .*Orders page/);
	expect(card(content('commit', { ...settings, tab: 'uses' }), 'Uses')).toBe(
		'Uses 0 It uses no component, function, config or service.'
	);
});

test('a service says what uses it, down from the page, and what it uses', () => {
	const overview = content('commit', store);
	expect(sections(overview).filter((name) => /^Use/.test(name))).toEqual([]);
	expect(card(content('commit', { ...store, tab: 'uses' }), 'Uses')).toBe(
		'Uses 0 It uses no component, function, config or service.'
	);
	const used = content('commit', { ...store, tab: 'used-in' });
	expect(card(used, 'Used In')).toMatch(/^Used In 3 .*Orders page.*OrderList.*SearchBox/);
	expect(sections(used)).toEqual(['Used In']);
	expect(used).toContain(`href="${base}/components/${ids.list}"`);
	expect(card(used, 'Used In')).not.toMatch(/src\/|\.ts\b/);
});
