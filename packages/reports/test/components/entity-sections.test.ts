import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntitySections from '../../src/components/harness/entity-sections/EntitySections.svelte';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { disclosed, hostProps, words } from '../entityRender';
import { nav } from '../entityPlaces';
import { ids } from '../entityUnits';

const pane = createRawSnippet(() => ({ render: () => '<p>the evidence of its kind</p>' }));
function sections(tab?: 'uses' | 'tests', purpose?: string) {
	const host = hostProps('commit', { category: 'pages', entity: ids.page, tab });
	const entity = explorerEntities(host.head).find((item) => item.id === ids.page)!;
	if (purpose !== undefined) entity.purpose = purpose;
	return render(EntitySections, { props: { host, entity, nav: nav(host.route), pane } }).body;
}

const documented = {
	path: 'docs/order-store.md',
	setup: 'const store = new OrderStore(accountId);',
	examples: [
		{
			name: 'Read the orders of an account',
			call: 'await store.orders()',
			input: [],
			output: []
		}
	]
};
/** The evidence tab of one entity, optionally with a committed document of its own. */
function evidence(
	category: 'functions' | 'services' | 'configs',
	id: string,
	tab: 'tests' | 'examples',
	documentation?: typeof documented
) {
	const host = hostProps('commit', { category, entity: id, tab });
	const found = explorerEntities(host.head).find((item) => item.id === id)!;
	const entity = documentation ? { ...found, unit: { ...found.unit, documentation } } : found;
	return render(EntitySections, { props: { host, entity, nav: nav(host.route), pane } }).body;
}

test('a page overview introduces its purpose before evidence and keeps usage in its tabs', () => {
	const body = sections();
	expect(body).toContain('aria-label="Orders page overview"');
	expect(words(body)).toContain('Lists the orders of an account.');
	expect(body.indexOf('Lists the orders of an account.')).toBeLessThan(
		body.indexOf('the evidence of its kind')
	);
	expect(sections(undefined, '')).not.toContain('class="ex-lead"');
	expect(body).not.toMatch(/aria-label="(?:Used In|Uses)"/);
	expect(body.indexOf('the evidence of its kind')).toBeLessThan(
		body.indexOf('aria-label="Performance profile"')
	);
	expect(body).not.toContain('aria-label="Size"');
});

test('what it uses and its tests replace the overview, and its evidence pane with it', () => {
	const related = sections('uses');
	expect(related).toContain('aria-label="Orders page uses"');
	expect(words(related)).not.toContain('the evidence of its kind');
	expect(words(related)).not.toContain('Lists the orders of an account.');
	const tests = sections('tests');
	expect(tests).toContain('aria-label="Orders page states"');
	expect(words(tests)).toContain('States');
	expect(words(tests)).not.toContain('Verification at bbbbbbb');
	expect(disclosed(tests)).toContain('Verification at bbbbbbb');
	expect(words(tests)).not.toContain('the evidence of its kind');
	expect(words(tests)).not.toContain('Lists the orders of an account.');
});

test('a service opens Examples at either address, construction first and verification apart', () => {
	for (const tab of ['tests', 'examples'] as const) {
		const body = evidence('services', ids.store, tab, documented);
		const shown = words(body);
		const at = (text: string) => shown.indexOf(text);
		expect(body).toContain('aria-label="OrderStore examples"');
		expect(shown).toContain('Create the service');
		expect(at('new OrderStore(accountId)')).toBeLessThan(at('store.orders()'));
		expect(at('store.orders()')).toBeLessThan(at('not test results'));
		expect(shown).not.toContain('Verification at bbbbbbb');
		expect(disclosed(body)).toContain('Verification at bbbbbbb');
		expect(shown).not.toContain('the evidence of its kind');
	}
	const bare = evidence('services', ids.store, 'tests');
	expect(words(bare)).toContain('No usage examples are documented at this commit.');
	expect(words(bare)).not.toContain('Create the service');
	expect(disclosed(bare)).toContain('Verification at bbbbbbb');
});

test('a function keeps its Examples alone and another kind keeps its Tests', () => {
	const helper = evidence('functions', ids.filter, 'tests', documented);
	expect(helper).toContain('aria-label="filterOrders examples"');
	expect(helper).not.toContain('<details');
	expect(words(helper)).not.toContain('Create the service');
	expect(words(helper)).not.toContain('Verification at bbbbbbb');
	const config = evidence('configs', ids.settings, 'tests', documented);
	expect(config).toMatch(/aria-label="[^"]+ tests"/);
	expect(config).not.toMatch(/aria-label="[^"]+ examples"/);
	expect(words(config)).toContain('Verification at bbbbbbb');
	expect(words(config)).not.toContain('store.orders()');
});
