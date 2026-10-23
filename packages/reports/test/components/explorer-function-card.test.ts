import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import ExplorerCatalogScreen from '../../src/components/explorer-ui/ExplorerCatalogScreen.svelte';
import { revision } from '../entityFixture';
import { count, drawn, screen, words } from '../entityRender';
import { commits, ids } from '../entityUnits';
import { withHelpers } from '../entityPreviewHelpers';

test('function catalog cards stay concise and retain revision links without detail panels', () => {
	for (const mode of ['current', 'commit'] as const) {
		const body = screen(ExplorerCatalogScreen, mode, { category: 'functions' });
		const card = /<article\b.*?<\/article>/s.exec(body)![0];
		expect(count(body, /<article\b/g)).toBe(1);
		expect(count(body, /<img\b/g)).toBe(0);
		expect(words(card)).toContain('filterOrders(orders, "SERVICE")');
		expect(card).not.toMatch(/<h2|<p\b/);
		expect(words(card)).not.toContain('Filter orders');
		expect(words(card)).not.toContain('Returns the orders');
		expect(words(card)).not.toMatch(/Contract|Inputs|Output|Used by|View tests|Shared|Changed/);
		expect(count(body, /class="hx-verdict/g)).toBe(0);
		expect(count(card, /<a\b/g), 'function call and its two consumer links').toBe(3);
		expect(words(card)).toContain('Used In');
		expect(card).toContain('data-harness-component="explorer-ui-explorer-module-card"');
		expect(card).not.toContain('aria-label="Components"');
		expect(card).not.toContain('aria-label="Services"');
		expect(words(card)).toContain('OrderList');
		expect(words(card)).toContain('OrderStore');
		expect(card).toContain(
			`/branch/feature%2Forders${mode === 'current' ? '' : `/commit/${commits.middle}`}/services/${ids.store}`
		);
		expect(card).not.toMatch(/<svg|ex-function-open/);
		const commit = mode === 'current' ? '' : `/commit/${commits.middle}`;
		expect(body).toContain(
			`/branch/feature%2Forders${commit}/helpers/filterOrders/in/${ids.filter}/contract`
		);
		expect(body).not.toContain('tab=tests');
		expect(words(body)).not.toMatch(/src\/|\.ts\b/);
	}
});

test.each([false, 0, null, '', [], { label: '<script>example</script>' }, '🧪'.repeat(200)])(
	'function calls preserve declared sample values: %j',
	(value) => {
		const head = revision(commits.tip, []);
		head.registry = {
			...head.registry,
			units: head.registry.units.map((unit) =>
				unit.id === ids.filter
					? {
							...unit,
							owns: { ...unit.owns, symbols: ['helperType', 'filterOrders'] },
							helpers: [
								{
									name: 'filterOrders',
									pure: true,
									consumers: [{ unit: ids.list }, { unit: ids.store }],
									source: 'src/functions/filterOrders.ts',
									inputs: [{ name: 'filterOrders.value', type: 'unknown' }]
								}
							],
							contract: {
								...unit.contract,
								inputs: [
									{ name: 'filterOrders.value', type: 'unknown', examples: [value] },
									{ name: 'otherFunction.ignored', type: 'string', examples: ['wrong function'] }
								]
							}
						}
					: unit
			)
		};
		const body = screen(ExplorerCatalogScreen, 'current', { category: 'functions' }, { head });
		const code = /<code[^>]*>(.*?)<\/code>/s
			.exec(drawn(body))![1]
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&');
		expect(code).toBe(`filterOrders(${JSON.stringify(value)})`);
		expect(body).not.toContain('<script>');
	}
);

test('documented parameters belong to the displayed revision; missing values stay variables', () => {
	const head = revision(commits.tip, []);
	head.registry = {
		...head.registry,
		units: head.registry.units.map((unit) =>
			unit.id === ids.filter
				? {
						...unit,
						documentation: {
							path: 'usage.md',
							text: '# Usage',
							examples: [{ name: 'Search', input: { searchText: 'CURRENT' }, output: [] }]
						}
					}
				: unit
		)
	};
	const body = screen(ExplorerCatalogScreen, 'current', { category: 'functions' }, { head });
	expect(words(body)).toContain('filterOrders(orders, "CURRENT")');
	expect(words(screen(ExplorerCatalogScreen, 'commit', { category: 'functions' }))).toContain(
		'filterOrders(orders, "SERVICE")'
	);
});

test('helper usage selects three distinct eligible consumers before truncating', async () => {
	await measureWorkload(
		'reports.component.explorer-ui-explorer-module-card',
		'catalog-card-consumers',
		() => {
			const head = withHelpers(revision(commits.tip, []));
			const body = screen(ExplorerCatalogScreen, 'current', { category: 'functions' }, { head });
			const card = /<article\b.*?<\/article>/s.exec(body)![0];
			expect(words(card)).toContain('Used In');
			expect(card).toContain('data-harness-component="explorer-ui-explorer-module-card"');
			expect(card).not.toContain('aria-label="Components"');
			expect(card).not.toContain('aria-label="Services"');
			expect(count(card, /<a\b/g)).toBe(4);
			expect(words(card), 'A fourth eligible consumer must produce an ellipsis').toContain('…');
			for (const target of [`components/${ids.list}`, `services/${ids.store}`, `pages/${ids.page}`])
				expect(card).toContain(`/branch/feature%2Forders/${target}`);
			for (const excluded of ['app.model.order', ids.card, 'missing'])
				expect(card).not.toContain(excluded);
			const helper = head.registry.units.find((unit) => unit.id === ids.filter)!;
			for (const consumers of [
				[{ unit: ids.page }, { unit: ids.filter }],
				[{ unit: ids.list }, { unit: ids.filter }],
				[{ unit: ids.list }, { unit: 'missing' }],
				[
					{ unit: ids.list, symbol: 'first' },
					{ unit: ids.list, symbol: 'second' }
				]
			]) {
				helper.helpers![0].consumers = consumers;
				const empty = screen(ExplorerCatalogScreen, 'current', { category: 'functions' }, { head });
				expect(count(empty, /<article\b/g), 'zero or one visible consumer is private').toBe(0);
			}
		}
	);
});

test.each(['components', 'services', 'models', 'functions', 'pages', 'layouts', 'configs'])(
	'function footer retains a %s consumer in supplied order with overflow',
	(category) => {
		const head = withHelpers(revision(commits.tip, []));
		const owner = head.registry.units.find((unit) => unit.id === ids.filter)!;
		const caller = functionConsumer(owner);
		head.registry.units.push(caller, {
			...owner,
			id: 'app.layout.consumer',
			kind: 'layout',
			helpers: [],
			owns: { source: ['src/routes/+layout.svelte'], symbols: ['+layout'] }
		});
		const consumers = [
			{ category: 'components', id: ids.list },
			{ category: 'services', id: ids.store },
			{ category: 'models', id: 'app.model.order' },
			{ category: 'functions', id: caller.id },
			{ category: 'pages', id: ids.page },
			{ category: 'layouts', id: 'app.layout.consumer' },
			{ category: 'configs', id: ids.settings }
		];
		const ordered = [
			...consumers.filter((item) => item.category === category),
			...consumers.filter((item) => item.category !== category)
		];
		owner.helpers![0].consumers = [
			{ unit: owner.id },
			...ordered.map(({ id }) => ({ unit: id })),
			{ unit: ordered[0].id }
		];
		const body = screen(ExplorerCatalogScreen, 'current', { category: 'functions' }, { head });
		const card = [...body.matchAll(/<article\b[^]*?<\/article>/g)].find((match) =>
			match[0].includes('aria-label="filterOrders"')
		)![0];
		const footer = card.slice(card.indexOf('class="ex-usage'));
		const links = [...footer.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]);
		expect(links, 'A valid module consumer keeps its place; self references stay absent').toEqual(
			ordered
				.slice(0, 3)
				.map((item) => `/harness/branch/feature%2Forders/${item.category}/${item.id}`)
		);
		expect(words(footer), 'A fourth distinct module requires an ellipsis').toContain('…');
	}
);

function functionConsumer(owner: ReturnType<typeof revision>['registry']['units'][number]) {
	const source = 'src/functions/callFilter.ts';
	return {
		...owner,
		id: 'function.call-filter',
		title: 'callFilter',
		catalog: { visibility: 'internal' as const },
		owns: { source: [source], symbols: ['callFilter'] },
		helpers: [
			{
				...owner.helpers![0],
				name: 'callFilter',
				pure: false,
				source,
				consumers: [{ unit: ids.list }, { unit: ids.store }]
			}
		]
	};
}
