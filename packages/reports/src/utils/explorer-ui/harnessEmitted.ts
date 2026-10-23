import type { HarnessRecord, HarnessUnit } from '../../models/explorer-ui/Harness.types';

type Measurement = HarnessRecord['measurements'][number];

export const metric = 'artifact-bytes';

export const order = ['process', 'wasm'];

const labels: Record<string, string> = { process: 'process (native)', wasm: 'Wasm' };

/** A size in words: one byte is a byte. */
export const emittedBytes = (count: number): string => `${count} ${count === 1 ? 'byte' : 'bytes'}`;

/** How a reader is told which output a size belongs to. */
export const emittedLabel = (target: string): string => labels[target] ?? target;

/** The name the limit of a target has in the ledger and in the notes of a growth point. */
export const emittedKey = (target: string): string => `${metric}:${target}`;

export interface EmittedLine {
	target: string;
	label: string;
	/** The measured bytes, or the statement that there are none and why. */
	value: string;
	/** The limit this revision freezes for the target, or that it freezes none. */
	limit: string;
	/** What the record found when it judged the size against that limit. */
	note?: string;
}

export /**
 * The size measured from the build of the verified snapshot. A size a benchmark reports about
 * its own run names a machine profile and is not what a limit is frozen from.
 */
function built(
	record: HarnessRecord | null,
	unit: string,
	target?: string
): Measurement | undefined {
	return record?.measurements.find(
		(item) =>
			item.unit === unit &&
			item.metric === metric &&
			item.target === target &&
			!item.workload &&
			!item.profile
	);
}

export /** The outputs a unit declares, in a fixed order; a unit that only runs as a module has none. */
function targetsOf(unit: HarnessUnit): string[] {
	const declared = new Set(unit.runtime.targets.map((target) => target.kind));
	return order.filter((target) => declared.has(target));
}

function measured(record: HarnessRecord | null, found: Measurement | undefined): string {
	if (!record || !found) return 'not measured at this revision';
	if (found.value === null) return `unavailable: ${found.unavailable ?? 'no reason recorded'}`;
	return emittedBytes(found.value);
}

function limited(unit: HarnessUnit, target: string): string {
	const limit = unit.emitted?.limits[target];
	if (limit !== undefined) return `frozen at ${emittedBytes(limit)}`;
	if (unit.emitted?.unmeasured?.[target]) return 'not frozen: reviewed as not buildable';
	return 'no limit is recorded at this revision';
}

/** What the record said when it held the size against its limit; nothing for a size that passed. */
function judged(record: HarnessRecord | null, unit: string, target: string): string | undefined {
	const finding = record?.budgets.findings.find(
		(item) => item.unit === unit && item.metric === metric && item.target === target
	);
	if (finding?.status === 'exceeded') {
		return `Grew from ${finding.baseline} to ${emittedBytes(finding.measured ?? 0)} without a recorded approval.`;
	}
	if (finding?.status === 'missing-measurement' && finding.baseline !== null) {
		return `Was ${emittedBytes(finding.baseline)} at its baseline and can no longer be measured.`;
	}
	if (finding?.status === 'missing-baseline') return 'A reviewer has to freeze a limit for it.';
	return undefined;
}

/**
 * How the size of what a unit emits reads at a revision: one line for each execution target,
 * each with its own bytes and its own limit, never added together. A unit that emits nothing has
 * one line that says so. A size that is not there is said to be missing; it is never a zero.
 */
export function harnessEmitted(unit: HarnessUnit, record: HarnessRecord | null): EmittedLine[] {
	const targets = targetsOf(unit);
	if (targets.length === 0) {
		const why =
			built(record, unit.id)?.unavailable ?? 'This unit declares no process or Wasm output.';
		return [{ target: 'none', label: '', value: `none: ${why}`, limit: 'no limit applies' }];
	}
	return targets.map((target) => {
		const note = judged(record, unit.id, target);
		return {
			target,
			label: emittedLabel(target),
			value: measured(record, built(record, unit.id, target)),
			limit: limited(unit, target),
			...(note ? { note } : {})
		};
	});
}

export interface EmittedChange {
	target: string;
	label: string;
	before: number | null;
	after: number | null;
}

export { emittedChange } from '../../components/explorer-ui/harness-compare/harnessEmitted';
export { emittedTargets } from '../../components/explorer-ui/harness-growth/harnessEmitted';
