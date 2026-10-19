import { expect, test } from 'vitest';
import ExplorerCatalogScreen from '../../src/components/harness/ExplorerCatalogScreen.svelte';
import { revision } from '../entityFixture';
import { count, drawn, screen, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

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
		expect(body).toContain('aria-label="Open function"');
		const commit = mode === 'current' ? '' : `/commit/${commits.middle}`;
		expect(body).toContain(`/branch/feature%2Forders${commit}/functions/${ids.filter}`);
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
