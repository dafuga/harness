import type { ImpactReport } from '../core/impactTypes';
import type { ComponentManifest } from '../core/unitTypes';
import type {
	Measurement,
	ScenarioResult,
	VerificationProfile,
	VerificationRecord
} from '../core/verificationTypes';
import { BudgetLedgerRepository } from '../repositories/BudgetLedgerRepository';
import { ExplanationRepository } from '../repositories/ExplanationRepository';
import type { VerificationStoreRepository } from '../repositories/VerificationStoreRepository';
import { requiredReasons } from '../utils/requiredReasons';
import { benchmarkMeasurements, recordComponents, sealRecord } from '../utils/sealRecord';
import { unitMeasurements } from '../utils/unitMeasurements';
import type { RevisionSide } from '../workflows/loadRevisions';
import { BudgetService, type BudgetReport, type BudgetSubject } from './BudgetService';
import { ExplanationService, type ReasonReport } from './ExplanationService';
import type { Executed } from './SnapshotRunService';
import { ledgerGate, registryGate } from './VerificationGates';

export interface AssemblyContext {
	root: string;
	commit: string;
	tree: string;
	baseCommit: string | null;
	baseRecord?: string;
	requestedBase: string | null;
	base: RevisionSide;
	head: RevisionSide;
	impact: ImpactReport;
	profile: VerificationProfile;
	store: VerificationStoreRepository;
}

export interface AssemblyInput {
	startedAt: string;
	executed: Executed;
	scenarios: Array<{ result: ScenarioResult; failures: string[] }>;
	referenced: ScenarioResult[];
}

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
		const reasons = await this.reasons();
		const gates = this.gates(input, { budgets, reasons });
		const failures = Object.values(gates).flat();
		const scenarios = [...input.scenarios.map((scenario) => scenario.result), ...input.referenced];
		return sealRecord({
			schemaVersion: 1,
			repository: context.root,
			source: this.source(),
			profile: context.profile,
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
			scenarios: scenarios.sort((left, right) => (left.id < right.id ? -1 : 1)),
			budgets: { status: outcome(budgets.report.failures), findings: budgets.report.findings },
			reasons: recordedReasons(reasons),
			gates: Object.fromEntries(Object.entries(gates).map(([gate, list]) => [gate, outcome(list)])),
			failures
		});
	}

	private source(): VerificationRecord['source'] {
		const { commit, tree, baseCommit, baseRecord, requestedBase } = this.context;
		const widened = requestedBase && requestedBase !== baseCommit ? { requestedBase } : {};
		const proven = baseCommit && baseRecord ? { baseRecord } : {};
		return { commit, tree, base: baseCommit, ...proven, ...widened };
	}

	/** Each gate's failures, in the order they are reported. */
	private gates(
		input: AssemblyInput,
		judged: { budgets: { report: BudgetReport; ledger: string[] }; reasons: ReasonReport }
	): Record<string, string[]> {
		const { outcomes } = input.executed;
		return {
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

	/** Unchanged units with a performance budget that the change reaches through a dependency. */
	private budgeted(): ComponentManifest[] {
		const indirect = new Set(this.context.impact.units.indirect);
		return this.context.head.manifests.filter(
			(unit) => indirect.has(unit.id) && unit.budgets.performance.length > 0
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

	private async reasons(): Promise<ReasonReport> {
		const { base, head, root } = this.context;
		const known = await new ExplanationRepository(root).all();
		return new ExplanationService().report(requiredReasons(base, head), known);
	}
}

/** The snapshot must stay the exact commit: nothing changed, nothing removed, nothing added. */
function snapshotFailures(executed: Executed): string[] {
	const changed = executed.mutated.map((path) => `snapshot mutated during verification: ${path}`);
	const gained = executed.added.map(
		(path) => `snapshot gained an undeclared file during verification: ${path}`
	);
	return [...executed.setupFailures, ...changed, ...gained];
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

/** Performance and memory nothing measured are recorded as unavailable, never omitted. */
function unmeasured(unit: string, testedRevision: string): Measurement[] {
	const base = { unit, value: null, method: 'Not measured.', workload: null, profile: null };
	const absent = (metric: string, unitOfMeasure: string, unavailable: string): Measurement => ({
		...base,
		metric,
		unitOfMeasure,
		unavailable,
		testedRevision,
		artifacts: []
	});
	return [
		absent('latency-warm-ms', 'ms', 'No benchmark measured this unit in this verification.'),
		absent(
			'memory-bytes',
			'bytes',
			'No benchmark measured this unit, and in-process memory cannot be attributed to it.'
		)
	];
}
