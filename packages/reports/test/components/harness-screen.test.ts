import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { explorerCategories } from '../../../../src/utils/explorerRoute';

const routes = join(import.meta.dirname, '../../src/routes/harness/branch/[branch]/[...at]');

test('every category has a page of its own for its catalog and for each view of an entity', () => {
	const screens = ['', '/[entity]', '/[entity]/details', '/[entity]/history'];
	for (const category of explorerCategories) {
		for (const screen of screens) {
			const file = join(routes, `${category}${screen}`, '+page.svelte');
			expect([file.slice(routes.length), existsSync(file)]).toEqual([
				file.slice(routes.length),
				true
			]);
		}
	}
});
