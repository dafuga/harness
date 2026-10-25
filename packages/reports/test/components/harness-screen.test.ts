import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { explorerEntityCategories } from '../../../../src/utils/explorerRoute';

const routes = join(import.meta.dirname, '../../src/routes/harness/branch/[branch]/[...at]');

test('every category has a page of its own for its catalog and for each view of an entity', () => {
	const screens = ['', '/[entity]', '/[entity]/history'];
	for (const category of explorerEntityCategories) {
		const legacy = join(routes, category, '[entity]/details/+page.svelte');
		expect(existsSync(legacy), `${category} legacy alias`).toBe(category !== 'apis');
		for (const screen of screens) {
			const file = join(routes, `${category}${screen}`, '+page.svelte');
			expect([file.slice(routes.length), existsSync(file)]).toEqual([
				file.slice(routes.length),
				true
			]);
		}
	}
});

test('platform configuration has catalog and detail pages without source-entity history pages', () => {
	for (const screen of ['', '/[entity]'])
		expect(existsSync(join(routes, `platforms${screen}`, '+page.svelte'))).toBe(true);
});
