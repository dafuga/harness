import { loadUnits } from '../../../../src/workflows/loadUnits';
import { CommitTreeAdapter } from '../../../../src/adapters/git-source-history/CommitTreeAdapter';
import { WorkingTreeAdapter } from '../../../../src/adapters/git-source-history/WorkingTreeAdapter';
import { unitMeasurements } from '../../../../src/utils/development-tooling/unitMeasurements';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
type Observation = {
	unit: string;
	metric: string;
	unitOfMeasure: string;
	value: number;
	workload: string;
	target: string;
	samples: number;
	method: string;
};
const cached = new Map<string, Promise<Observation[]>>();

/** Source sizes and complexity come from the tested Git tree, not the live checkout. */
export function gameSourceMeasurements(revision?: string): Promise<Observation[]> {
	if (!revision) return Promise.resolve([]);
	let pending = cached.get(revision);
	if (!pending) {
		pending = measuredSource(revision);
		cached.set(revision, pending);
	}
	return pending;
}

async function measuredSource(revision: string): Promise<Observation[]> {
	const root = resolve(import.meta.dirname, '../../../..');
	const exported = !existsSync(join(root, '.git'));
	if (exported && !basename(root).startsWith('harness-snapshot-'))
		throw new Error('Source metrics need a Git tree or a Harness immutable snapshot.');
	const source = exported
		? new WorkingTreeAdapter(root)
		: await CommitTreeAdapter.open(root, revision);
	const loaded = await loadUnits(root, source);
	const names = [
		'game-workspace',
		'game-view-fields',
		'game-graph',
		'game-checkpoint-pane',
		'game-checkpoint-image',
		'game-checkpoint-editor'
	];
	const units = loaded.stored.filter((u) =>
		names.some((name) => u.id === 'desktop.component.' + name)
	);
	if (units.length !== names.length)
		throw new Error('Checkpoint source metrics need every changed unit.');
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
