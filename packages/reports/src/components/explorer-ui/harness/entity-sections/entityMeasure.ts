import type {
	MeasureRow,
	PerformanceRow,
	EntityMeasure
} from '../../../../utils/explorer-ui/entityMeasure';
import {
	notMeasured,
	byteSize,
	tolerancePolicy
} from '../../../../utils/explorer-ui/entityMeasure';
import type { HarnessRecord, HarnessUnit } from '../../../../models/explorer-ui/Harness.types';
import { humanize } from '../../../../utils/explorer-ui/entityContract';
import { reasonText } from '../../../../utils/explorer-ui/explorerState';
import { harnessEmitted } from '../../../../utils/explorer-ui/harnessEmitted';

type Measurement = HarnessRecord['measurements'][number];

type Budget = HarnessUnit['budgets']['performance'][number];

/** A recorded note as a reader is told it: without the file it names, which Details Source shows. */
const told = (note: string | undefined) => (note === undefined ? undefined : reasonText(note));

/** A figure of the unit itself names no workload and no machine. */
function own(measured: Measurement[], metric: string): Measurement | undefined {
	return measured.find((item) => item.metric === metric && !item.workload && !item.profile);
}

function ownRow(measured: Measurement[], metric: string, label: string): MeasureRow {
	const found = own(measured, metric);
	if (!found) return { label, value: notMeasured };
	if (found.value === null) return { label, value: notMeasured, note: told(found.unavailable) };
	const value = metric === 'source-bytes' ? byteSize(found.value!) : String(found.value);
	return { label, value, ...(found.partial ? { note: `Partial: ${told(found.partial)}` } : {}) };
}

/** One line per execution target: its bytes, or that there are none and why. */
function emittedRows(unit: HarnessUnit, record: HarnessRecord | null): MeasureRow[] {
	return harnessEmitted(unit, record).map((line) => {
		const label = line.label ? `Emitted size · ${line.label}` : 'Emitted size';
		const bytes = /^(\d+) bytes?$/.exec(line.value);
		if (bytes) return { label, value: byteSize(Number(bytes[1])), note: told(line.note) };
		// A line without a size says why after its first word; that reason is the note.
		return { label, value: notMeasured, note: told(/^\w+: (.+)$/s.exec(line.value)?.[1]) };
	});
}

function observedValue(found: Measurement | undefined): string {
	if (!found || found.value === null) return notMeasured;
	if (found.unitOfMeasure === 'bytes') return byteSize(found.value);
	return `${Number(found.value.toPrecision(4))} ${found.unitOfMeasure}`;
}

function metricLabel(metric: string): string {
	if (metric === 'process-peak-rss-bytes') return 'Benchmark process peak RSS';
	if (metric === 'latency-warm-ms') return 'Warm latency per call';
	return humanize(metric);
}

function timing(
	found: Measurement | undefined,
	budget: Omit<Budget, 'tolerance'> & { tolerance?: number }
): PerformanceRow {
	const tolerance = budget.tolerance;
	return {
		workload: humanize(budget.workload),
		metric: metricLabel(budget.metric),
		target: found?.target ?? budget.target ?? '',
		profile: found?.profile ?? '',
		value: observedValue(found),
		note: found?.method,
		tolerance: tolerance === undefined ? '—' : `${Math.round(tolerance * 100)}%`,
		over: tolerance !== undefined && tolerance > tolerancePolicy
	};
}

/** The timings of one declared budget: one row for each profile it was taken under. */
function budgetRows(measured: Measurement[], budget: Budget): PerformanceRow[] {
	const taken = measured.filter(
		(item) =>
			item.metric === budget.metric &&
			item.workload === budget.workload &&
			(!budget.target || item.target === budget.target)
	);
	return taken.length ? taken.map((found) => timing(found, budget)) : [timing(undefined, budget)];
}

/**
 * The size and the performance profile of one entity at a revision, from the record the host
 * judges that revision by, so a figure and a verdict never come from different attempts. A metric nothing measured reads Not measured with its reason and is never a zero.
 * Timings taken under different profiles or targets stay separate rows and are never joined.
 */
export function entityMeasure(
	unit: HarnessUnit,
	record: HarnessRecord | null,
	observations: Measurement[] = []
): EntityMeasure {
	const measured = [
		...(record?.measurements ?? []),
		...observations,
		...(unit.sourceMeasurements ?? [])
	].filter(
		(item) => item.unit === unit.id && (!item.callable || unit.owns.symbols.includes(item.callable))
	);
	const unbudgeted = measured.filter(
		(item) =>
			item.workload &&
			item.profile &&
			!unit.budgets.performance.some(
				(budget) => budget.workload === item.workload && budget.metric === item.metric
			)
	);
	return {
		size: [
			ownRow(measured, 'source-bytes', 'Source size'),
			...emittedRows(unit, record ?? ({ measurements: measured } as HarnessRecord)),
			ownRow(measured, 'complexity', 'Complexity')
		],
		performance: [
			...unit.budgets.performance.flatMap((budget) => budgetRows(measured, budget)),
			...unbudgeted.map((found) =>
				timing(found, { workload: found.workload!, metric: found.metric })
			)
		]
	};
}
