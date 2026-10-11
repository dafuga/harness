import { GitAdapter } from '../adapters/GitAdapter';
import type { BudgetEvent, PerformanceBaselineEntry } from '../core/budgetTypes';
import { metricUnits } from '../core/comparisonTypes';
import { fail } from '../core/errors';
import type { ComponentManifest } from '../core/unitTypes';
import type { Measurement, VerificationRecord } from '../core/verificationTypes';
import { VerificationStoreRepository } from '../repositories/VerificationStoreRepository';
import { frozenMetrics } from '../utils/budgetFindings';
import { loadBudgets, type SignedInput } from './runBudget';

/** A limit may only come from a clean record whose every other gate passed, signed by a reviewer. */
async function signedRecord(input: SignedInput, root: string): Promise<VerificationRecord> {
	const reviewer = input.reviewer?.trim();
	if (!reviewer) return fail('--reviewer must name the person who reviewed the change.');
	if (!input.reason?.trim()) return fail('--reason must say why the limits are acceptable.');
	const record = new VerificationStoreRepository(root).load(input.record)?.record;
	if (!record) return fail(`${input.record} is not a verification record.`);
	const failed = Object.entries(record.gates ?? { gates: 'failed' }).filter(
		([gate, outcome]) => gate !== 'budgets' && outcome !== 'passed'
	);
	if (failed.length > 0) {
		const gates = failed.map(([gate]) => gate).join(', ');
		return fail(`Record ${record.id.slice(0, 12)} is not known-good: ${gates} did not pass.`);
	}
	const author = await new GitAdapter(root).run([
		'log',
		'-1',
		'--format=%an%n%ae',
		record.source.commit
	]);
	if (author.toLowerCase().split('\n').includes(reviewer.toLowerCase())) {
		return fail('The reviewer cannot be the author of the measured change.');
	}
	return record;
}

/**
 * What a record says about the frozen metrics of a unit: a number where it measured one, and the
 * stated reason where it could not. A metric the record says nothing about freezes nothing.
 */
function frozenMetricsOf(record: VerificationRecord, unit: ComponentManifest) {
	const mine = record.measurements.filter((item) => item.unit === unit.id);
	const metrics: Record<string, number> = {};
	const unmeasured: Record<string, string> = {};
	for (const metric of frozenMetrics) {
		const found = mine.find((item) => item.metric === metric);
		if (typeof found?.value === 'number') metrics[metric] = found.value;
		else if (found?.unavailable) unmeasured[metric] = found.unavailable;
		else return fail(`Record ${record.id.slice(0, 12)} did not measure ${unit.id}.`);
	}
	return { metrics, ...(Object.keys(unmeasured).length > 0 ? { unmeasured } : {}) };
}

function measuredLimits(record: VerificationRecord, unit: ComponentManifest) {
	const own = record.measurements.filter((item) => item.unit === unit.id && item.value !== null);
	const performance = unit.budgets.performance.flatMap((budget) => {
		const target = budget.target ?? unit.runtime.kind;
		const found = own.find(
			(item) =>
				item.metric === budget.metric &&
				item.workload === budget.workload &&
				item.target === target &&
				item.profile === record.profile.id
		);
		return found ? [frozen(found, { record, unit: unit.id, target })] : [];
	});
	return { ...frozenMetricsOf(record, unit), performance };
}

/** A value becomes a baseline only together with the complete definition of what it measured. */
function frozen(
	found: Measurement,
	context: { record: VerificationRecord; unit: string; target: PerformanceBaselineEntry['target'] }
): PerformanceBaselineEntry {
	const { metric, workload, comparison, unitOfMeasure, method } = found;
	const expected = metricUnits[metric] ?? unitOfMeasure;
	const wrongUnit = unitOfMeasure === expected ? '' : `is in ${unitOfMeasure}, not ${expected}`;
	const problem = comparison ? wrongUnit : 'states no comparison context';
	if (problem || !comparison) {
		const subject = `${metric} on ${workload ?? 'no workload'}`;
		return fail(
			`Record ${context.record.id.slice(0, 12)} cannot set a baseline for ${context.unit}: ${subject} ${problem}.`
		);
	}
	return {
		workload: workload ?? '',
		metric,
		target: context.target,
		profile: context.record.profile.id,
		value: found.value ?? 0,
		unitOfMeasure,
		method,
		comparison
	};
}

function signature(input: SignedInput, record: VerificationRecord) {
	return {
		record: { id: record.id, commit: record.source.commit, tree: record.source.tree },
		reviewer: input.reviewer?.trim() ?? '',
		reason: input.reason?.trim() ?? '',
		at: input.now?.() ?? new Date().toISOString()
	};
}

/** Freezes the limits of units that have none yet, from a clean verified record. */
export async function budgetEstablish(input: SignedInput): Promise<BudgetEvent[]> {
	const loaded = await loadBudgets(input.root);
	const record = await signedRecord(input, loaded.root);
	const measured = new Set(record.measurements.map((item) => item.unit));
	const chosen = input.all
		? [...measured].filter((unit) => !loaded.baselines.has(unit))
		: input.units;
	if (chosen.length === 0) return fail('Every measured unit already has a baseline.');
	const events = chosen.map((id): BudgetEvent => {
		const unit =
			loaded.manifests.find((manifest) => manifest.id === id) ?? fail(`Unknown unit "${id}".`);
		const existing = loaded.baselines.get(id);
		if (existing?.inheritedFrom) {
			return fail(
				`${id} inherits the baseline of ${existing.inheritedFrom}; use harness budget approve to change it.`
			);
		}
		if (existing)
			return fail(`${id} already has a baseline; use harness budget approve to change it.`);
		return {
			type: 'baseline',
			unit: id,
			...measuredLimits(record, unit),
			...signature(input, record)
		};
	});
	await loaded.ledger.append(events);
	return events;
}

/** Records a reviewed change of limits, with the values before and after. */
export async function budgetApprove(input: SignedInput): Promise<BudgetEvent[]> {
	const loaded = await loadBudgets(input.root);
	const record = await signedRecord(input, loaded.root);
	const events = input.units.map((id): BudgetEvent => {
		const unit =
			loaded.manifests.find((manifest) => manifest.id === id) ?? fail(`Unknown unit "${id}".`);
		const existing = loaded.baselines.get(id);
		if (!existing) return fail(`${id} has no baseline; use harness budget establish.`);
		const { metrics, unmeasured, performance } = measuredLimits(record, unit);
		const before = Object.fromEntries(
			frozenMetrics.flatMap((metric) =>
				metric in existing.metrics ? [[metric, existing.metrics[metric]]] : []
			)
		);
		return {
			type: 'approval',
			unit: id,
			before,
			after: metrics,
			...(unmeasured ? { unmeasured } : {}),
			performance,
			...signature(input, record)
		};
	});
	await loaded.ledger.append(events);
	return events;
}
