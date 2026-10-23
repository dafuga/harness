import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { render } from 'svelte/server';
import ExplorerUsage from '../../src/components/ExplorerUsage.svelte';
import ExplorerPageCard from '../../src/components/explorer-ui/ExplorerPageCard.svelte';
import { entityCatalog } from '../../src/utils/entityCatalog';
import { content, hostProps, words } from '../entityRender';
import { commits, ids } from '../entityUnits';
import { withHelpers, withNamedConsumers } from '../entityPreviewHelpers';
import { explorerRelations } from '../../src/utils/explorerRelations';

for (const mode of ['current', 'commit'] as const) {
	test.each([0, 1, 3, 4, 7])(
		`component card usage is flat and capped with %i consumers at ${mode} scope`,
		(total) => {
			const host = hostProps(mode);
			const nav = { route: host.route, href: host.lens.href, go: host.onroute };
			const row = entityCatalog(host.entities, 'components', host.lens.relations)[0];
			const body = render(ExplorerPageCard, {
				props: {
					row: { ...row, usedIn: host.entities.slice(0, total) },
					category: 'components',
					shot: null,
					nav,
					lens: host.lens,
					mediaBase: host.mediaBase
				}
			}).body;
			const footer = body.slice(body.search(/<div class="ex-usage\b/));
			expect((footer.match(/<a\b/g) ?? []).length).toBe(Math.min(total, 3));
			expect(footer).not.toContain('ex-usage-kind');
			expect(words(footer).includes('…')).toBe(total > 3);
			if (total === 0) expect(words(footer).trim()).toBe('Used In —');
		}
	);

	test(`shared usage footers render links and empty usage at ${mode} scope`, async () => {
		const host = hostProps(mode);
		const nav = { route: host.route, href: host.lens.href, go: host.onroute };
		const props = { nav, lens: host.lens, mediaBase: host.mediaBase };
		const consumers = host.entities.filter((item) => item.id === ids.list || item.id === ids.store);
		const body = render(ExplorerUsage, { props: { ...props, consumers } }).body;
		expect(words(body)).toContain('Used In');
		expect(body).not.toMatch(/aria-label="(?:Components|Services)"|ex-usage-kind/);
		const many = [
			consumers[0],
			consumers[0],
			...host.entities.filter((item) => item.id !== consumers[0].id)
		];
		const capped = render(ExplorerUsage, { props: { ...props, consumers: many } }).body;
		expect([...capped.matchAll(/<a\b/g)]).toHaveLength(3);
		for (const item of [...new Map(many.map((item) => [item.id, item])).values()].slice(0, 3))
			expect(capped).toContain(item.name);
		const base = `/harness/branch/feature%2Forders${mode === 'commit' ? `/commit/${commits.middle}` : ''}`;
		expect(body).toContain(`href="${base}/components/${ids.list}"`);
		expect(body).toContain(`href="${base}/services/${ids.store}"`);
		expect(body).not.toContain('<img');
		const dense = [
			ids.store,
			ids.list,
			ids.settings,
			ids.search,
			ids.list,
			ids.page,
			ids.filter
		].map((id) => host.entities.find((item) => item.id === id)!);
		const footer = render(ExplorerUsage, {
			props: { ...props, consumers: dense, layout: 'flat', limit: 3 }
		}).body;
		const links = [...footer.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]);
		expect(links, 'Only the first three distinct consumers in supplied order').toEqual([
			`${base}/services/${ids.store}`,
			`${base}/components/${ids.list}`,
			`${base}/configs/${ids.settings}`
		]);
		const empty = render(ExplorerUsage, { props: { ...props, consumers: [] } }).body;
		expect(words(empty).trim()).toBe('Used In —');
		expect(empty).not.toContain('<a');
		await measureWorkload('reports.function.entity-usage', `named-helper-consumers-${mode}`, () => {
			for (const sameOwner of [false, true]) assertNamedUsage(mode, sameOwner);
		});
	});
}

function assertNamedUsage(mode: 'current' | 'commit', sameOwner: boolean): void {
	const head = withNamedConsumers(hostProps(mode).head, sameOwner);
	const body = content(mode, { category: 'functions' }, { head });
	const cards = [...body.matchAll(/<article\b[^]*?<\/article>/g)];
	expect(
		cards,
		'Private named callers establish sharing without becoming catalog cards'
	).toHaveLength(1);
	const footer = cards[0][0].slice(cards[0][0].indexOf('class="ex-usage'));
	for (const name of ['firstCall', 'secondCall', 'thirdCall'])
		expect(words(footer)).toContain(name);
	expect(words(footer)).not.toContain('fourthCall');
	expect(words(footer), 'Four distinct named consumers retain overflow').toContain('…');
	expect([...footer.matchAll(/<a\b/g)]).toHaveLength(3);
	const helper = head.registry.units.find((unit) => unit.id === ids.filter)!.helpers![0];
	const first = helper.consumers![0];
	for (const consumers of [
		[first, first],
		[first, { unit: ids.filter, symbol: helper.name }],
		[first, { unit: 'missing', symbol: 'notHere' }]
	]) {
		helper.consumers = consumers;
		expect(content(mode, { category: 'functions' }, { head })).not.toContain('<article');
	}
}

test('private and unclassified dependencies reuse the shared module card', () => {
	for (const mode of ['current', 'commit'] as const) {
		const head = withHelpers(hostProps(mode).head);
		const shape = 'app.model.order-shape-types';
		const template = head.registry.units.find((unit) => unit.id === ids.filter)!;
		head.registry.units.push({
			...template,
			id: shape,
			kind: 'model',
			title: 'OrderShape.types',
			helpers: [],
			owns: { source: ['src/models/OrderShape.types.ts'], symbols: ['OrderShape'] }
		});
		head.registry.units
			.find((unit) => unit.id === ids.list)!
			.dependencies.push({ unit: shape, via: 'import' });
		const body = content(mode, { category: 'components', entity: ids.list, tab: 'uses' }, { head });
		const support = explorerRelations(head, ids.list).support.filter((item) =>
			['function.single', shape].includes(item.id)
		);
		expect(support).toHaveLength(2);
		for (const item of support) {
			const card = [...body.matchAll(/<article\b[^]*?<\/article>/g)]
				.map((match) => match[0])
				.find((markup) => markup.includes(`aria-label="${item.name}"`));
			expect(card, 'Dependencies must be shared cards, not plain Other rows').toBeDefined();
			expect(card).toContain('data-harness-component="explorer-ui-explorer-module-card"');
			expect(card).toContain('aria-label="Used In"');
			expect(card).not.toContain('ex-pill');
			if (item.id === 'function.single') expect(card).toContain('/functions/function.single');
			else
				for (const category of ['models', 'functions'])
					expect(card).not.toContain(`/${category}/${shape}`);
		}
	}
});
