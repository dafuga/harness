import type { AssemblyContext, AssemblyInput } from './RecordAssemblyService.types';
export type { AssemblyContext, AssemblyInput } from './RecordAssemblyService.types';
import type { ImpactReport } from '../../../../../core/development-tooling/impactTypes';
import type { ComponentManifest } from '../../../../../core/development-tooling/unitTypes';
import type {
	Measurement,
	VerificationRecord
} from '../../../../../core/verification-evidence/verificationTypes';
import { BudgetLedgerRepository } from '../../../../../repositories/verification-evidence/BudgetLedgerRepository';

import type {
	BudgetReport,
	BudgetSubject
} from '../../../../../services/budget-service/BudgetService';
import { BudgetService } from '../../../../../services/budget-service/BudgetService';
import type { ReasonReport } from '../../../../../services/ExplanationService';
import { sdkPackage } from '../../../../../utils/development-tooling/buildStamp';
import { sealRecord } from '../../../../../utils/sealRecord';
import { emittedTargets, unitMeasurements } from '../../../../../utils/unitMeasurements';
import { PerformanceEvidenceValidator } from '../../../../../validators/verification-evidence/PerformanceEvidenceValidator';

import type { Executed } from '../SnapshotRunService';
import { recordedBuilds } from './recordedBuilds';
import { benchmarkMeasurements, recordComponents } from './sealRecord';
import { unmeasured } from './unmeasured';
import { ledgerGate, registryGate } from './VerificationGates';
function outcome(failures: string[]): 'passed' | 'failed' {
	return failures.length === 0 ? 'passed' : 'failed';
}
/** Turns what a run observed into one sealed record, with every gate judged. */
export class RecordAssemblyService {
	constructor(private readonly context: AssemblyContext) {}
	async assemble(input: AssemblyInput): Promise<VerificationRecord> {
		const { context } = this;
		const { outcomes } = input.executed;
		const measurements = this.measurements(input.executed);
		const budgets = await this.budgets(measurements);
		const reasons = await context.explained();
		const gates = this.gates(input, { budgets, reasons, measurements });
		const failures = Object.values(gates).flat();
		return sealRecord({
			schemaVersion: 1,
			repository: context.root,
			source: source(context),
			profile: context.profile,
			tools: [{ id: 'harness', version: sdkPackage.version }, ...input.executed.tools],
			startedAt: input.startedAt,
			finishedAt: new Date().toISOString(),
			status: outcome(failures),
			components: recordComponents(
				context.impact,
				context,
				measurements.map((item) => item.unit)
			),
			measurements,
			impact: recordedImpact(context.impact),
			tests: outcomes
				.filter((item) => !item.check.id.startsWith('setup-'))
				.map((item) => item.entry),
			scenarios: judgedScenarios(input),
			...recordedBuilds(input.executed.builds),
			budgets: { status: outcome(budgets.report.failures), findings: budgets.report.findings },
			reasons: recordedReasons(reasons),
			gates: Object.fromEntries(Object.entries(gates).map(([gate, list]) => [gate, outcome(list)])),
			failures
		});
	}

