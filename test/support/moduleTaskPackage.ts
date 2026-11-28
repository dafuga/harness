import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';

/**
 * Make the orders verification test import a package that exists only in the fixture
 * repository's git-ignored node_modules, as in a real repository with installed packages.
 */
export async function useInstalledPackage(fixture: { root: string; git: GitAdapter }) {
	const { root, git } = fixture;
	const pkg = join(root, 'node_modules/fixture-orders-helper');
	await mkdir(pkg, { recursive: true });
	await writeFile(
		join(pkg, 'package.json'),
		JSON.stringify({ name: 'fixture-orders-helper', type: 'module', main: 'index.js' })
	);
	await writeFile(join(pkg, 'index.js'), 'export const doubled = (value) => value * 2;\n');
	await writeFile(join(root, '.gitignore'), '.cache/\nnode_modules/\n');
	await writeFile(
		join(root, 'src/orders.test.ts'),
		`import { test, expect } from 'bun:test';
import { doubled } from 'fixture-orders-helper';
import { orders } from './orders';
// Duplicate notes about the expected results below.
test('orders', () => {
	expect(orders(true)).toBe(doubled(1));
	expect(orders(false)).toBe(0);
});
`
	);
	await git.run(['add', '.gitignore', 'src/orders.test.ts']);
	await git.run(['commit', '-qm', 'test: verify orders with an installed package']);
}
