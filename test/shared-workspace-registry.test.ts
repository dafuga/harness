import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, expect, test } from 'vitest';
import { HandlerRuntimeAdapter } from '../src/adapters/HandlerRuntimeAdapter';
import { WorkingTreeAdapter } from '../src/adapters/WorkingTreeAdapter';
import type { ImpactSide } from '../src/core/impactTypes';
import { ImpactService } from '../src/services/impact-service/ImpactService';
import { SourceGraphService } from '../src/services/SourceGraphService';
import {
	SourceIndexService,
	type SourceIndex
} from '../src/services/source-index-service/SourceIndexService';
import { impactKernel } from '../src/utils/impact-kernel/impactKernel';
import { scanImports } from '../src/services/source-index-service/scanImports';
import { showUnit } from '../src/workflows/inspectUnits';
import { loadUnits, type LoadedUnits } from '../src/workflows/loadUnits';

/**
 * ONE WORKSPACE, SEVERAL APPS. The hosted Web workspace and the Electron and iOS workspace show
 * the same shell over the same store and routes. This reads the registry of this very repository
 * as its own commands do and holds it to what the sources import: nothing here is a fixture.
 */
const web = 'hub.component.hosted-workspace';
const page = 'hub.page.projects-project-id-harness-path';
const sourceOf = (id: string): string =>
	JSON.parse(readFileSync(`specification/units/${id}.json`, 'utf8')).runtime.entry;
const hosted = sourceOf(web);
/** What the Web workspace imports of the shared workspace, by the unit that owns each file. */
const shared: Record<string, string> = {
	'desktop.component.workspace-shell': sourceOf('desktop.component.workspace-shell'),
	'desktop.function.cache-status': sourceOf('desktop.function.cache-status'),
	'desktop.function.workspace-route': sourceOf('desktop.function.workspace-route'),
	'desktop.service.project-sync': sourceOf('desktop.service.project-sync'),
	'desktop.store.workspace': sourceOf('desktop.store.workspace')
};
const indexer = new SourceIndexService();
let loaded: LoadedUnits;
beforeAll(async () => {
	loaded = await loadUnits(process.cwd(), undefined, indexer);
}, 60_000);

test('cataloged application configs keep their implementation and entries under configs', () => {
	const configs = loaded.stored.filter(
		(unit) => unit.status === 'active' && unit.kind === 'config'
	);
	expect(configs.length).toBeGreaterThan(0);
	for (const unit of configs)
		for (const source of unit.owns.source)
			expect(source, `${unit.id} config source`).toMatch(/(?:^|\/)src\/configs\//);
});

/** The alias imports the Web workspace really writes, as its source states them. */
function written(): string[] {
	const found = scanImports(readFileSync(hosted, 'utf8'), 'svelte');
	return found.flatMap((item) => (item.specifier?.startsWith('$desktop/') ? [item.specifier] : []));
}
/** The tracked file the hub's own build sends an alias import to, by its Svelte configuration. */
function built(specifier: string): string | undefined {
	const config = readFileSync('packages/hub/svelte.config.js', 'utf8');
	const target = /\$desktop: '([^']+)'/.exec(config)?.[1] ?? 'no alias';
	const path = join('packages/hub', target, specifier.slice('$desktop/'.length));
	return [path, `${path}.ts`].find((candidate) => loaded.index.files.has(candidate));
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

test('the source index resolves what the Web workspace imports of the shared workspace', () => {
	const references = loaded.index.files.get(hosted)?.references ?? [];
	const reached = references.flatMap((item) => item.path ?? []);
	const owner = (path: string) =>
		loaded.stored.find((unit) => unit.status === 'active' && unit.owns.source.includes(path))?.id;
	const through = reached.filter((path) => path.startsWith('packages/desktop/'));
	expect(through.sort()).toEqual(written().map(built).sort());
	expect(Object.fromEntries(through.map((path) => [owner(path), path]))).toEqual(shared);
	// None of them is left as a package from outside, and none is left unresolved.
	expect(references.filter((item) => item.uncertain ?? item.external?.startsWith('$'))).toEqual([]);
});

test('the registry names the Web workspace beside the Electron and iOS one as a consumer of the shell', async () => {
	const shell = await showUnit('desktop.component.workspace-shell');
	expect(shell.consumers).toEqual(expect.arrayContaining(['desktop.page.root', web]));
	const wrapper = await showUnit(web);
	const reused = wrapper.manifest.dependencies.filter((item) => item.unit.startsWith('desktop.'));
	const derived = Object.keys(shared).map((unit) => ({ unit, via: 'import', origin: 'derived' }));
	expect(reused).toEqual(derived);
	expect(wrapper.consumers).toEqual([page]);
	// What is stored is what the index derives: no hand-written link stands in for an import.
	const fresh = loaded.fresh.manifests.find((unit) => unit.id === web);
	expect(wrapper.manifest.dependencies).toEqual(fresh?.dependencies);
}, 60_000);

