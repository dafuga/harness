import { drawn as visibleMarkup } from '../entityRender';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { expect, test } from 'vitest';
import { explorerEntityCategories as explorerCategories } from '../../../../src/utils/explorerRoute';
import { resolveImport } from '../../../../src/utils/resolveImport';
import { scanImports } from '../../../../src/services/source-index-service/scanImports';

// The imports of the real source, read and resolved as `harness units index` reads them, so what
// is asserted here is what the registry will say a page is made of.
const repo = join(import.meta.dirname, '../../../..');
const workspaceRoot = 'packages/reports';
const under = (directory: string): string[] =>
	readdirSync(join(repo, directory), { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? under(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]
	);
const files = new Set([...under('src'), ...under(`${workspaceRoot}/src`)]);
const units = readdirSync(join(repo, 'specification/units'))
	.filter((file) => file.endsWith('.json'))
	.map((file) => JSON.parse(readFileSync(join(repo, 'specification/units', file), 'utf8')));
/** Follow a registered forwarding entry to the same component's implementation. */
const entry = (path: string): string =>
	units.find(
		(unit) =>
			unit.status === 'active' &&
			unit.owns.source.includes(path) &&
			basename(unit.runtime.entry) === basename(path)
	)?.runtime.entry ?? path;
const components = `${workspaceRoot}/src/components`;
const routes = `${workspaceRoot}/src/routes/harness`;
const isComponent = (path: string) =>
	path.endsWith('.svelte') &&
	!units.some((unit) => unit.composition?.level === 'atom' && unit.owns.source.includes(path));
const named = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace('.svelte', '');

/** The files one file refers to: all of them, or only those it needs when it runs. */
function refers(path: string, runs: boolean): string[] {
	path = entry(path);
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
const screensFor = (category: string) =>
	category === 'apis'
		? { catalog: screens.catalog, overview: screens.overview, history: screens.history }
		: screens;
const page = (category: string, view: string) =>
	`${routes}/branch/[branch]/[...at]/${category}${view}/+page.svelte`;

test('the host of a screen names no renderer, not even to read the type of its props', () => {
	const host = `${components}/explorer-ui/HarnessConsole.svelte`;
	// With type-only imports counted too: a renderer named for its props would still be an edge.
	expect(mounts(host, false)).toEqual(['ExplorerLayout', 'LoadingState']);
	expect(mounts(`${components}/explorer-ui/ExplorerLayout.svelte`, false)).toEqual([
		'HarnessHeader'
	]);
	expect(mounts(`${components}/HarnessScreen.svelte`, false)).toEqual(['HarnessConsole']);
	expect(mounts(`${workspaceRoot}/src/models/ExplorerScreen.types.ts`, false)).toEqual([]);
	expect(drawn(`${components}/HarnessScreen.svelte`)).not.toContain('ExplorerContent');
});

test('the renderer of any screen is named only where the screen is not known', () => {
	const generic = [...new Set([...files].map(entry))].filter(
		(path) => isComponent(path) && mounts(path, false).includes('ExplorerContent')
	);
	expect(generic.sort()).toEqual([
		entry(`${components}/explorer-ui/HarnessShell.svelte`),
		`${routes}/[...view]/+page.svelte`
	]);
});

test('every page mounts the host with one screen of its own, and none draws every screen', () => {
	for (const category of explorerCategories) {
		for (const [screen, view] of Object.entries(screensFor(category))) {
			const mounted = mounts(page(category, view), false);
			if (screen !== 'catalog') {
				const singular =
					category === 'apis' ? 'API' : category[0].toUpperCase() + category.slice(1, -1);
				const suffix = screen === 'overview' ? '' : ` ${screen}`;
				expect(
					readFileSync(join(repo, page(category, view)), 'utf8'),
					`Canonical route title: ${category} ${screen}`
				).toContain(`title="${singular}${suffix}"`);
			}
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

test('the canonical screens of a category are made of different components', () => {
	for (const category of explorerCategories) {
		const made = Object.values(screensFor(category)).map((view) =>
			drawn(page(category, view)).join()
		);
		expect([category, new Set(made).size]).toEqual([
			category,
			Object.keys(screensFor(category)).length
		]);
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
		for (const [screen, view] of Object.entries(screensFor(category)).slice(1)) {
			const has = Object.values(own).filter((name) => drawn(page(category, view)).includes(name));
			expect([category, screen, has]).toEqual([
				category,
				screen,
				[own[screen as keyof typeof own]]
			]);
		}
	}
});

// Attribution-only display:contents wrappers cannot alter screen equivalence.
test('screen normalization keeps semantic content, attributes and ordinary containers', () => {
	const body = '<section aria-label="Panel"><a href="/kept">Keep</a></section>';
	const wrapped =
		'<div class="ex-shown svelte-proof" data-harness-component="panel">' + body + '</div>';
	expect(visibleMarkup(wrapped)).toBe(visibleMarkup(body));
	for (const changed of [
		body.replace('Keep', 'Changed'),
		body.replace('/kept', '/other'),
		body.replace('Panel', 'Other')
	])
		expect(visibleMarkup(wrapped)).not.toBe(visibleMarkup(changed));
	expect(visibleMarkup('<div>' + body + '</div>')).not.toBe(visibleMarkup(body));
	expect(
		visibleMarkup(
			wrapped.replace('data-harness-component', 'aria-label="Distinct" data-harness-component')
		)
	).not.toBe(visibleMarkup(body));
});
