import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorkingTreeAdapter } from '../../adapters/WorkingTreeAdapter';
import type { BudgetEvent } from '../../core/budgetTypes';
import { fail } from '../../core/errors';
import { runtimeKinds, type ComponentManifest } from '../../core/unitTypes';
import { workloadSchema } from '../../core/verifyTypes';
import { BudgetLedgerRepository } from '../../repositories/BudgetLedgerRepository';
import { BudgetService, type UnitBaseline } from '../../services/budget-service/BudgetService';
import { UnitBenchmarkService, type UnitBenchmark } from './UnitBenchmarkService';
import { recordCapture } from '../../utils/record-capture/recordCapture';
import { unitMeasurements } from '../../utils/unitMeasurements';
import { loadUnits } from '../load-units/loadUnits';

export interface SignedInput {
	root?: string;
	units: string[];
	all?: boolean;
	record: string;
	reviewer?: string;
	reason?: string;
	now?: () => string;
}

interface Loaded {
	root: string;
	manifests: ComponentManifest[];
	events: BudgetEvent[];
	baselines: Map<string, UnitBaseline>;
	ledger: BudgetLedgerRepository;
}

/** The registry, the ledger and the limits it currently implies, for the working tree. */
export async function loadBudgets(root = process.cwd()): Promise<Loaded> {
	const absolute = resolve(root);
	const loaded = await loadUnits(absolute);
	const ledger = new BudgetLedgerRepository(absolute);
	const read = await ledger.read(new WorkingTreeAdapter(absolute));
	if (read.errors.length > 0) return fail(read.errors.join('\n'));
	const manifests = loaded.fresh.manifests;
	const baselines = new BudgetService().baselines(read.events, manifests);
	return { root: absolute, manifests, events: read.events, baselines, ledger };
}

/** Current size and complexity of units in the working tree; observational only. */
export async function budgetMeasure(unit?: string, root?: string) {
	const loaded = await loadUnits(resolve(root ?? process.cwd()));
	return loaded.fresh.manifests
		.filter((manifest) => manifest.status === 'active' && (!unit || manifest.id === unit))
		.flatMap((manifest) => unitMeasurements(manifest, loaded.index.files, '0'.repeat(40)))
		.map(({ unit: id, metric, value, unitOfMeasure, unavailable, partial, target }) => ({
			unit: id,
			metric,
			// What a unit emits is one row for each execution target.
			...(target ? { target } : {}),
			value,
			unitOfMeasure,
			// A missing value says why, and a value that leaves something out says what.
			...(unavailable ? { unavailable } : {}),
			...(partial ? { partial } : {})
		}));
}

export async function budgetHistory(unit?: string, root?: string): Promise<BudgetEvent[]> {
	const { events } = await loadBudgets(root);
	return events.filter((event) => !unit || event.unit === unit);
}

export async function budgetStatus(root?: string) {
	const { manifests, baselines } = await loadBudgets(root);
	const active = manifests.filter((unit) => unit.status === 'active');
	return {
		baselined: active.filter((unit) => baselines.has(unit.id)).length,
		inherited: active
			.filter((unit) => baselines.get(unit.id)?.inheritedFrom)
			.map((unit) => unit.id),
		unbaselined: active.filter((unit) => !baselines.has(unit.id)).map((unit) => unit.id),
		// Limits that are not numbers: what could not be measured when the baseline was reviewed.
		unmeasured: active.flatMap((unit) =>
			Object.entries(baselines.get(unit.id)?.unmeasured ?? {}).map(([metric, reason]) => ({
				unit: unit.id,
				metric,
				reason
			}))
		)
	};
}

export interface BenchInput {
	unit: string;
	workload: string;
	target?: string;
	evidence?: string;
	state?: string;
}

/** Benchmarks one unit through its declared target and records it as evidence when asked. */
export async function budgetBench(input: BenchInput, root = process.cwd()): Promise<UnitBenchmark> {
	const loaded = await loadUnits(resolve(root));
	const manifest =
		loaded.fresh.manifests.find((unit) => unit.id === input.unit) ??
		fail(`Unknown unit "${input.unit}".`);
	const parsed = workloadSchema.safeParse(
		JSON.parse(readFileSync(resolve(root, input.workload), 'utf8'))
	);
	if (!parsed.success)
		return fail(`${input.workload} is not a workload: ${parsed.error.issues[0].message}`);
	const target = runtimeKinds.find((kind) => kind === input.target);
	const benchmark = await new UnitBenchmarkService(resolve(root)).measure(
		manifest,
		parsed.data,
		target
	);
	recordCapture(
		{
			evidence: input.evidence ?? 'benchmark',
			kind: 'benchmark',
			state: input.state ?? 'default',
			file: `benchmark-${input.unit}.json`,
			mediaType: 'application/json'
		},
		JSON.stringify(benchmark, null, '\t')
	);
	return benchmark;
}
