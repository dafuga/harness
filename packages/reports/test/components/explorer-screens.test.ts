import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const home = 'src/components/harness';
const routes = 'src/routes/harness/branch/[branch]/[...at]';
const categories = ['pages', 'components', 'functions', 'configs', 'services'];
const entries = {
	cards: 'ExplorerPagesScreen',
	table: 'ExplorerCatalogScreen',
	visual: 'EntityVisualScreen',
	behavior: 'EntityBehaviorScreen',
	config: 'EntityConfigScreen',
	details: 'EntityDetailsScreen',
	history: 'EntityHistoryScreen'
};
const overview: Record<string, string> = {
	pages: entries.visual,
	components: entries.visual,
	functions: entries.behavior,
	services: entries.behavior,
	configs: entries.config
};
/** The entry each of the twenty route pages mounts, by the folder of its page. */
const mounted = Object.fromEntries(
	categories.flatMap((category) => [
		[category, category === 'pages' ? entries.cards : entries.table],
		[`${category}/[entity]`, overview[category]],
		[`${category}/[entity]/details`, entries.details],
		[`${category}/[entity]/history`, entries.history]
	])
);
/** The components a file imports, by name. */
const imported = (file: string): string[] =>
	[...readFileSync(file, 'utf8').matchAll(/from '[^']*\/(\w+)\.svelte'/g)].map((found) => found[1]);
const files = readdirSync(home, { recursive: true }).filter((file) => file.endsWith('.svelte'));
const own = (name: string) =>
	join(home, files.find((file) => file.split('/').at(-1) === `${name}.svelte`) ?? `${name}.svelte`);
const direct = (name: string) => imported(own(name));

/** Every component of the explorer that one reaches through what it imports. */
function reached(name: string, seen = new Set<string>()): Set<string> {
	for (const next of direct(name).filter((found) => existsSync(own(found)) && !seen.has(found))) {
		seen.add(next);
		reached(next, seen);
	}
	return seen;
}
const has = (name: string, wanted: string[]) => wanted.filter((found) => reached(name).has(found));

test('each of the twenty pages mounts the one entry of its screen, and nothing else', () => {
	expect(Object.keys(mounted)).toHaveLength(20);
	for (const [folder, entry] of Object.entries(mounted)) {
		const file = join(routes, folder, '+page.svelte');
		expect(imported(file).sort(), folder).toEqual([entry, 'HarnessScreen'].sort());
		expect(readFileSync(file, 'utf8'), folder).toContain(`content={${entry}}`);
	}
});

test('no entry reaches the content that shows every screen, or the host that mounts it', () => {
	for (const entry of Object.values(entries)) {
		expect(has(entry, ['ExplorerContent', 'HarnessConsole', 'HarnessShell']), entry).toEqual([]);
	}
});

test('collections reuse visual cards and tables without loading entity detail panes', () => {
	expect(has(entries.cards, ['ExplorerPageCard', 'ExplorerTable'])).toEqual(['ExplorerPageCard']);
	expect(has(entries.table, ['ExplorerPageCard', 'ExplorerTable'])).toEqual([
		'ExplorerPageCard',
		'ExplorerTable'
	]);
	for (const entry of [entries.cards, entries.table]) {
		expect(has(entry, ['ExplorerControls', 'EntityMissing']), entry).toHaveLength(2);
		expect(has(entry, ['EntityHeader', 'EntityScreens', 'EntityHistory']), entry).toEqual([]);
	}
});

test('an overview names the evidence of its kind itself, and no pane of another kind', () => {
	const panes = ['EntityScreens', 'EntityBehavior', 'EntityConfig', 'EntityAudio'];
	const named = (entry: string) =>
		direct(entry)
			.filter((found) => panes.includes(found))
			.sort();
	expect(named(entries.visual)).toEqual(['EntityAudio', 'EntityScreens']);
	expect(named(entries.behavior)).toEqual(['EntityAudio', 'EntityBehavior']);
	expect(named(entries.config)).toEqual(['EntityConfig']);
	// The shared frame reaches component captures; each overview still owns only its kind of evidence.
	expect(has(entries.config, ['EntityAudio'])).toEqual([]);
	expect(has(entries.behavior, ['EntityConfig'])).toEqual([]);
	expect(has(entries.visual, ['EntityConfig'])).toEqual([]);
	for (const entry of [entries.visual, entries.behavior, entries.config]) {
		const tabs = [
			'EntityHeader',
			'EntityMissing',
			'EntityRelations',
			'EntitySummary',
			'EntityTests',
			'EntitySource'
		];
		expect(has(entry, tabs), entry).toHaveLength(6);
		expect(has(entry, ['EntityHistory', 'ExplorerTable']), entry).toEqual([]);
	}
});

test('details and history share component captures while keeping their own screen content', () => {
	const evidence = ['EntityBehavior', 'EntityTests', 'EntityRelations'];
	expect(has(entries.details, ['EntitySummary', 'EntityMeasures', 'EntitySource'])).toHaveLength(3);
	expect(has(entries.details, [...evidence, 'EntityHistory'])).toEqual([]);
	const rows = ['EntityHistory', 'EntityHistoryRow', 'EntityChange', 'EntityReasons'];
	expect(has(entries.history, rows)).toHaveLength(4);
	expect(has(entries.history, [...evidence, 'EntitySource', 'EntityMeasures'])).toEqual([]);
	for (const entry of [entries.details, entries.history]) {
		expect(has(entry, ['EntityHeader', 'EntityMissing', 'EntityScreens']), entry).toHaveLength(3);
	}
});

test('the content that shows any address holds no screen of its own: it mounts the entries', () => {
	expect(direct('ExplorerContent').sort()).toEqual(Object.values(entries).sort());
});