	/** Each gate's failures, in the order they are reported. */
	private gates(
		input: AssemblyInput,
		judged: {
			budgets: { report: BudgetReport; ledger: string[] };
			reasons: ReasonReport;
			measurements: Measurement[];
		}
	): Record<string, string[]> {
		const { outcomes } = input.executed;
		return {
			...(this.context.requirePerformance
				? { performance: profileFailures(this.context, judged.measurements) }
				: {}),
			snapshot: snapshotFailures(input.executed),
			registry: registryGate(this.context.base, this.context.head),
			ledger: judged.budgets.ledger,
			tests: outcomes.filter((item) => !item.check.scenario).flatMap((item) => item.failures),
			scenarios: input.scenarios.flatMap((scenario) => scenario.failures),
			reasons: judged.reasons.failures,
			budgets: judged.budgets.report.failures
		};
	}
	/** Units whose own source changed, which is where size and complexity are judged. */
	private sized(): ComponentManifest[] {
		const { impact, head } = this.context;
		const changed = new Set([...impact.units.direct, ...impact.units.added]);
		return head.manifests.filter((unit) => changed.has(unit.id) && unit.status === 'active');
	}
	/**
	 * Unchanged units the change reaches through a dependency that have something to judge: a
	 * performance budget, or an output whose size is frozen and may grow with what it is built from.
	 */
	private budgeted(): ComponentManifest[] {
		const indirect = new Set(this.context.impact.units.indirect);
		return this.context.head.manifests.filter(
			(unit) =>
				indirect.has(unit.id) &&
				(unit.budgets.performance.length > 0 || emittedTargets(unit).length > 0)
		);
	}
	/** Static figures per judged unit, then what benchmarks reported, then what nothing measured. */
	private measurements(executed: Executed): Measurement[] {
		const { head, commit, profile } = this.context;
		const gathered = executed.outcomes.flatMap((item) => item.gathered);
		const reported = benchmarkMeasurements(gathered, { profile: profile.id, commit });
		const timed = new Set(reported.filter((item) => item.value !== null).map((item) => item.unit));
		const perUnit = [...this.sized(), ...this.budgeted()].flatMap((unit) => [
			...unitMeasurements(unit, head.index.files, commit, executed.artifacts),
			...(timed.has(unit.id) ? [] : unmeasured(unit.id, commit))
		]);
		return [...perUnit, ...reported];
	}
	private async budgets(
		measurements: Measurement[]
	): Promise<{ report: BudgetReport; ledger: string[] }> {
		const { context } = this;
		const repository = new BudgetLedgerRepository(context.root);
		const ledger = {
			base: await repository.read(context.base.tree),
			head: await repository.read(context.head.tree)
		};
		const subjects: BudgetSubject[] = [
			...this.sized().map((manifest) => ({ manifest, checkSize: true })),
			...this.budgeted().map((manifest) => ({ manifest, checkSize: false }))
		];
		const service = new BudgetService();
		const report = service.evaluate(subjects, {
			measurements,
			baselines: service.baselines(ledger.head.events, context.head.manifests),
			profile: context.profile.id
		});
		return { report, ledger: ledgerGate(ledger, context.store) };
	}
}

/** The snapshot must stay the exact commit: nothing changed, nothing removed, nothing added. */
/** Scenarios that ran and scenarios whose evidence is inherited, in one order. */
function judgedScenarios(input: AssemblyInput): VerificationRecord['scenarios'] {
	const all = [...input.scenarios.map((scenario) => scenario.result), ...input.referenced];
	return all.sort((left, right) => (left.id < right.id ? -1 : 1));
}

function snapshotFailures(executed: Executed): string[] {
	const changed = executed.mutated.map((path) => `snapshot mutated during verification: ${path}`);
	const gained = executed.added.map(
		(path) => `snapshot gained an undeclared file during verification: ${path}`
	);
	return [...executed.setupFailures, ...executed.buildFailures, ...changed, ...gained];
}

function recordedReasons(report: ReasonReport): VerificationRecord['reasons'] {
	const open = report.required.flatMap(({ from: _from, to: _to, state, ...rest }) =>
		state === 'explained' ? [] : [{ ...rest, state }]
	);
	return { status: outcome(report.failures), entries: report.entries, missing: open };
}

function recordedImpact(impact: ImpactReport): VerificationRecord['impact'] {
	const changed = impact.changed.map(({ path, status, classification }) => ({
		path,
		status,
		classification
	}));
	const { runtime, expanded, units, uncertain } = impact;
	return { runtime, expanded, changed, units, uncertain };
}

function source(context: AssemblyContext): VerificationRecord['source'] {
	const { commit, tree, baseCommit, baseRecord, requestedBase } = context;
	const widened = requestedBase && requestedBase !== baseCommit ? { requestedBase } : {};
	const proven = baseCommit && baseRecord ? { baseRecord } : {};
	return { commit, tree, base: baseCommit, ...proven, ...widened };
}

function profileFailures(context: AssemblyContext, measurements: Measurement[]): string[] {
	const { head, impact, commit, profile } = context;
	const ids = new Set([...impact.units.direct, ...impact.units.added, ...impact.units.indirect]);
	return new PerformanceEvidenceValidator().validate({
		units: head.manifests.filter((unit) => ids.has(unit.id)),
		files: head.index.files,
		measurements,
		commit,
		profile: profile.id
	});
}
