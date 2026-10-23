import type { Written } from './shared-select-impact.test.types';
import * as sourceIndex from '../src/services/source-index-service/SourceIndexService';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { beforeAll, expect, test } from 'vitest';
import { HandlerRuntimeAdapter } from '../src/adapters/HandlerRuntimeAdapter';
import { WorkingTreeAdapter } from '../src/adapters/WorkingTreeAdapter';
import type { ImpactReport, ImpactSide } from '../src/core/impactTypes';
import { ImpactService } from '../src/services/impact-service/ImpactService';
import { SourceGraphService } from '../src/services/SourceGraphService';
import { impactKernel } from '../src/utils/impact-kernel/impactKernel';
import { scanImports } from '../src/services/source-index-service/scanImports';
import { loadUnits, type LoadedUnits } from '../src/workflows/loadUnits';
const select = 'packages/reports/src/components/Select.svelte';
const shared = '$shared';
const selectTest = 'packages/reports/test/components/select.test.ts';
const indexer = new sourceIndex.SourceIndexService();
const analysis = new ImpactService(new HandlerRuntimeAdapter(impactKernel));
const reports = new Map<string, Promise<ImpactReport>>();
let loaded: LoadedUnits;
let builds: Record<string, Record<string, string>>;
let written: Written[];
beforeAll(async () => {
	loaded = await loadUnits(process.cwd(), undefined, indexer);
	builds = Object.fromEntries(readdirSync('packages').map((name) => [name, aliases(name)]));
	written = [...loaded.index.files.keys()].flatMap(imports);
}, 60_000);
function aliases(name: string): Record<string, string> {
	const file = join('packages', name, 'svelte.config.js');
	const stated = existsSync(file) ? /alias:\s*\{([^}]*)\}/.exec(readFileSync(file, 'utf8')) : null;
	const pairs = [...(stated?.[1] ?? '').matchAll(/(\$\w+):\s*'([^']+)'/g)];
	return Object.fromEntries(pairs.map(([, alias, target]) => [alias, target]));
}
function imports(from: string): Written[] {
	const [, name = ''] = /^packages\/([^/]+)\//.exec(from) ?? [];
	const language = /\.(svelte|css|ts)$/.exec(from)?.[1] as 'svelte' | 'css' | 'ts' | undefined;
	const own = Object.entries(builds[name] ?? {});
	if (!language || own.length === 0) return [];
	const found = scanImports(readFileSync(from, 'utf8'), language);
	return found.flatMap((item) => {
		const [alias, target] = own.find(([key]) => item.specifier?.startsWith(`${key}/`)) ?? [];
		if (!item.specifier) return [];
		if (!alias || !target) {
			const to = join(dirname(from), item.specifier);
			return to === select ? [{ from, specifier: item.specifier, to }] : [];
		}
		const path = join('packages', name, target, item.specifier.slice(alias.length + 1));
		const to = [path, `${path}.ts`].find((candidate) => loaded.index.files.has(candidate));
		return [{ from, specifier: item.specifier, to }];
	});
}
function side(index: sourceIndex.SourceIndex): ImpactSide {
	return {
		revision: 'working-tree',
		config: loaded.config,
		entries: [...index.files.values()].map(({ path, hash }) => ({ path, hash })),
		manifests: loaded.stored,
		scenarios: loaded.scenarios,
		graph: new SourceGraphService().build(index, loaded.stored, loaded.scenarios)
	};
}
function changed(path: string): Promise<ImpactReport> {
	const head = side(loaded.index);
	const entries = head.entries.map((entry) =>
		entry.path === path ? { ...entry, hash: '0'.repeat(40) } : entry
	);
	const report =
		reports.get(path) ?? analysis.compute({ ...head, revision: 'before', entries }, head);
	reports.set(path, report);
	return report;
}
const owner = (path: string | undefined) =>
	loaded.stored.find((unit) => unit.status === 'active' && unit.owns.source.includes(path ?? ''))
		?.id;
const consumers = () =>
	written.filter(
		(item) => item.to === select && loaded.index.files.get(item.from)?.classification !== 'test'
	);
