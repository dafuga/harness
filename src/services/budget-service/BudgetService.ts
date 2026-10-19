import type { BudgetEvent } from "../../core/budgetTypes";
import type { ComponentManifest } from "../../core/unitTypes";
import type { BudgetFinding, Measurement } from "../../core/verificationTypes";
import { budgetFindings } from "./budgetFindings";
import { isFrozen, performanceLimit, type BudgetBaseline } from "../../utils/budgetFindings";
import { emittedMetric } from "../../utils/emittedSizes";

export interface UnitBaseline extends BudgetBaseline {
	/** Retired predecessor whose frozen limits this unit continues. */
	inheritedFrom?: string;
}

export interface BudgetSubject {
	manifest: ComponentManifest;
	/** True when the unit's own source changed, so its size and complexity are judged. */
	checkSize: boolean;
}

export interface BudgetReport {
	findings: BudgetFinding[];
	failures: string[];
}

const units: Record<string, string> = { 'throughput-ops': 'ops/s', 'memory-bytes': 'bytes' };

/** Applies the frozen baselines in the ledger; nothing here can raise or reset a limit. */
export class BudgetService {
	/** Current limits per unit; a unit without its own inherits those of its predecessors. */
	baselines(events: BudgetEvent[], manifests: ComponentManifest[]): Map<string, UnitBaseline> {
		const own = new Map<string, UnitBaseline>();
		for (const event of events) {
			const previous = own.get(event.unit) ?? { metrics: {}, performance: [] };
			const replaced = previous.performance.filter(
				(item) => !event.performance.some((next) => sameWorkload(item, next))
			);
			own.set(event.unit, {
				...frozenLimits(previous, event),
				performance: [...replaced, ...event.performance]
			});
		}
		for (const unit of manifests) inherit(own, unit);
		return own;
	}

	evaluate(
		subjects: BudgetSubject[],
		context: { measurements: Measurement[]; baselines: Map<string, UnitBaseline>; profile: string }
	): BudgetReport {
		const findings = subjects.flatMap(({ manifest, checkSize }) =>
			budgetFindings({
				unit: manifest.id,
				profile: context.profile,
				defaultTarget: manifest.runtime.kind,
				budgets: manifest.budgets.performance,
				measurements: context.measurements,
				baseline: context.baselines.get(manifest.id),
				checkSize
			})
		);
		const tolerances = new Map(
			subjects.flatMap(({ manifest }) =>
				manifest.budgets.performance.map((budget) => [
					`${manifest.id}\n${budget.metric}`,
					budget.tolerance
				])
			)
		);
		return { findings, failures: this.failures(findings, tolerances) };
	}

	private failures(findings: BudgetFinding[], tolerances: Map<string, number>): string[] {
		const unbaselined = new Set<string>();
		return findings.flatMap((finding) => {
			// What cannot be measured, and was reviewed as such, is stated and not judged.
			if (finding.status === 'passed' || finding.status === 'unavailable') return [];
			const unreviewed = finding.status === 'missing-baseline' ? unfrozen(finding) : undefined;
			if (unreviewed) return [unreviewed];
			if (finding.status !== 'missing-baseline') {
				return [describe(finding, tolerances.get(`${finding.unit}\n${finding.metric}`) ?? 0)];
			}
			if (unbaselined.has(finding.unit)) return [];
			unbaselined.add(finding.unit);
			return [`${finding.unit}: no baseline is established; a reviewer must establish one`];
		});
	}
}

/**
 * The frozen numbers after one ledger line, and the metrics it recorded as not measurable. A
 * metric is one or the other: a later number replaces the statement, and a later statement
 * replaces the number.
 */
