// @harness-uid u_k23ebybqw2
import type { VerifyContext } from './VerificationService.types';
export type { VerifyContext } from './VerificationService.types';

import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { ScenarioResult } from '../../../../core/verification-evidence/verificationTypes';
import { retainedArtifactPath } from '../../../../core/verification-evidence/verificationTypes';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';

import {
	VerificationStoreRepository,
	type StoredRecord
} from '../../../../repositories/verification-evidence/VerificationStoreRepository';

import { machineProfile } from '../../../../utils/development-tooling/machineProfile';
import { emittedTargets } from '../../../../utils/development-tooling/unitMeasurements';

import { neededBuilds } from './buildScope';
import { RecordAssemblyService } from './record-assembly-service/RecordAssemblyService';
import { scenarioCoverage } from './scenarioCoverage';
import { scopedCheck, scopedScenarios, scopeFailure } from './entityScope';
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
		const plannedDirectory = this.store.directoryFor(context.commit, startedAt);
		if (context.retainArtifact === undefined) return this.runAt(plannedDirectory, startedAt);
		return runWithRetainedArtifact(plannedDirectory, (directory) =>
			this.runAt(directory, startedAt)
		);
	}

	private async runAt(directory: string, startedAt: string): Promise<StoredRecord> {
		const { context } = this;
		const { plan, referenced, rerun } = this.selection();
		const needed = context.entity ? neededBuilds(rerun) : undefined;
		const executed = await this.snapshotRun(directory, needed).execute(plan, this.artifactPaths());
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

	private selection() {
		const { context } = this;
		const { entity } = context;
		const referenced = entity ? [] : referencedScenarios(context, this.store);
		const kept = new Set(referenced.map((scenario) => scenario.id));
		const rerun = entity
			? scopedScenarios(context.head.scenarios, entity)
			: context.head.scenarios.filter((scenario) => !kept.has(scenario.id));
		const planned = verifyPlan({
			selectedTests: entity ? [] : context.impact.tests.selected,
			scenarios: rerun,
			config: context.config,
			unitsConfig: context.head.config,
			testTimeoutMs: context.testTimeoutMs
		});
		return {
			plan: entity ? planned.map((check) => scopedCheck(check, entity)) : planned,
			referenced,
			rerun
		};
	}

	/** Files that declared Wasm and process targets build, to be measured in the snapshot. */
	private artifactPaths(): string[] {
		const built = this.context.head.manifests.flatMap(emittedTargets);
		return [...new Set(built.map((target) => target.entry))];
	}

	/** A scoped run passes the builds its scenarios need; a full run passes none. */
	private snapshotRun(directory: string, needed?: ReadonlySet<string> | 'all'): SnapshotRunService {
		const { root, config, commit, tree, env, retainArtifact } = this.context;
		const context = { directory, commit, tree, profile: this.profile.id, env };
		return new SnapshotRunService({ root, config, context, needed, retainArtifact });
	}

	private judge(
		scenario: ScenarioManifest,
		executed: Executed
	): { result: ScenarioResult; failures: string[] } {
		const own = executed.outcomes.filter((outcome) => outcome.check.scenario === scenario.id);
		const compiled = (executed.builds ?? []).map((build) => [build.id, build.buildId] as const);
		const builds = {
			declared: this.context.config.builds.map((build) => build.id),
			compiled: new Map(compiled),
			skipped: new Set(executed.skippedBuilds ?? [])
		};
		const coverage = scenarioCoverage({
			scenario,
			commit: this.context.commit,
			gathered: own.flatMap((outcome) => outcome.gathered),
			checkFailed: own.some((outcome) => !outcome.passed),
			builds
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
			failures: [...failures, ...(this.context.entity ? [scopeFailure(this.context.entity)] : [])]
		};
	}
}

async function runWithRetainedArtifact(
	plannedDirectory: string,
	run: (directory: string) => Promise<StoredRecord>
): Promise<StoredRecord> {
	const directory = `${plannedDirectory}-export-${randomUUID()}`;
	let retained = false;
	try {
		const result = await run(directory);
		retained = result.record.status === 'passed' && result.record.retainedArtifact !== undefined;
		return result;
	} finally {
		if (!retained) await rm(join(directory, retainedArtifactPath), { force: true });
	}
}

/**
 * Unaffected scenarios keep the evidence of the revision that last tested them, but only when
 * the base commit itself has a record; otherwise nothing proves they were unaffected since.
 */
function referencedScenarios(
	context: VerifyContext,
	store: VerificationStoreRepository
): ScenarioResult[] {
	const { baseRecord, impact, head } = context;
	const prior = baseRecord ? store.load(baseRecord)?.record : undefined;
	const affected = new Set(impact.scenarios.affected);
	if (!prior) return [];
	return head.scenarios.flatMap((scenario) =>
		affected.has(scenario.id) ? [] : (referencedScenario(prior, scenario.id) ?? [])
	);
}
