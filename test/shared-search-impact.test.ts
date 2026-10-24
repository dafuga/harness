import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { beforeAll, expect, test } from 'vitest';
import { HandlerRuntimeAdapter } from '../src/adapters/HandlerRuntimeAdapter';
import { WorkingTreeAdapter } from '../src/adapters/WorkingTreeAdapter';
import type { ImpactReport, ImpactSide } from '../src/core/impactTypes';
import { ImpactService } from '../src/services/impact-service/ImpactService';
import { SourceGraphService } from '../src/services/SourceGraphService';
import {
	SourceIndexService,
	type SourceIndex
} from '../src/services/source-index-service/SourceIndexService';
import { impactKernel } from '../src/utils/impact-kernel/impactKernel';
import { loadUnits, type LoadedUnits } from '../src/workflows/loadUnits';

/**
 * THE SHARED SEARCH OF THE TOP BAR. The desktop's top bar renders the entity search of the reports
 * package through the build alias $shared, which harness.units.json declares import by import. This
 * reads this very repository through the index: with the declaration the bar depends on the search
 * and a change of the search reaches the shared workspace; without it the import is a package.
 */
const sourceOf = (id: string): string =>
	JSON.parse(readFileSync(`specification/units/${id}.json`, 'utf8')).runtime.entry;
const search = sourceOf('reports.component.entity-search');
const bar = sourceOf('desktop.component.nav-bar');
const specifier = '$shared/' + posix.relative('packages/reports/src/components', search);
const indexer = new SourceIndexService();
const analysis = new ImpactService(new HandlerRuntimeAdapter(impactKernel));
let loaded: LoadedUnits;
let bare: SourceIndex;
beforeAll(async () => {
	loaded = await loadUnits(process.cwd(), undefined, indexer);
	const kept = loaded.config.references.filter(
		(entry) => entry.from !== bar || entry.specifier !== specifier
	);
	bare = await indexer.index(new WorkingTreeAdapter(loaded.root), {
		...loaded.config,
		references: kept
	});
}, 60_000);

/** One tree as the impact analysis reads it, with the registry as it is stored. */
function side(index: SourceIndex, requests = true): ImpactSide {
	const manifests = requests
		? loaded.stored
		: loaded.stored.map((unit) => ({
				...unit,
				dependencies: unit.dependencies.filter((dependency) => dependency.via !== 'http')
			}));
	return {
		revision: 'working-tree',
		config: loaded.config,
		entries: [...index.files.values()].map(({ path, hash }) => ({ path, hash })),
		manifests,
		scenarios: loaded.scenarios,
		graph: new SourceGraphService().build(index, manifests, loaded.scenarios)
	};
}
/** What the analysis reports when only the search's content differs from the tree indexed so. */
function changed(index: SourceIndex, requests = true): Promise<ImpactReport> {
	const head = side(index, requests);
	const entries = head.entries.map((entry) =>
		entry.path === search ? { ...entry, hash: '0'.repeat(40) } : entry
	);
	return analysis.compute({ ...head, revision: 'before', entries }, head);
}
const reached = (report: ImpactReport) => [...report.units.direct, ...report.units.indirect];

test('the top bar imports the search as declared, and the registry stores it as derived and fresh', () => {
	const declared = loaded.config.references.filter((entry) => entry.from === bar);
	expect(declared.map((entry) => [entry.specifier, entry.to])).toEqual([
		[specifier, search],
		['$shared/BrandMark.svelte', 'packages/reports/src/components/BrandMark.svelte']
	]);
	const written = loaded.index.files.get(bar)?.references ?? [];
	expect(written.filter((item) => item.path === search)).toHaveLength(1);
	expect(written.filter((item) => item.external === '$shared')).toEqual([]);
	const stored = loaded.stored.find((unit) => unit.id === 'desktop.component.nav-bar');
	expect(stored?.dependencies).toContainEqual({
		unit: 'reports.component.entity-search',
		via: 'import',
		origin: 'derived'
	});
	expect(loaded.fresh.updated).toEqual([]);
});

test('a change of the search reaches the top bar, the shared workspace pages, their tests and scenarios', async () => {
	const report = await changed(loaded.index);
	expect(report.units.direct).toEqual(['reports.component.entity-search']);
	const pages = ['desktop.page.root', 'desktop.page.projects-project-id-harness-path'];
	const hosted = 'hub.page.projects-project-id-harness-path';
	const explorer = ['harness-navbar', 'harness-header', 'harness-console'].map(
		(name) => `reports.component.harness-${name}`
	);
	expect(report.units.indirect).toEqual(
		expect.arrayContaining(['desktop.component.nav-bar', ...pages, hosted, ...explorer])
	);
	expect(report.tests.selected).toEqual(
		expect.arrayContaining([
			'packages/desktop/test/nav-bar-search.test.ts',
			'packages/reports/test/components/entity-search.test.ts',
			'packages/reports/test/harness-navbar-search.test.ts'
		])
	);
	const scenarios = ['search-shared-app', 'desktop-renderer', 'desktop-native'];
	expect(report.scenarios.affected).toEqual(
		expect.arrayContaining([...scenarios, 'harness-console', 'explorer-shell'])
	);
	expect([report.expanded, report.tests.excluded.length > 0]).toEqual([false, true]);
}, 60_000);

test('without its declaration the import is a package from outside, and the bar is not reached', async () => {
	const moved = [...loaded.index.files.values()].flatMap((file) =>
		file.references.flatMap((now, at) => {
			const was = bare.files.get(file.path)?.references[at];
			return JSON.stringify(now) === JSON.stringify(was)
				? []
				: [[file.path, was?.external, now.path]];
		})
	);
	expect(moved).toEqual([[bar, '$shared', search]]);
	expect(side(loaded.index).graph.uncertain).toEqual(side(bare).graph.uncertain);
	const declared = reached(await changed(loaded.index));
	const undeclared = reached(await changed(bare));
	expect([
		declared.includes('desktop.component.nav-bar'),
		undeclared.includes('desktop.component.nav-bar')
	]).toEqual([true, false]);
	// Computed HTTP calls conservatively select their callers. Isolate module imports to retain
	// the original negative proof rather than discarding it when new request facts are indexed.
	const withoutRequests = (index: SourceIndex): SourceIndex => ({
		...index,
		files: new Map(
			[...index.files].map(([path, file]) => [
				path,
				{
					...file,
					references: file.references.filter((reference) => reference.via !== 'http')
				}
			])
		)
	});
	const imports = reached(await changed(withoutRequests(loaded.index), false));
	const missing = reached(await changed(withoutRequests(bare), false));
	const lost = ['desktop.component.nav-bar', 'desktop.page.root'];
	expect(lost.map((unit) => [imports.includes(unit), missing.includes(unit)])).toEqual([
		[true, false],
		[true, false]
	]);
}, 60_000);
