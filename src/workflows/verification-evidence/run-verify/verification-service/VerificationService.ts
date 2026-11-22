// @harness-uid u_k23ebybqw2
import type { ProfiledPlan, VerifyContext } from './VerificationService.types';
export type { VerifyContext } from './VerificationService.types';

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
import { judgeScenario } from './scenarioCoverage';
import { scopedCheck, scopedScenarios } from './entityScope';
import { referencedScenario } from './sealRecord';
import { SnapshotRunService } from './SnapshotRunService';
import { deferredInLite, deferredLiteCheck, verifyPlan } from './verifyPlan';

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
		const { plan, pendingChecks, referenced, rerun } = this.selection();
		const active = this.lite
			? rerun.filter((scenario) => plan.some((check) => check.scenario === scenario.id))
			: rerun;
		const needed = context.entity ? neededBuilds(active) : undefined;
		const executed = await this.snapshotRun(directory, needed).execute(plan, this.artifactPaths());
		const scenarios = rerun.map((scenario) =>
			judgeScenario(context, scenario, executed, pendingChecks)
		);
		const assembly = new RecordAssemblyService({
			...context,
			profile: this.profile,
			store: this.store
		});
		const lite = this.lite ? this.litePending(pendingChecks) : undefined;
		const record = await assembly.assemble({ startedAt, executed, scenarios, referenced, lite });
		context.signal?.throwIfAborted();
		await this.store.save(record, directory);
		return { record, directory };
	}

	/** Builds exactly the check list used by run(), without creating a snapshot or executing it. */
	plan(): PlannedCheck[] {
		return this.selection().plan;
	}

	/** Plans the runnable checks and lists the work deferred by Lite. */
	planWithPending(): ProfiledPlan {
		const { plan, pendingChecks } = this.selection();
		return { plan, pendingChecks };
	}

	private get lite(): boolean {
		return this.context.verificationProfile === 'lite';
	}

	private selection() {
		const { context } = this;
		const { entity } = context;
		const referenced = entity ? [] : referencedScenarios(context, this.store);
		const kept = new Set(referenced.map((scenario) => scenario.id));
		const rerun = entity
			? scopedScenarios(context.head.scenarios, entity)
			: context.head.scenarios.filter((scenario) => !kept.has(scenario.id));
		const checks = verifyPlan({
			selectedTests: entity ? [] : context.impact.tests.selected,
			scenarios: rerun,
			config: context.config,
			unitsConfig: context.head.config,
			testTimeoutMs: context.testTimeoutMs
		});
		const scoped = entity ? checks.map((check) => scopedCheck(check, entity)) : checks;
		const pendingChecks = this.lite ? scoped.filter(deferredLiteCheck) : [];
		const plan = this.lite ? scoped.filter((check) => !deferredLiteCheck(check)) : scoped;
		return { plan, pendingChecks, referenced, rerun };
	}

	private litePending(pending: PlannedCheck[]) {
		const { setup, tools } = this.context.config;
		return {
			pendingChecks: pending.map((check) => check.id),
			pendingSetup: setup.filter(deferredInLite).map((step) => step.command),
			pendingTools: tools.filter(deferredInLite).map((tool) => tool.id)
		};
	}

	/** Files that declared Wasm and process targets build, to be measured in the snapshot. */
	private artifactPaths(): string[] {
		const built = this.context.head.manifests.flatMap(emittedTargets);
		return [...new Set(built.map((target) => target.entry))];
	}

	/** A scoped run passes the builds its scenarios need; a full run passes none. */
	private snapshotRun(directory: string, needed?: ReadonlySet<string> | 'all'): SnapshotRunService {
		const { root, config, commit, tree, env, retainArtifact, signal } = this.context;
		const { lite } = this;
		const context = { directory, commit, tree, profile: this.profile.id, env, signal, lite };
		return new SnapshotRunService({ root, config, context, needed, retainArtifact });
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
