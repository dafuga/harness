import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { HandlerRuntimeAdapter } from '../src/adapters/HandlerRuntimeAdapter';
import type { ImpactSide } from '../src/core/impactTypes';
import { ImpactService } from '../src/services/impact-service/ImpactService';
import { SourceGraphService } from '../src/services/SourceGraphService';
import { impactKernel } from '../src/utils/impact-kernel/impactKernel';
import { loadUnits, type LoadedUnits } from '../src/workflows/loadUnits';

let loaded: LoadedUnits;
beforeAll(async () => {
	loaded = await loadUnits(process.cwd());
}, 60_000);
const path: string = JSON.parse(
	readFileSync('specification/units/reports.component.entity-cases.json', 'utf8')
).runtime.entry;
const unit = 'reports.component.entity-cases';
const sourceOf = (id: string): string =>
	JSON.parse(readFileSync(`specification/units/${id}.json`, 'utf8')).runtime.entry;

test('the shared case table is an actual dependency of both artifact viewers, without an external alias', () => {
	for (const source of [
		sourceOf('reports.component.harness-entity-artifact'),
		sourceOf('desktop.component.runtime-artifact')
	]) {
		const references = loaded.index.files.get(source)!.references;
		expect(references.filter((reference) => reference.path === path)).toHaveLength(1);
		expect(
			references.filter(
				(reference) => reference.uncertain ?? reference.external?.includes('EntityCases')
			)
		).toEqual([]);
	}
});

test('changing the shared case renderer selects both viewers, their Web and Electron pages, and downstream scenarios', async () => {
	const head: ImpactSide = {
		revision: 'working-tree',
		config: loaded.config,
		entries: [...loaded.index.files.values()].map(({ path, hash }) => ({ path, hash })),
		manifests: loaded.stored,
		scenarios: loaded.scenarios,
		graph: new SourceGraphService().build(loaded.index, loaded.stored, loaded.scenarios)
	};
	const before = {
		...head,
		revision: 'before',
		entries: head.entries.map((entry) =>
			entry.path === path ? { ...entry, hash: '0'.repeat(40) } : entry
		)
	};
	const report = await new ImpactService(new HandlerRuntimeAdapter(impactKernel)).compute(
		before,
		head
	);
	expect(report.units.direct).toEqual([unit]);
	expect(report.units.indirect).toEqual(
		expect.arrayContaining([
			'reports.component.harness-entity-artifact',
			'desktop.component.runtime-artifact',
			'desktop.component.workspace-shell',
			'hub.component.hosted-workspace',
			'desktop.page.root',
			'hub.page.projects-project-id-harness-path'
		])
	);
	expect(report.scenarios.affected).toEqual(
		expect.arrayContaining(['harness-console', 'desktop-renderer'])
	);
});
