// @harness-uid u_k23ebybqw2
import type { VerifyContext } from './VerificationService.types';
export type { VerifyContext } from './VerificationService.types';

import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { ScenarioResult } from '../../../../core/verification-evidence/verificationTypes';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';

import {
	VerificationStoreRepository,
	type StoredRecord
} from '../../../../repositories/verification-evidence/VerificationStoreRepository';

import { machineProfile } from '../../../../utils/development-tooling/machineProfile';
import { emittedTargets } from '../../../../utils/development-tooling/unitMeasurements';

import { neededBuilds } from './buildScope';
import { RecordAssemblyService } from './record-assembly-service/RecordAssemblyService';
import { verificationScenarioCoverage } from './verificationScenarioCoverage';
import { scopeFailure } from './entityScope';
import { referencedScenario } from './sealRecord';
import { SnapshotRunService, type Executed } from './SnapshotRunService';
import { pendingVideoScenarioIds, pendingVideoSelection } from './pendingVideoSelection';

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
		const pending = await pendingVideoScenarioIds(context.root, context.head.scenarios);
		const { plan, referenced, rerun } = this.selection(pending);
		const needed = context.entity ? neededBuilds(rerun) : undefined;
		const executed = await this.snapshotRun(directory, needed, rerun).execute(
			plan,
			artifactPaths(context)
		);
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

	/** Builds exactly the check list used by run(), without creating a snapshot or executing it. */
	plan(): PlannedCheck[] {
		return this.selection().plan;
	}

	private selection(pending: ReadonlySet<string> = new Set()) {
		return pendingVideoSelection(
			this.context,
			this.context.entity ? [] : this.referenced(),
			pending
		);
	}

	/** A scoped run passes the builds its scenarios need; a full run passes none. */
	private snapshotRun(
		directory: string,
		needed?: ReadonlySet<string> | 'all',
		videos: ScenarioManifest[] = []
	): SnapshotRunService {
		const { root, config, commit, tree, env } = this.context;
		const context = { directory, commit, tree, profile: this.profile.id, env };
		return new SnapshotRunService({ root, config, context, needed, videos });
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
		const { own, coverage } = verificationScenarioCoverage(this.context, scenario, executed);
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
				states: coverage.states,
				...(coverage.videoCoverage ? { videoCoverage: coverage.videoCoverage } : {})
			},
			failures: [...failures, ...(this.context.entity ? [scopeFailure(this.context.entity)] : [])]
		};
	}
}

/** Files that declared Wasm and process targets build, to be measured in the snapshot. */
function artifactPaths(context: VerifyContext): string[] {
	const built = context.head.manifests.flatMap(emittedTargets);
	return [...new Set(built.map((target) => target.entry))];
}