test('a change of the shared shell reaches the Web workspace and its page, and the Electron and iOS one', async () => {
	const head = side(loaded.index);
	const shell = shared['desktop.component.workspace-shell'];
	const entries = head.entries.map((entry) =>
		entry.path === shell ? { ...entry, hash: '0'.repeat(40) } : entry
	);
	const analysis = new ImpactService(new HandlerRuntimeAdapter(impactKernel));
	const report = await analysis.compute({ ...head, revision: 'before', entries }, head);
	expect(report.changed.map((file) => file.path)).toEqual([shell]);
	expect(report.units.direct).toEqual(['desktop.component.workspace-shell']);
	expect(report.units.indirect).toEqual(expect.arrayContaining([web, page, 'desktop.page.root']));
}, 60_000);

test('declaring those imports changes them alone: no other reference or uncertainty moves', async () => {
	const references = loaded.config.references.filter((entry) => entry.from !== hosted);
	const tree = new WorkingTreeAdapter(loaded.root);
	const undeclared = await indexer.index(tree, { ...loaded.config, references });
	const stated = (index: SourceIndex, path: string) =>
		JSON.stringify(index.files.get(path)?.references);
	const moved = [...loaded.index.files.keys()].filter(
		(path) => stated(loaded.index, path) !== stated(undeclared, path)
	);
	expect(moved).toEqual([hosted]);
	// Undeclared, the index takes each of them for a package from outside the repository.
	const was = undeclared.files.get(hosted)?.references ?? [];
	expect(was.filter((item) => item.external === '$desktop')).toHaveLength(written().length);
	expect(side(loaded.index).graph.uncertain).toEqual(side(undeclared).graph.uncertain);
}, 60_000);

function assertNoNestedHarnessSources() {
	const redundant = [...loaded.index.files.keys()].filter((path) =>
		/\/components\/(?:explorer-ui\/)?harness\//.test(path)
	);
	expect(
		redundant,
		'Components use their responsibility folder without a redundant harness namespace'
	).toEqual([]);
	const owned = loaded.stored
		.filter((unit) => unit.status === 'active')
		.flatMap((unit) => unit.owns.source);
	expect(owned.filter((path) => /\/components\/(?:explorer-ui\/)?harness\//.test(path))).toEqual(
		[]
	);
	const entries = loaded.stored
		.filter((unit) => unit.status === 'active')
		.map((unit) => unit.runtime.entry);
	expect(
		entries.some(
			(path) => path?.includes('/components/harness/') || path?.includes('/explorer-ui/harness/')
		)
	).toBe(false);
}

test('every active visual module has its own required capture state', () => {
	assertNoNestedHarnessSources();
	const catalog = loaded.scenarios.find((scenario) => scenario.id === 'component-catalog-previews');
	const visual = loaded.stored
		.filter((unit) => {
			if (unit.status !== 'active') return false;
			if (unit.composition?.level === 'atom' && unit.catalog?.visibility === 'internal')
				return false;
			if (['component', 'shell'].includes(unit.kind)) return true;
			const sources = unit.owns.source;
			if (unit.kind === 'layout')
				return (
					unit.catalog?.visibility !== 'internal' &&
					sources.some((path) => path.endsWith('.svelte'))
				);
			const alias = sources.some(
				(path) =>
					path.startsWith('packages/reports/src/routes/harness/') &&
					(path.endsWith('/[entity]/details/+page.svelte') || /\/shells(?:\/|$)/.test(path))
			);
			return (
				!alias &&
				unit.catalog?.visibility !== 'internal' &&
				sources.some((path) => path.endsWith('/+page.svelte'))
			);
		})
		.map((unit) => unit.id)
		.sort();
	expect(catalog?.units.slice().sort()).toEqual(visual);
	expect(
		catalog?.states.map((state) => state.units?.[0]),
		'Catalog preview states follow canonical unit order'
	).toEqual(catalog?.units.slice().sort((left, right) => left.localeCompare(right)));
	for (const id of visual) {
		const states = catalog!.states.filter((state) => state.units?.includes(id));
		expect(states, id).toHaveLength(1);
		expect(states[0], id).toMatchObject({
			id: id.replaceAll('.', '-'),
			coverage: 'required',
			units: [id]
		});
	}
});
