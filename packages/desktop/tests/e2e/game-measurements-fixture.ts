import type { Observation, RuntimeInput } from './game-measurements-fixture.types';
import { loadUnits } from '../../../../src/workflows/loadUnits';
import { CommitTreeAdapter } from '../../../../src/adapters/git-source-history/CommitTreeAdapter';
import { WorkingTreeAdapter } from '../../../../src/adapters/git-source-history/WorkingTreeAdapter';
import { unitMeasurements } from '../../../../src/utils/development-tooling/unitMeasurements';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
const cached = new Map<string, Promise<Observation[]>>();
const defaultUnits = [
	'game-workspace',
	'game-view-fields',
	'game-graph',
	'game-checkpoint-pane',
	'game-checkpoint-image',
	'game-checkpoint-editor'
].map((name) => 'desktop.component.' + name);

/** Source sizes and complexity come from the tested Git tree, not the live checkout. */
export function gameSourceMeasurements(
	revision?: string,
	ids = defaultUnits
): Promise<Observation[]> {
	if (!revision) return Promise.resolve([]);
	const key = revision + '|' + ids.join(',');
	let pending = cached.get(key);
	if (!pending) {
		pending = measuredSource(revision, ids);
		cached.set(key, pending);
	}
	return pending;
}

async function measuredSource(revision: string, ids: string[]): Promise<Observation[]> {
	const root = resolve(import.meta.dirname, '../../../..');
	const exported = !existsSync(join(root, '.git'));
	if (exported && !basename(root).startsWith('harness-snapshot-'))
		throw new Error('Source metrics need a Git tree or a Harness immutable snapshot.');
	const source = exported
		? new WorkingTreeAdapter(root)
		: await CommitTreeAdapter.open(root, revision);
	const loaded = await loadUnits(root, source);
	const units = loaded.stored.filter((u) => ids.includes(u.id));
	if (units.length !== ids.length) throw new Error('Source metrics need every requested unit.');
	return units.flatMap((unit) =>
		unitMeasurements(unit, loaded.index.files, revision).flatMap((entry) => {
			if (entry.metric === 'artifact-bytes' && entry.method === 'Not applicable.') return [];
			if (entry.value === null)
				throw new Error(entry.unavailable ?? 'Source measurement unavailable.');
			return [
				{
					unit: unit.id,
					metric: entry.metric,
					unitOfMeasure: entry.unitOfMeasure,
					value: entry.value,
					workload: 'committed-source',
					target: 'module',
					samples: 1,
					method: entry.method + (entry.partial ? ' ' + entry.partial : '')
				}
			];
		})
	);
}
/** Keep real fresh-document navigation separately from later modal-state timing. */
export function gameRuntimeMeasurements(input: RuntimeInput): Observation[] {
	const navigation = input.navigation;
	if (navigation === null || !Number.isFinite(navigation) || navigation <= 0)
		throw new Error('Game page evidence needs fresh navigation timing for its current URL.');
	return [
		...rendererObservations(input),
		{
			unit: 'desktop.page.game',
			metric: 'browser-navigation-ms',
			unitOfMeasure: 'ms',
			value: navigation,
			workload: input.workload,
			target: 'http',
			samples: 1,
			method:
				'NavigationTiming of the fresh document that opened this flow, retained after fonts and images settle. Modal states keep that same document entry; a different client route cannot borrow it. Not modal-transition or provider latency.'
		}
	];
}

function rendererObservations(input: {
	units: string[];
	elapsed: number;
	heap: number;
	workload: string;
}) {
	return input.units.flatMap((unit) => [
		{
			unit,
			metric: 'document-to-state-ready-ms',
			unitOfMeasure: 'ms',
			value: input.elapsed,
			workload: input.workload,
			target: 'process',
			samples: 1,
			method:
				'Cumulative time from this document navigation to the settled authoring state, including previous test actions and fixture generation; not isolated component latency or provider inference.'
		},
		{
			unit,
			metric: 'renderer-js-heap-bytes',
			unitOfMeasure: 'bytes',
			value: input.heap,
			workload: input.workload,
			target: 'process',
			samples: 1,
			method:
				'Whole Chromium renderer V8 heap after fonts and image decoding, including shared app code and the synthetic provider fixture. Excludes GPU and Electron main memory; not isolated component memory.'
		}
	]);
}
