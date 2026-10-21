import { expect, test } from 'vitest';
import ExplorerCatalogScreen from '../../src/components/harness/ExplorerCatalogScreen.svelte';
import { revision } from '../entityFixture';
import { count, drawn, screen, words } from '../entityRender';
import { commits, ids } from '../entityUnits';
import { withHelpers } from '../entityPreviewHelpers';

test.each(['current', 'commit'] as const)(
	'model cards share the concise code-and-consumers layout at %s scope',
	(mode) => {
		const head = withHelpers(revision(mode === 'current' ? commits.tip : commits.middle, []));
		const body = screen(ExplorerCatalogScreen, mode, { category: 'models' }, { head });
		const card = /<article\b.*?<\/article>/s.exec(body)?.[0] ?? '';
		expect(count(body, /<article\b/g)).toBe(1);
		expect(card).toMatch(/<code[^>]*>Order<\/code>/);
		expect(words(card)).toContain('Used In');
		for (const consumer of ['Order list', 'Order store']) expect(words(card)).toContain(consumer);
		expect(card).not.toMatch(/<h2|<p\b|ex-pill|hx-verdict/);
		expect(count(card, /<button\b/g)).toBe(1);
		expect(card).toContain('aria-label="View code for Order"');
		expect(body).not.toContain('ex-legend');
		const scope = `/branch/feature%2Forders${mode === 'current' ? '' : `/commit/${commits.middle}`}`;
		expect(card).toContain(`${scope}/models/app.model.order`);
		expect(card).toContain(`${scope}/components/${ids.list}`);
		expect(card).toContain(`${scope}/services/${ids.store}`);
		expect(card).not.toContain('helper=');
		expect(card).not.toContain('tab=contract');
	}
);

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
		expect(words(card)).toContain('Order list');
		expect(words(card)).toContain('Order store');
		expect(card).toContain(
			`/branch/feature%2Forders${mode === 'current' ? '' : `/commit/${commits.middle}`}/services/${ids.store}`
		);
		expect(card).not.toContain('ex-function-open');
		expect(count(card, /<button\b/g)).toBe(1);
		expect(card).toContain('aria-label="View code for filterOrders"');
		const commit = mode === 'current' ? '' : `/commit/${commits.middle}`;
		expect(body).toContain(`/branch/feature%2Forders${commit}/functions/${ids.filter}`);
		expect(body).toContain('helper=filterOrders');
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

test('helper usage selects three distinct eligible consumers before truncating', () => {
	const head = withHelpers(revision(commits.tip, []));
	const body = screen(ExplorerCatalogScreen, 'current', { category: 'functions' }, { head });
	const card = /<article\b.*?<\/article>/s.exec(body)![0];
	expect(words(card)).toContain('Used In');
	expect(count(card, /<a\b/g)).toBe(4);
	for (const target of [
		`components/${ids.list}`,
		`services/${ids.store}`,
		'models/app.model.order'
	])
		expect(card).toContain(`/branch/feature%2Forders/${target}`);
	for (const excluded of [ids.page, ids.card, 'missing']) expect(card).not.toContain(excluded);
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
});
