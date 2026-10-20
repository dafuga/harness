import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { scanImports } from '../src/services/source-index-service/scanImports';
import { loadUnits, type LoadedUnits } from '../src/workflows/loadUnits';

/**
 * THE HUB IMPORTS DESKTOP SOURCE THROUGH ITS BUILD ALIAS. Each such import has to be an edge of
 * the graph, or a change of that desktop file selects none of the hub's units and tests. This
 * reads this very repository through the index, the graph and the impact analysis: all that is
 * simulated is the content hash of the one file said to have changed.
 */
const hub = 'packages/hub/src/';
const alias = '$desktop';
const indexer = new SourceIndexService();
const analysis = new ImpactService(new HandlerRuntimeAdapter(impactKernel));
const reports = new Map<string, Promise<ImpactReport>>();
let loaded: LoadedUnits;
let written: Array<{ from: string; specifier: string; to: string | undefined }>;
beforeAll(async () => {
	loaded = await loadUnits(process.cwd(), undefined, indexer);
	written = [...loaded.index.files.keys()].filter((path) => path.startsWith(hub)).flatMap(imports);
}, 60_000);

/** The tracked file the hub's own build sends an alias import to, by its Svelte configuration. */
function built(specifier: string): string | undefined {
	const config = readFileSync('packages/hub/svelte.config.js', 'utf8');
	const target = /\$desktop: '([^']+)'/.exec(config)?.[1] ?? 'no alias';
	const path = join('packages/hub', target, specifier.slice(alias.length + 1));
	return [path, `${path}.ts`].find((candidate) => loaded.index.files.has(candidate));
}
/** The alias imports one hub file really writes, each with where the build sends it. */
function imports(from: string) {
	const language = /\.(svelte|css|ts)$/.exec(from)?.[1] as 'svelte' | 'css' | 'ts' | undefined;
	const found = language ? scanImports(readFileSync(from, 'utf8'), language) : [];
	const specifiers = found.flatMap((item) => item.specifier ?? []);
	return specifiers
		.filter((specifier) => specifier.startsWith(`${alias}/`))
		.map((specifier) => ({ from, specifier, to: built(specifier) }));
}
/** One tree as the impact analysis reads it, with the registry as it is stored. */
function side(index: SourceIndex): ImpactSide {
	return {
		revision: 'working-tree',
		config: loaded.config,
		entries: [...index.files.values()].map(({ path, hash }) => ({ path, hash })),
		manifests: loaded.stored,
		scenarios: loaded.scenarios,
		graph: new SourceGraphService().build(index, loaded.stored, loaded.scenarios)
	};
}
/** What the analysis reports when only this file's content differs from the tree as it is. */
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

test('every import the hub writes through its build alias resolves to the desktop file that build loads', () => {
	const resolved = (from: string, to: string | undefined) =>
		loaded.index.files.get(from)?.references.some((item) => item.path === to && to !== undefined);
	const lost = written.filter((item) => !resolved(item.from, item.to));
	expect(lost.map((item) => `${item.from} ${item.specifier}`)).toEqual([]);
	const files = [...loaded.index.files.values()].filter((file) => file.path.startsWith(hub));
	const outside = files.filter((file) => file.references.some((item) => item.external === alias));
	expect(outside.map((file) => file.path)).toEqual([]);
	expect(written.length).toBeGreaterThan(0);
});

test('the registry stores each of those imports as a derived dependency, and is not stale', () => {
	const linked = (from: string, to: string | undefined) =>
		loaded.stored
			.find((unit) => unit.id === owner(from))
			?.dependencies.some((item) => item.unit === owner(to) && item.origin === 'derived');
	const apart = written.filter((item) => owner(item.from) !== owner(item.to));
	const absent = apart.filter((item) => !linked(item.from, item.to));
	expect(absent.map((item) => `${owner(item.from)} -> ${owner(item.to)}`)).toEqual([]);
	expect(loaded.fresh.updated).toEqual([]);
});

/**
 * What a change of an importing file reaches. A file no test covers selects every test when it
 * changes, which says nothing of its reach: of such a file only its own unit is asked for.
 */
function follows(importer: ImpactReport, from: string) {
	if (importer.expanded) return { units: [owner(from) ?? 'no owner'], tests: [] };
	return {
		units: [...importer.units.direct, ...importer.units.indirect],
		tests: importer.tests.selected
	};
}

test('a change of a desktop file reaches every unit and test that a change of its hub importer reaches', async () => {
	const omitted: string[] = [];
	for (const item of written) {
		const [target, importer] = [await changed(item.to ?? ''), await changed(item.from)];
		const reached = new Set([...target.units.direct, ...target.units.indirect]);
		const due = follows(importer, item.from);
		const units = due.units.filter((unit) => !reached.has(unit));
		const tests = due.tests.filter((path) => !target.tests.selected.includes(path));
		if (units.length + tests.length > 0)
			omitted.push(`${item.to}: ${units.length} units, ${tests.length} tests of ${item.from}`);
	}
	expect(omitted).toEqual([]);
}, 60_000);

test('a change of hostedArtifact selects the hub page and its four hub tests, and stays selective', async () => {
	const unit = loaded.stored.find((item) => item.id === 'desktop.function.hosted-artifact')!;
	const implementation = unit.owns.source.find((path) =>
		loaded.index.files
			.get(path)
			?.exports.some((item) => item.kind === 'function' && item.name === 'hostedArtifact')
	);
	expect(implementation).toBeDefined();
	const report = await changed(implementation!);
	const units = ['browser-artifact', 'browser-bridge', 'browser-evidence-reads'];
	const named = ['hub.component.hosted-workspace', 'hub.page.projects-project-id-harness-path'];
	expect(report.units.indirect).toEqual(
		expect.arrayContaining([...units.map((name) => `hub.function.${name}`), ...named])
	);
	const tests = ['browser-artifact', 'browser-bridge-evidence', 'browser-bridge-history'];
	expect(report.tests.selected).toEqual(
		expect.arrayContaining(
			[...tests, 'browser-bridge'].map((name) => `packages/hub/test/utils/${name}.test.ts`)
		)
	);
	expect([report.expanded, report.tests.excluded.length > 0]).toEqual([false, true]);
}, 60_000);

test('declaring them moves those references alone: packages, other aliases and uncertainties stay', async () => {
	const kept = loaded.config.references.filter(
		(entry) => !(entry.from.startsWith(hub) && entry.specifier.startsWith(`${alias}/`))
	);
	const tree = new WorkingTreeAdapter(loaded.root);
	const bare = await indexer.index(tree, { ...loaded.config, references: kept });
	const moved = [...loaded.index.files.values()].flatMap((file) =>
		file.references.flatMap((now, at) => {
			const was = bare.files.get(file.path)?.references[at];
			return JSON.stringify(now) === JSON.stringify(was)
				? []
				: [[file.path, was?.external, now.path]];
		})
	);
	expect(moved.filter(([from, was]) => !from?.startsWith(hub) || was !== alias)).toEqual([]);
	expect(moved.map(([, , to]) => to).sort()).toEqual(written.map((item) => item.to).sort());
	expect(side(loaded.index).graph.uncertain).toEqual(side(bare).graph.uncertain);
}, 60_000);