test('no import written through a build alias of any package is left as a package from outside', () => {
	const declared = Object.fromEntries(
		Object.entries(builds).filter(([, own]) => Object.keys(own).length)
	);
	expect(declared).toEqual({
		desktop: { $desktop: './src', $shared: '../reports/src/components' },
		hub: { $desktop: '../desktop/src', $shared: '../reports/src/components' },
		reports: { $desktop: '../desktop/src', $shared: './src/components' }
	});
	const resolved = (item: Written) =>
		loaded.index.files
			.get(item.from)
			?.references.some((found) => found.path === item.to && item.to);
	expect(
		written.filter((item) => !resolved(item)).map((item) => `${item.from} ${item.specifier}`)
	).toEqual([]);
	const names = new Set(Object.values(builds).flatMap((own) => Object.keys(own)));
	const outside = [...loaded.index.files.values()].filter((file) =>
		file.references.some((item) => names.has(item.external ?? ''))
	);
	expect(outside.map((file) => file.path)).toEqual([]);
});
test('the registry stores Select as a derived dependency of each of its consumers, and is not stale', () => {
	expect(loaded.index.files.get(selectTest)?.classification).toBe('test');
	expect(
		written
			.filter((item) => item.to === select && !consumers().includes(item))
			.map((item) => item.from)
	).toEqual([selectTest]);
	const units = consumers().map((item) => owner(item.from));
	expect(units.sort()).toEqual([
		...[
			'agent-controls',
			'agent-settings',
			'catalog-view',
			'design-panel',
			'environment-picker',
			'game-checkpoint-editor',
			'game-create',
			'game-level-brief',
			'game-preview',
			'game-view-fields'
		].map((name) => `desktop.component.${name}`),
		...['project-switcher', 'remote-approval', 'revision-picker', 'runtime-screens'].map(
			(name) => `desktop.component.${name}`
		),
		...['invitation-form', 'project-create'].map((name) => `hub.component.${name}`)
	]);
	const linked = (id: string | undefined) =>
		loaded.stored
			.find((unit) => unit.id === id)
			?.dependencies.some((item) => item.unit === owner(select) && item.origin === 'derived');
	expect(units.filter((id) => !linked(id))).toEqual([]);
	expect(loaded.fresh.updated).toEqual([]);
});
test('a change of Select reaches its consumers, the pages that show them, and their tests and scenarios', async () => {
	const report = await changed(select);
	expect(report.units.direct).toEqual(['reports.component.select']);
	expect(report.units.indirect).toEqual(
		expect.arrayContaining(consumers().map((item) => owner(item.from)))
	);
	const shown = [
		'desktop.page.root',
		'desktop.page.settings',
		'hub.page.projects-project-id-harness-path',
		'hub.page.root'
	];
	const between = ['desktop.component.runtime-evidence', 'hub.component.members-panel'];
	expect(report.units.indirect).toEqual(
		expect.arrayContaining([...shown, 'hub.page.projects-project-id-members', ...between])
	);
	const own = ['test/components/select.test.ts', 'tests/e2e/shared-select-reports.spec.ts'];
	const theirs = ['runtime-screens', 'runtime-evidence'].map(
		(name) => `desktop/test/components/${name}.test.ts`
	);
	expect(report.tests.selected).toEqual(
		expect.arrayContaining(
			[...own.map((path) => `reports/${path}`), ...theirs].map((path) => `packages/${path}`)
		)
	);
	const scenarios = [
		'agent-settings',
		'desktop-native',
		'desktop-renderer',
		'remote-mobile-ui',
		'runtime-evidence-ui'
	];
	expect(report.scenarios.affected).toEqual(
		expect.arrayContaining([...scenarios, 'explorer-shell', 'harness-console'])
	);
	expect([report.expanded, report.tests.excluded.length > 0]).toEqual([false, true]);
}, 60_000);
test('a change of Select reaches every unit, test and scenario that a change of a consumer reaches', async () => {
	const target = await changed(select);
	const reached = new Set([...target.units.direct, ...target.units.indirect]);
	const omitted: string[] = [];
	for (const item of consumers()) {
		const importer = await changed(item.from);
		const units = importer.expanded
			? [owner(item.from) ?? 'no owner']
			: [...importer.units.direct, ...importer.units.indirect];
		const due = importer.expanded
			? []
			: [...importer.tests.selected, ...importer.scenarios.affected];
		const got = [...target.tests.selected, ...target.scenarios.affected];
		const lost = [
			...units.filter((unit) => !reached.has(unit)),
			...due.filter((name) => !got.includes(name))
		];
		if (lost.length > 0) omitted.push(`${item.from}: ${lost.length} not reached, first ${lost[0]}`);
	}
	expect(omitted).toEqual([]);
}, 60_000);
test('declaring the Select imports moves those references alone: packages and uncertainties stay', async () => {
	const kept = loaded.config.references.filter(
		(entry) => entry.specifier !== `${shared}/Select.svelte`
	);
	const bare = await indexer.index(new WorkingTreeAdapter(loaded.root), {
		...loaded.config,
		references: kept
	});
	const moved = [...loaded.index.files.values()].flatMap((file) =>
		file.references.flatMap((now, at) => {
			const was = bare.files.get(file.path)?.references[at];
			return JSON.stringify(now) === JSON.stringify(was)
				? []
				: [[file.path, was?.external, now.path]];
		})
	);
	expect(moved.filter(([, was, to]) => was !== shared || to !== select)).toEqual([]);
	expect(moved.map(([from]) => from).sort()).toEqual(
		consumers()
			.filter((item) => item.specifier.startsWith(`${shared}/`))
			.map((item) => item.from)
			.sort()
	);
	expect(side(loaded.index).graph.uncertain).toEqual(side(bare).graph.uncertain);
}, 60_000);
