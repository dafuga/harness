import { expect, test } from 'vitest';
import { content, drawn, hostProps, verdicts, words } from '../entityRender';
import { withRelationGroups } from '../entityRelationFixtures';
import { entityCatalog } from '../../src/utils/entityCatalog';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { explorerRelations } from '../../src/utils/explorerRelations';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { commits, ids } from '../entityUnits';

const sections = (body: string) =>
	[...body.matchAll(/<section class="ex-card" aria-label="([^"]+)"/g)].map((match) => match[1]);

const list = { category: 'components', entity: ids.list } as const;
/** The section of what a component uses, then the section of what uses it. */
const both = (mode: 'commit' | 'current' = 'commit') =>
	[content(mode, { ...list, tab: 'uses' }), content(mode, { ...list, tab: 'used-in' })] as const;

test('component cards have identical content in catalogs and every relationship host', () => {
	for (const mode of ['current', 'commit'] as const) {
		const catalog = content(mode, { category: 'components' });
		const cards = (body: string) =>
			[...body.matchAll(/<article\b[^]*?<\/article>/g)].map((m) => drawn(m[0]));
		const originals = cards(catalog);
		for (const card of originals)
			expect(card).toContain('data-harness-component="explorer-module-card"');
		const routes = [
			{ category: 'pages', entity: ids.page, tab: 'uses' },
			{ category: 'components', entity: ids.list, tab: 'uses' },
			{ category: 'components', entity: ids.card, tab: 'used-in' },
			{ category: 'services', entity: ids.store, tab: 'used-in' },
			{ category: 'functions', entity: ids.filter, tab: 'used-in' }
		] as const;
		for (const route of routes) {
			for (const card of cards(content(mode, route)))
				expect(card).toContain('data-harness-component="explorer-module-card"');
			const related = cards(content(mode, route)).filter((card) => card.includes('ex-card-shot'));
			expect(related.length, JSON.stringify(route)).toBeGreaterThan(0);
			for (const card of related) {
				expect(originals, JSON.stringify(route)).toContain(card);
				expect(card).not.toMatch(/<p\b|<button|<figcaption|hx-verdict/);
			}
		}
	}
});

test('what an entity uses is one section of kinds of their own, and what uses it is another', () => {
	for (const mode of ['current', 'commit'] as const) {
		const [uses, used] = both(mode);
		expect([sections(uses), sections(used)]).toEqual([['Uses'], ['Used In']]);
		expect(words(uses)).toMatch(/Components\s+1[^]*OrderCard[^]*Functions\s+1[^]*Services\s+1/);
		expect(words(uses + used)).not.toMatch(/sub-?components|\brelated\b/i);
		expect(words(uses + used)).not.toMatch(/src\/|\.ts\b/);
		expect(uses, 'Relationships reuse catalog cards').toContain('ex-function-tile');
		expect(uses).toContain('ex-page-card');
		expect(uses).toContain('aria-label="Services uses"');
		expect(used).toContain('ex-page-card');
		expect(words(used)).toMatch(/Used In\s+1\s+Pages\s+1[^]*Orders page/);
		expect(used).toContain('aria-label="Used In"');
		expect(uses).toContain('aria-label="Used In"');
		for (const body of [uses, used]) {
			expect(
				verdicts(body.slice(body.indexOf('class="ex-relations"'))),
				'usage rows omit verification marks'
			).toHaveLength(0);
			expect(verdicts(/<header class="ex-head"[^]*?<\/header>/.exec(body)![0])).toHaveLength(1);
		}
	}
});

test('each related entity is a link to it in the same branch and commit', async () => {
	const [uses, used] = both();
	const base = `/harness/branch/feature%2Forders/commit/${commits.middle}`;
	expect(uses).toContain(`href="${base}/components/${ids.card}"`);
	expect(uses).toContain(`href="${base}/helpers/filterOrders/in/${ids.filter}/contract"`);
	expect(uses).toContain(`href="${base}/services/${ids.store}"`);
	expect(used).toContain(`href="${base}/pages/${ids.page}"`);
	// A kind the entity uses nothing of is left out; it is not listed as an empty one.
	expect(words(uses)).not.toContain('Configs');
	await measureWorkload('reports.function.entity-catalog', 'single-owner-service-relations', () => {
		const head = withRelationGroups(hostProps('current').head);
		const entities = explorerEntities(head);
		const services = entities.filter((entity) => entity.id.startsWith('consumer.service.'));
		const relations = (id: string) => explorerRelations(head, id);
		const related = entityCatalog(services, 'services', relations, {
			related: true,
			consumers: entities
		});
		expect(related, 'single-owner classes remain in their owner relationships').toHaveLength(9);
		expect(related.every((row) => !row.shared && row.usedIn?.length === 1)).toBe(true);
		expect(related.every((row) => row.usedIn?.[0]?.id === ids.page)).toBe(true);
		expect(related.map((row) => row.id)).toEqual(services.map((service) => service.id));
		const unproven = services.map((entity) => ({
			...entity,
			unit: { ...entity.unit, serviceClasses: [] }
		}));
		expect(
			entityCatalog(unproven, 'services', relations, { related: true, consumers: entities }),
			'relationships do not invent class proof'
		).toEqual([]);

		const collection = entityCatalog(entities, 'services', relations);
		expect(collection.some((row) => services.some((service) => row.id === service.id))).toBe(false);
		const owner = content(
			'current',
			{ category: 'pages', entity: ids.page, tab: 'uses' },
			{ head }
		);
		for (const service of services.slice(0, 4)) expect(owner).toContain(`/services/${service.id}`);
		for (const service of services.slice(4)) expect(owner).not.toContain(`/services/${service.id}`);
		expect(owner).toContain('aria-label="View more Services"');
	});
});

test('a page leads to its components and a component to the components inside it', () => {
	const page = content('current', { category: 'pages', entity: ids.page, tab: 'uses' });
	expect(page).toContain(`href="/harness/branch/feature%2Forders/components/${ids.list}"`);
	expect(page).toContain(`href="/harness/branch/feature%2Forders/configs/${ids.settings}"`);
	const tabs = [...page.matchAll(/role="tab"[^>]*>(.*?)<\/(?:a|button)>/gs)].map((match) =>
		words(match[1]).trim()
	);
	expect(tabs).toEqual(['Overview', 'Contract', 'Uses', 'States', 'History', 'Source']);
});
