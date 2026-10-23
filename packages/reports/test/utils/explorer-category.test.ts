import { measureWorkload } from '../../../../test/support/measureWorkload';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { explorerEntityCategories as explorerCategories } from '../../../../src/utils/explorerRoute';
import type { HarnessUnit } from '../../src/models/Harness.types';
import { explorerCategory, explorerRole } from '../../src/utils/explorerCategory';
import { unit } from '../explorerFixture';

const owning = (id: string, kind: string, source: string[]) =>
	unit(id, kind, { owns: { source, symbols: [] } });

test.each(explorerCategories)('compatibility details routes are nonvisual: %s', (category) => {
	const path = `packages/reports/src/routes/harness/branch/[branch]/[...at]/${category}/[entity]/details/+page.svelte`;
	const alias = owning(`page.${category}.details`, 'page', [path]);
	expect(explorerCategory(alias), 'compatibility routes are nonvisual').toBe('services');
	expect(explorerRole(alias)).toBe('Route alias');
	expect(
		explorerCategory(owning('page.real-details', 'page', ['src/routes/details/+page.svelte']))
	).toBe('pages');
});

test('a unit of a product kind is listed under the category of that kind', () =>
	measureWorkload('reports.function.explorer-category', 'layout-catalog-behavior', () => {
		expect(explorerCategory(unit('reports.component.select', 'component'))).toBe('components');
		expect(explorerCategory(unit('function.slugify', 'function'))).toBe('functions');
		expect(explorerCategory(unit('validator.codex-request', 'validator'))).toBeNull();
		expect(explorerCategory(unit('serializer.report-export', 'serializer'))).toBeNull();
		expect(explorerCategory(unit('reports.config.report-vite', 'config'))).toBe('configs');
		expect(explorerCategory(unit('service.title', 'service'))).toBe('services');
		expect(explorerCategory(unit('model.order', 'model'))).toBe('models');
		expect(
			explorerCategory(unit('model.unknown', 'model', { ...{ modelDefinitions: undefined } })),
			'missing source does not prove a model'
		).toBeNull();
		expect(
			explorerCategory(unit('model.value', 'model', { ...{ modelDefinitions: [] } })),
			'a value namespace is not a database model or type collection'
		).toBeNull();
		const classOnly = unit('model.client', 'model', {
			...{
				modelDefinitions: [
					{ name: 'Client', kind: 'class', source: 'src/model.client.ts', fields: [], methods: [] }
				]
			}
		});
		expect(
			explorerCategory(classOnly),
			'a runtime class alone does not prove persistence'
		).toBeNull();
		const mixed = owning('model.input', 'model', [
			'src/models/Input.types.ts',
			'src/models/InputValues.ts'
		]);
		expect(
			explorerCategory(mixed),
			'runtime constants do not turn interfaces into database models'
		).toBe('types');
		expect(explorerRole(mixed), 'the mixed type module keeps its declared role').toBe(
			'Type definitions'
		);
		for (const source of [['src/models/Order.types.ts'], ['src/models/domain/Order.d.ts']]) {
			const types = owning('model.order-types', 'model', source);
			expect(explorerCategory(types), 'Type collections are separate from data models').toBe(
				'types'
			);
			expect(explorerRole(types)).toBe('Type definitions');
		}
		expect(
			explorerCategory(
				owning('model.order', 'model', ['src/models/Order.types.ts', 'src/models/Order.ts'])
			)
		).toBe('models');
		expect(explorerCategory(unit('reports.endpoint.harness-data-path', 'endpoint'))).toBe(
			'services'
		);
		expect(explorerCategory(unit('adapter.git', 'adapter'))).toBe('services');
		expect(explorerCategory(unit('repository.budget-ledger', 'repository'))).toBe('services');
		expect(explorerCategory(unit('workflow.run-verify', 'workflow'))).toBe('services');
	}));

test('a page is what renders an address, whatever kind it was registered as', () => {
	const rendered = ['src/routes/titles/+page.server.ts', 'src/routes/titles/+page.svelte'];
	expect(explorerCategory(owning('page.titles', 'page', rendered))).toBe('pages');
	// A page that was registered as a component is still a page.
	expect(
		explorerCategory(owning('component.orders', 'component', ['src/routes/o/+page.svelte']))
	).toBe('pages');
	// A loader that only redirects renders nothing: it answers a request, as a service does.
	const loader = owning('page.root', 'page', ['src/routes/+page.server.ts']);
	expect(explorerCategory(loader)).toBe('services');
	expect(explorerRole(loader)).toBe('Route loader');
	// A layout frames pages; it is not an address of its own.
	const layout = owning('layout.root', 'layout', ['src/routes/+layout.svelte']);
	expect(explorerCategory(layout)).toBe('layouts');
	expect(explorerRole(layout)).toBe('Layout');
	const configuration = owning('layout.options', 'layout', ['src/routes/+layout.ts']);
	expect(explorerCategory(configuration), 'rendering flags have no screenshot').toBe('configs');
	expect(explorerRole(configuration)).toBe('Route configuration');
});

