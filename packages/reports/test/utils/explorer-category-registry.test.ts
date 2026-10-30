import { expect, test } from 'vitest';
import { explorerEntityCategories as explorerCategories } from '../../../../src/utils/explorerRoute';
import { explorerCategory, explorerRole } from '../../src/utils/explorerCategory';
import { ownRegistry, sourceDeclaredModels } from '../ownRegistry';

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
			item.catalog?.visibility !== 'internal' &&
			!aliases.has(item.id) &&
			!item.owns.source.some((path) => /\/shells(?:\/|$)/.test(path))
	);
	expect(
		listed('pages')
			.map((item) => item.id)
			.sort()
	).toEqual(rendering.map((item) => item.id).sort());
	expect(listed('pages').map((item) => item.id)).not.toContain('reports.page.harness-view');
	expect(listed('pages').map((item) => item.id)).not.toContain('reports.page.root');
	expect(listed('pages').map((item) => item.id)).not.toContain('reports.layout.root');
	const invented = ['audit', 'guide', 'template', 'module', 'entry', 'script', 'style'];
	for (const item of units.filter((found) => invented.includes(found.kind))) {
		expect([item.id, explorerCategory(item)]).toEqual([item.id, null]);
	}
	for (const item of listed('functions')) {
		expect(['function', 'validator', 'serializer', 'kernel']).toContain(item.kind);
	}
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

test("Harness's own model modules are listed by the declarations their source owns", () => {
	const declared = sourceDeclaredModels(ownRegistry().filter((item) => item.status === 'active'));
	const projected = (category: string | null) =>
		declared
			.filter((item) => item.modelDefinitions?.length && explorerCategory(item) === category)
			.map((item) => item.id);
	expect(projected(null), 'owned shared declarations are listed as models or types').toEqual([]);
	expect(projected('models').length, 'stored classes are models').toBeGreaterThan(0);
	expect(projected('types').length, 'shared declarations are types').toBeGreaterThan(0);
});
