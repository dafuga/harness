import { MeasureRow, notMeasured, byteSize, PerformanceRow, tolerancePolicy, EntityMeasure } from '../../../utils/entityMeasure';
import type { HarnessRecord, HarnessUnit } from "../../../models/Harness.types.ts";
import { humanize } from "../../../utils/entityContract";
import { reasonText } from "../../../utils/explorerState";
import { harnessEmitted } from "../../../utils/harnessEmitted";

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
	const value = metric === 'source-bytes' ? byteSize(found.value) : String(found.value);
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

function timing(found: Measurement | undefined, budget: Budget): PerformanceRow {
	const measured = found && found.value !== null;
	return {
		workload: humanize(budget.workload),
		metric: humanize(budget.metric),
		target: found?.target ?? budget.target ?? '',
		profile: found?.profile ?? '',
		value: measured ? `${found.value} ${found.unitOfMeasure}` : notMeasured,
		tolerance: `${Math.round(budget.tolerance * 100)}%`,
		over: budget.tolerance > tolerancePolicy
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
export function entityMeasure(unit: HarnessUnit, record: HarnessRecord | null): EntityMeasure {
	const measured = (record?.measurements ?? []).filter((item) => item.unit === unit.id);
	return {
		size: [
			ownRow(measured, 'source-bytes', 'Source size'),
			...emittedRows(unit, record),
			ownRow(measured, 'complexity', 'Complexity')
		],
		performance: unit.budgets.performance.flatMap((budget) => budgetRows(measured, budget))
	};
}
