import type { VerifyContext } from './VerificationService.types';
export type { VerifyContext } from './VerificationService.types';

import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { ScenarioResult } from '../../../../core/verification-evidence/verificationTypes';

import {
	VerificationStoreRepository,
	type StoredRecord
} from '../../../../repositories/verification-evidence/VerificationStoreRepository';

import { machineProfile } from '../../../../utils/development-tooling/machineProfile';
import { emittedTargets } from '../../../../utils/development-tooling/unitMeasurements';

import { RecordAssemblyService } from './record-assembly-service/RecordAssemblyService';
import { scenarioCoverage } from './scenarioCoverage';
import { referencedScenario } from './sealRecord';
import { SnapshotRunService, type Executed } from './SnapshotRunService';
import { verifyPlan } from './verifyPlan';

/** Verifies one exact commit in a clean snapshot and writes the record, whatever the outcome. */
export class VerificationService {
	private readonly store: VerificationStoreRepository;
	private readonly profile = machineProfile();

	constructor(private readonly context: VerifyContext) {
		this.store = new VerificationStoreRepository(context.root);
	}

	async run(): Promise<StoredRecord> {
		const { context } = this;
		const startedAt = new Date().toISOString();
		const directory = this.store.directoryFor(context.commit, startedAt);
		const referenced = this.referenced();
		const kept = new Set(referenced.map((scenario) => scenario.id));
		const rerun = context.head.scenarios.filter((scenario) => !kept.has(scenario.id));
		const plan = verifyPlan({
			selectedTests: context.impact.tests.selected,
			scenarios: rerun,
			config: context.config,
			unitsConfig: context.head.config,
			testTimeoutMs: context.testTimeoutMs
		});
		const executed = await this.snapshotRun(directory).execute(plan, this.artifactPaths());
		const scenarios = rerun.map((scenario) => this.judge(scenario, executed));
		const assembly = new RecordAssemblyService({
			...context,
			profile: this.profile,
			store: this.store
		});
		const record = await assembly.assemble({ startedAt, executed, scenarios, referenced });
		await this.store.save(record, directory);
		return { record, directory };
	}

	/** Files that declared Wasm and process targets build, to be measured in the snapshot. */
	private artifactPaths(): string[] {
		const built = this.context.head.manifests.flatMap(emittedTargets);
		return [...new Set(built.map((target) => target.entry))];
	}

	private snapshotRun(directory: string): SnapshotRunService {
		const { root, config, commit, tree, env } = this.context;
		const context = { directory, commit, tree, profile: this.profile.id, env };
		return new SnapshotRunService({ root, config, context });
	}

	/**
	 * Unaffected scenarios keep the evidence of the revision that last tested them, but only when
	 * the base commit itself has a record; otherwise nothing proves they were unaffected since.
	 */
	private referenced(): ScenarioResult[] {
		const { baseRecord, impact, head } = this.context;
		const prior = baseRecord ? this.store.load(baseRecord)?.record : undefined;
		const affected = new Set(impact.scenarios.affected);
		if (!prior) return [];
		return head.scenarios.flatMap((scenario) =>
			affected.has(scenario.id) ? [] : (referencedScenario(prior, scenario.id) ?? [])
		);
	}

	private judge(
		scenario: ScenarioManifest,
		executed: Executed
	): { result: ScenarioResult; failures: string[] } {
		const own = executed.outcomes.filter((outcome) => outcome.check.scenario === scenario.id);
		const compiled = (executed.builds ?? []).map((build) => [build.id, build.buildId] as const);
		const coverage = scenarioCoverage({
			scenario,
			commit: this.context.commit,
			gathered: own.flatMap((outcome) => outcome.gathered),
			checkFailed: own.some((outcome) => !outcome.passed),
			builds: {
				declared: this.context.config.builds.map((build) => build.id),
				compiled: new Map(compiled)
			}
		});
		const ran = own.length === scenario.tests.length;
		const failures = [
			...own.flatMap((outcome) => outcome.failures),
			...coverage.failures,
			...(ran ? [] : [`${scenario.id}: its checks did not run`])
		];
		return {
			result: {
				id: scenario.id,
				status: failures.length === 0 ? 'passed' : 'failed',
				testedRevision: this.context.commit,
				states: coverage.states
			},
			failures
		};
	}
}
