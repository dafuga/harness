// @harness-uid u_x7kddegtw2
import type { SnapshotRun, Executed } from './SnapshotRunService.types';
import { SnapshotAdapter } from '../../../../adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import { verifyConfigFile } from '../../../../core/verification-evidence/verifyTypes';
import type { BuiltArtifacts } from '../../../../utils/development-tooling/unitMeasurements';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import { BuildIdentityService } from '../../../../services/verification-evidence/BuildIdentityService';
import { CheckRunService, type CheckOutcome } from './check-run-service/CheckRunService';
import type { CaptureLimits } from './check-run-service/captureLimits.types';
import { scopedSetup } from './buildScope';
import { deferredInLite } from './verifyPlan';

/**
 * Exports the commit and runs setup and every check inside the export. The export is compared
 * with the commit after setup and after each check, so a change that a later check undoes is
 * still seen and every capture was taken from the exact tested source.
 */
export class SnapshotRunService {
	private readonly identities = new BuildIdentityService();

	constructor(private readonly run: SnapshotRun) {}

	async execute(plan: PlannedCheck[], artifactPaths: string[] = []): Promise<Executed> {
		const { root, config, context } = this.run;
		const needed = this.buildsToIdentify(this.run.needed ?? 'all');
		const snapshot = await SnapshotAdapter.create(root, context.commit, config.outputs);
		const seen = { mutated: new Set<string>(), added: new Set<string>() };
		const observe = async (): Promise<void> => {
			const drift = await snapshot.drift();
			for (const path of drift.mutated) seen.mutated.add(path);
			for (const path of drift.added) seen.added.add(path);
		};
		try {
			for (const path of config.link) await snapshot.link(root, path);
			const limits = captureLimits(config);
			const runner = new CheckRunService({ ...context, snapshot: snapshot.directory, limits });
			const misdeclared = snapshot.misdeclared().map(describeOutput);
			const setupFailures = misdeclared.length > 0 ? misdeclared : await this.setup(runner, needed);
			const tools = setupFailures.length > 0 ? [] : await this.tools(runner, setupFailures);
			const wanted = config.builds.filter((build) => needed === 'all' || needed.has(build.id));
			const compiled = await this.identities.declared(snapshot.directory, wanted);
			await observe();
			const outcomes: CheckOutcome[] = [];
			for (const check of setupFailures.length > 0 ? [] : plan) {
				outcomes.push(await runner.run(check));
				await observe();
			}
			const artifacts = await built(snapshot, artifactPaths);
			const [mutated, added] = [[...seen.mutated].sort(), [...seen.added].sort()];
			const moved = await this.identities.changed(snapshot.directory, compiled.found);
			const buildFailures = [...compiled.failures, ...moved];
			const observed = { outcomes, mutated, added, setupFailures, tools, artifacts };
			return { ...observed, ...recordedBuilds(config, needed, compiled.found), buildFailures };
		} finally {
			await snapshot.remove();
		}
	}

	private buildsToIdentify(needed: ReadonlySet<string> | 'all'): ReadonlySet<string> | 'all' {
		const { config, context } = this.run;
		if (!context.lite) return needed;
		const deferred = new Set(
			config.setup.filter(deferredInLite).flatMap((step) => step.builds ?? [])
		);
		if (deferred.size === 0) return needed;
		return new Set(
			config.builds
				.map((build) => build.id)
				.filter((id) => (needed === 'all' || needed.has(id)) && !deferred.has(id))
		);
	}

	/** A declared tool that cannot say what it is counts as failed setup: nothing runs after it. */
	private async tools(
		runner: CheckRunService,
		failures: string[]
	): Promise<Array<{ id: string; version: string }>> {
		const found: Array<{ id: string; version: string }> = [];
		for (const tool of this.run.config.tools) {
			if (this.run.context.lite && deferredInLite(tool)) continue;
			const version = await runner.version(tool);
			if (version) found.push({ id: tool.id, version });
			else failures.push(`tool ${tool.id} did not report a version: ${tool.command}`);
		}
		return failures.length > 0 ? [] : found;
	}

	/** Setup runs under the same isolation and limits as any check; a scoped run skips the rest. */
	private async setup(
		runner: CheckRunService,
		needed: ReadonlySet<string> | 'all'
	): Promise<string[]> {
		const failures: string[] = [];
		const kept = new Set(scopedSetup(this.run.config.setup, needed));
		for (const [index, step] of this.run.config.setup.entries()) {
			if (!kept.has(step)) continue;
			if (this.run.context.lite && deferredInLite(step)) continue;
			const outcome = await runner.run({
				id: `setup-${index + 1}`,
				name: step.command,
				kind: 'unit',
				runner: 'command',
				target: step.command,
				cwd: '.',
				command: step.command,
				timeoutMs: step.timeoutMs ?? this.run.config.timeouts.test
			});
			if (!outcome.passed) failures.push(`setup command failed: ${step.command}`);
		}
		return failures;
	}
}

/** The optional byte caps of the config, leaving out any it does not declare. */
function captureLimits(config: SnapshotRun['config']): CaptureLimits {
	const { maxCaptureBytes, maxRecordBytes } = config;
	return {
		...(maxCaptureBytes === undefined ? {} : { maxCaptureBytes }),
		...(maxRecordBytes === undefined ? {} : { maxRecordBytes })
	};
}

/** The declared builds a scoped run did not need, by id. A run that is not scoped skips none. */
function recordedBuilds(
	config: SnapshotRun['config'],
	needed: ReadonlySet<string> | 'all',
	found: NonNullable<Executed['builds']>
): Pick<Executed, 'builds' | 'skippedBuilds'> {
	const skipped = config.builds.filter((build) => needed !== 'all' && !needed.has(build.id));
	return {
		...(config.builds.length > 0 ? { builds: found } : {}),
		...(needed === 'all' ? {} : { skippedBuilds: skipped.map((build) => build.id) })
	};
}

/** An output declaration that covers tracked files would hide source, so nothing runs. */
function describeOutput(found: { output: string; file: string }): string {
	return (
		`${verifyConfigFile} declares output "${found.output}", which covers tracked files such as ` +
		`${found.file}; outputs may only name generated paths`
	);
}

async function built(snapshot: SnapshotAdapter, paths: string[]): Promise<BuiltArtifacts> {
	const artifacts: BuiltArtifacts = {};
	for (const path of paths) {
		const artifact = await snapshot.artifact(path);
		if (artifact) artifacts[path] = artifact;
	}
	return artifacts;
}

export type { SnapshotRun, Executed } from './SnapshotRunService.types';
