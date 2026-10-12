import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { explorerCategories } from '../../../../src/utils/explorerRoute';
import { resolveImport } from '../../../../src/utils/resolveImport';
import { scanImports } from '../../../../src/utils/scanImports';

// The imports of the real source, read and resolved as `harness units index` reads them, so what
// is asserted here is what the registry will say a page is made of.
const repo = join(import.meta.dirname, '../../../..');
const workspaceRoot = 'packages/reports';
const under = (directory: string): string[] =>
	readdirSync(join(repo, directory), { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? under(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]
	);
const files = new Set([...under('src'), ...under(`${workspaceRoot}/src`)]);
const components = `${workspaceRoot}/src/components`;
const routes = `${workspaceRoot}/src/routes/harness`;
const isComponent = (path: string) => path.endsWith('.svelte');
const named = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace('.svelte', '');

/** The files one file refers to: all of them, or only those it needs when it runs. */
function refers(path: string, runs: boolean): string[] {
	const script = path.endsWith('.ts') ? 'ts' : 'other';
	const language = isComponent(path) ? 'svelte' : script;
	const code = readFileSync(join(repo, path), 'utf8');
	return scanImports(code, language)
		.map((reference) => resolveImport(path, reference, { files, workspaceRoot }))
		.flatMap((found) => (found.path && !(runs && found.typeOnly) ? [found.path] : []));
}

/** Every component a file draws when it runs, through whatever it imports, by name. */
function drawn(path: string): string[] {
	const seen = new Set<string>();
	const walk = (from: string) => {
		for (const next of refers(from, true)) {
			if (seen.has(next)) continue;
			seen.add(next);
			walk(next);
		}
	};
	walk(path);
	return [...seen].filter(isComponent).map(named).sort();
}
const mounts = (path: string, runs = true) => refers(path, runs).filter(isComponent).map(named);

const views = { catalog: '', overview: '/[entity]', details: '/[entity]/details' };
const screens = { ...views, history: '/[entity]/history' };
const page = (category: string, view: string) =>
	`${routes}/branch/[branch]/[...at]/${category}${view}/+page.svelte`;

test('the host of a screen names no renderer, not even to read the type of its props', () => {
	const host = `${components}/harness/HarnessConsole.svelte`;
	// With type-only imports counted too: a renderer named for its props would still be an edge.
	expect(mounts(host, false)).toEqual(['HarnessHeader']);
	expect(mounts(`${components}/HarnessScreen.svelte`, false)).toEqual(['HarnessConsole']);
	expect(mounts(`${workspaceRoot}/src/models/ExplorerScreen.types.ts`, false)).toEqual([]);
	expect(drawn(`${components}/HarnessScreen.svelte`)).not.toContain('ExplorerContent');
});

test('the renderer of any screen is named only where the screen is not known', () => {
	const generic = [...files].filter(
		(path) => isComponent(path) && mounts(path, false).includes('ExplorerContent')
	);
	expect(generic.sort()).toEqual([
		`${components}/harness/HarnessShell.svelte`,
		`${routes}/[...view]/+page.svelte`
	]);
});

test('every page mounts the host with one screen of its own, and none draws every screen', () => {
	for (const category of explorerCategories) {
		for (const [screen, view] of Object.entries(screens)) {
			const mounted = mounts(page(category, view), false);
			expect([category, screen, mounted.length, mounted.includes('HarnessScreen')]).toEqual([
				category,
				screen,
				2,
				true
			]);
			expect([category, screen, drawn(page(category, view)).includes('ExplorerContent')]).toEqual([
				category,
				screen,
				false
			]);
		}
	}
});

test('the four screens of a category are made of different components', () => {
	for (const category of explorerCategories) {
		const made = Object.values(screens).map((view) => drawn(page(category, view)).join());
		expect([category, new Set(made).size]).toEqual([category, 4]);
	}
});

test('a catalog draws no entity view, and each entity view draws its own and not the others', () => {
	const own = { overview: 'EntityOverview', details: 'EntityDetails', history: 'EntityHistory' };
	for (const category of explorerCategories) {
		const catalog = drawn(page(category, screens.catalog));
		expect([category, Object.values(own).filter((name) => catalog.includes(name))]).toEqual([
			category,
			[]
		]);
		for (const [screen, view] of Object.entries(screens).slice(1)) {
			const has = Object.values(own).filter((name) => drawn(page(category, view)).includes(name));
			expect([category, screen, has]).toEqual([
				category,
				screen,
				[own[screen as keyof typeof own]]
			]);
		}
	}
});
