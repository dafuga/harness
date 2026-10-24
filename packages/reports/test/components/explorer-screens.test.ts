import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const home: string = JSON.parse(
	readFileSync('../../specification/units/reports.component.harness-explorer-content.json', 'utf8')
)
	.runtime.entry.replace('packages/reports/', '')
	.replace(/\/[^/]+$/, '');
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
const files = readdirSync(home, { recursive: true, encoding: 'utf8' }).filter((file) =>
	file.endsWith('.svelte')
);
const registered = readdirSync('../../specification/units').flatMap(
	(file): Array<[string, string]> => {
		const entry = JSON.parse(readFileSync(join('../../specification/units', file), 'utf8')).runtime
			.entry as string;
		return entry.startsWith('packages/reports/') && entry.endsWith('.svelte')
			? [[entry.split('/').at(-1)!.replace('.svelte', ''), entry.replace('packages/reports/', '')]]
			: [];
	}
);
const implementations = new Map(registered);
const own = (name: string) =>
	implementations.get(name) ??
	(files.some((file) => file.split('/').at(-1) === `${name}.svelte`)
		? join(home, files.find((file) => file.split('/').at(-1) === `${name}.svelte`)!)
		: join('src/components', `${name}.svelte`));
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

test('project dependencies have their own scoped page entry', () => {
	const file = join(routes, 'dependencies/+page.svelte');
	expect(imported(file).sort()).toEqual(['ExplorerDependenciesScreen', 'HarnessScreen']);
	expect(readFileSync(file, 'utf8')).toContain('content={ExplorerDependenciesScreen}');
});

test('no entry reaches the content that shows every screen, or the host that mounts it', () => {
	for (const entry of Object.values(entries)) {
		expect(has(entry, ['ExplorerContent', 'HarnessConsole', 'HarnessShell']), entry).toEqual([]);
	}
	const panes = direct('ExplorerFrame').filter(
		(name) => name.startsWith('Entity') && name !== 'EntityMissing'
	);
	expect(panes, 'shared frames must not import entity-specific panes').toEqual([]);
});

test('collections reuse visual cards and tables without loading entity detail panes', () => {
	for (const entry of [entries.cards, entries.table, 'EntityRelations'])
		expect(has(entry, ['ExplorerCatalogItems']), 'collections share one item renderer').toEqual([
			'ExplorerCatalogItems'
		]);
	expect(has(entries.cards, ['ExplorerModuleCard', 'ExplorerTable'])).toEqual([
		'ExplorerModuleCard',
		'ExplorerTable'
	]);
	expect(has(entries.table, ['ExplorerModuleCard', 'ExplorerTable'])).toEqual([
		'ExplorerModuleCard',
		'ExplorerTable'
	]);
	for (const entry of [entries.cards, entries.table]) {
		expect(has(entry, ['ExplorerControls', 'EntityMissing']), entry).toHaveLength(2);
		expect(has(entry, ['EntityHeader', 'EntityScreens', 'EntityHistory']), entry).toEqual([]);
	}
});

test('an overview names its evidence; audio stays in the shared component-tab navigation', () => {
	const panes = ['EntityScreens', 'EntityBehavior', 'EntityConfig', 'EntityAudio'];
	const named = (entry: string) =>
		direct(entry)
			.filter((found) => panes.includes(found))
			.sort();
	expect(named(entries.visual)).toEqual(['EntityAudio', 'EntityScreens']);
	expect(named(entries.behavior)).toEqual(['EntityAudio', 'EntityBehavior']);
	expect(named(entries.config)).toEqual(['EntityConfig']);
	// Shared sections provide the optional Audio tab, while route checks keep it component-only.
	expect(has(entries.config, ['EntityAudio'])).toEqual(['EntityAudio']);
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
		expect(has(entry, ['EntityHistory']), entry).toEqual([]);
		expect(
			has(entry, ['ExplorerCatalogItems', 'ExplorerModuleCard', 'ExplorerTable']),
			entry
		).toHaveLength(3);
	}
});

test('the entity header contract omits the removed Shared badge input', () => {
	const contract = JSON.parse(
		readFileSync('../../specification/units/reports.component.harness-entity-header.json', 'utf8')
	).contract;
	expect(contract.inputs.map(({ name }: { name: string }) => name)).not.toContain(
		'EntityHeader.shared'
	);
	expect(JSON.stringify(contract)).not.toContain('Shared badge');
});

test('details and history share component captures while keeping their own screen content', () => {
	const evidence = ['EntityBehavior', 'EntityTests', 'EntityRelations'];
	expect(has(entries.details, ['EntitySummary', 'EntityMeasures', 'EntitySource'])).toHaveLength(3);
	expect(has(entries.details, [...evidence, 'EntityHistory'])).toEqual([]);
	const rows = ['EntityHistory', 'EntityHistoryRow', 'EntityReasons'];
	expect(has(entries.history, rows)).toEqual(rows);
	expect(has(entries.history, ['EntityChange'])).toEqual([]);
	expect(has(entries.history, [...evidence, 'EntitySource', 'EntityMeasures'])).toEqual([]);
	for (const entry of [entries.details, entries.history]) {
		expect(has(entry, ['EntityHeader', 'EntityMissing', 'EntityScreens']), entry).toHaveLength(3);
	}
});

test('the content that shows any address holds no screen of its own: it mounts the entries', () => {
	expect(direct('ExplorerContent').sort()).toEqual(
		[...Object.values(entries), 'ExplorerPlatforms', 'ExplorerTranslationsScreen'].sort()
	);
});