test('what is not one of the five product kinds has no category and says what it is', () => {
	const support: Array<[string, string]> = [
		['audit', 'Audit rule'],
		['guide', 'Guide'],
		['template', 'Template'],
		['module', 'Module'],
		['entry', 'Entry point'],
		['script', 'Script'],
		['seeder', 'Seeder'],
		['style', 'Style sheet'],
		['never-heard-of', 'Never heard of']
	];
	for (const [kind, role] of support) {
		const made = unit(`a.${kind}.b`, kind);
		expect([kind, explorerCategory(made), explorerRole(made)]).toEqual([kind, null, role]);
	}
});

test('a unit inside a category says its role in a word a reader knows', () => {
	expect(explorerRole(owning('page.titles', 'page', ['src/routes/titles/+page.svelte']))).toBe(
		'Page'
	);
	expect(explorerRole(unit('c.component.x', 'component'))).toBe('Component');
	expect(explorerRole(unit('function.slugify', 'function'))).toBe('Function');
	expect(explorerRole(unit('validator.x', 'validator'))).toBe('Validator');
	expect(explorerRole(unit('config.x', 'config'))).toBe('Config');
	expect(explorerRole(unit('service.x', 'service'))).toBe('Service');
	expect(explorerRole(unit('endpoint.x', 'endpoint'))).toBe('Endpoint');
	expect(explorerRole(unit('command.x', 'command'))).toBe('Command');
});

/** The registry of this repository, as its manifests state it. */
function ownRegistry(): HarnessUnit[] {
	const directory = join(import.meta.dirname, '../../../../specification/units');
	return readdirSync(directory)
		.filter((name) => name.endsWith('.json'))
		.map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as HarnessUnit);
}

test("the policy holds for Harness's own registry", () => {
	const units = ownRegistry().filter((item) => item.status === 'active');
	expect(units.length).toBeGreaterThan(500);
	const listed = (category: string) => units.filter((item) => explorerCategory(item) === category);
	const aliases = new Set(
		explorerCategories.map(
			(category) => `reports.page.harness-branch-branch-at-${category}-entity-details`
		)
	);
	// Every page renders an address, and every unit that renders one is a page.
	const rendering = units.filter(
		(item) =>
			item.owns.source.some((path) => path.endsWith('/+page.svelte')) &&
			!aliases.has(item.id) &&
			!item.owns.source.some((path) => /\/shells(?:\/|$)/.test(path))
	);
	expect(
		listed('pages')
			.map((item) => item.id)
			.sort()
	).toEqual(rendering.map((item) => item.id).sort());
	expect(listed('pages').map((item) => item.id)).toContain('reports.page.harness-view');
	expect(listed('pages').map((item) => item.id)).not.toContain('reports.page.root');
	expect(listed('pages').map((item) => item.id)).not.toContain('reports.layout.root');
	// No rule, guide, template or model is presented as a function of the product.
	const invented = ['audit', 'guide', 'template', 'module', 'entry', 'script', 'style'];
	for (const item of units.filter((found) => invented.includes(found.kind))) {
		expect([item.id, explorerCategory(item)]).toEqual([item.id, null]);
	}
	for (const item of listed('functions')) {
		expect(['function', 'validator', 'serializer', 'kernel']).toContain(item.kind);
	}
	// Every unit has a category of the five or none, and a role either way.
	for (const item of units) {
		const category = explorerCategory(item);
		expect(category === null || explorerCategories.some((known) => known === category)).toBe(true);
		expect(explorerRole(item)).toMatch(/^[A-Z][a-z]+( [a-z]+)*$/);
	}
	for (const category of ['functions', 'models', 'types'])
		expect(listed(category), 'raw manifests have no source-derived declaration proof').toEqual([]);
	for (const category of explorerCategories.filter(
		(kind) => !['functions', 'models', 'types'].includes(kind)
	)) {
		expect(listed(category).length).toBeGreaterThan(0);
	}
});

test('only explicitly pure functions with distinct runtime consumers are helpers', () => {
	const helper = { name: 'format', source: 'src/utils/format.ts', inputs: [], pure: true };
	for (const kind of ['function', 'helper', 'module', 'validator', 'serializer', 'kernel']) {
		const variants = [
			{ ...helper, consumers: [] },
			{ ...helper, consumers: [{ unit: 'component.one' }] },
			{ ...helper, consumers: [{ unit: 'component.one' }, { unit: 'component.one' }] },
			{ ...helper, pure: false, consumers: [{ unit: 'component.one' }, { unit: 'component.two' }] },
			{
				...helper,
				pure: undefined,
				consumers: [{ unit: 'component.one' }, { unit: 'component.two' }]
			}
		];
		for (const entry of variants) {
			expect(
				explorerCategory(unit('function.private', kind, { helpers: [entry] })),
				'Private functions are not helpers'
			).toBeNull();
		}
		for (const consumers of [
			[{ unit: 'component.one' }, { unit: 'component.two' }],
			[
				{ unit: 'function.calls', symbol: 'first' },
				{ unit: 'function.calls', symbol: 'second' }
			]
		]) {
			expect(
				explorerCategory(unit('function.shared', kind, { helpers: [{ ...helper, consumers }] }))
			).toBe('functions');
		}
		expect(explorerCategory(unit('function.legacy', kind, { helpers: undefined }))).toBeNull();
	}
});