function frozenLimits(
	previous: UnitBaseline,
	event: BudgetEvent
): Pick<UnitBaseline, 'metrics' | 'unmeasured'> {
	const numbers = event.type === 'baseline' ? event.metrics : event.after;
	const stated = event.unmeasured ?? {};
	const metrics = Object.fromEntries(
		Object.entries({ ...previous.metrics, ...numbers }).filter(([metric]) => !(metric in stated))
	);
	const unmeasured = Object.fromEntries(
		Object.entries({ ...previous.unmeasured, ...stated }).filter(([metric]) => !(metric in numbers))
	);
	return { metrics, ...(Object.keys(unmeasured).length > 0 ? { unmeasured } : {}) };
}

/** A unit with no limits of its own continues those of the first predecessor that has some. */
function inherit(own: Map<string, UnitBaseline>, unit: ComponentManifest): void {
	if (own.has(unit.id)) return;
	const from = (unit.lineage?.predecessors ?? []).find((id) => own.has(id));
	const inherited = from ? own.get(from) : undefined;
	if (from && inherited) own.set(unit.id, { ...inherited, inheritedFrom: from });
}

function sameWorkload(left: BudgetBaseline['performance'][number], right: typeof left): boolean {
	return (
		left.workload === right.workload &&
		left.metric === right.metric &&
		left.target === right.target &&
		left.profile === right.profile
	);
}

/** What a finding is about: a frozen metric, the size one target emits, or a timing on a workload. */
function subjectOf(finding: BudgetFinding): string {
	if (finding.metric === emittedMetric && finding.target) {
		return `${finding.metric} of the ${finding.target} target`;
	}
	if (isFrozen(finding.metric)) return finding.metric;
	return `${finding.metric} on ${finding.detail?.split(' on the ')[0] ?? ''}`;
}

/** A number the unit's own reviewed baseline has no limit for, although the unit has a baseline. */
function unfrozen(finding: BudgetFinding): string | undefined {
	const subject = `${finding.unit}: ${subjectOf(finding)}`;
	if (finding.detail === 'measurable-now') {
		return `${subject} could not be measured when its limits were reviewed and is ${finding.measured} now; a reviewer must approve a limit`;
	}
	if (finding.detail === 'no-limit-for-output') {
		return `${subject} is ${finding.measured} and has no frozen limit: the baseline of the unit does not cover this output; a reviewer must approve a limit`;
	}
	return undefined;
}

/** A measurement that should exist and does not; a frozen one says what was lost and why. */
function unmeasuredText(finding: BudgetFinding, subject: string, frozen: boolean): string {
	const reason = frozen ? finding.detail : undefined;
	if (!reason) return `${finding.unit}: ${subject} was not measured`;
	const lost =
		finding.baseline === null
			? 'was not measured'
			: `was ${finding.baseline} at its baseline and can no longer be measured`;
	return `${finding.unit}: ${subject} ${lost}: ${reason}`;
}

/** Why a measurement was reported instead of compared. */
function uncompared(finding: BudgetFinding): string {
	const differences = (finding.differences ?? []).join('; ');
	if (finding.status === 'incomplete') return `has no complete comparison context: ${differences}`;
	if (!differences) return 'has a baseline only for another machine profile';
	return `cannot be compared with its baseline: ${differences}`;
}

function describe(finding: BudgetFinding, tolerance: number): string {
	const frozen = isFrozen(finding.metric);
	const subject = subjectOf(finding);
	if (finding.status === 'missing-measurement') return unmeasuredText(finding, subject, frozen);
	if (finding.status === 'incomplete' || finding.status === 'incompatible') {
		return `${finding.unit}: ${subject} ${uncompared(finding)}`;
	}
	const { baseline, measured } = finding;
	if (frozen) {
		return `${finding.unit}: ${subject} grew from ${baseline} to ${measured} without a recorded approval`;
	}
	const unit = units[finding.metric] ?? 'ms';
	const limit = performanceLimit(finding.metric, baseline ?? 0, tolerance);
	return (
		`${finding.unit}: ${subject} is ${measured} ${unit} against a baseline of ${baseline} ${unit}; ` +
		`the limit is ${limit} ${unit}`
	);
}
