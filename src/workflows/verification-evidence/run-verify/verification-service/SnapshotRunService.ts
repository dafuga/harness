// @harness-uid u_x7kddegtw2
import type { SnapshotRun, Executed } from './SnapshotRunService.types';
import { SnapshotAdapter } from '../../../../adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import { verifyConfigFile } from '../../../../core/verification-evidence/verifyTypes';
import type { BuiltArtifacts } from '../../../../utils/development-tooling/unitMeasurements';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import { BuildIdentityService } from '../../../../services/verification-evidence/BuildIdentityService';
import type { CheckRunService, CheckOutcome } from './check-run-service/CheckRunService';
import type { CaptureLimits } from './check-run-service/captureLimits.types';
import { scopedSetup } from './buildScope';
import { snapshotDriftObserver, snapshotVideoRun } from './snapshotVideoRun';

/**
 * Exports the commit and runs setup and every check inside the export. The export is compared
 * with the commit after setup and after each check, so a change that a later check undoes is
 * still seen and every capture was taken from the exact tested source.
 */
export class SnapshotRunService {
	private readonly identities = new BuildIdentityService();

	constructor(private readonly run: SnapshotRun) {}

	async execute(plan: PlannedCheck[], artifactPaths: string[] = []): Promise<Executed> {
		const { root, config, context, needed = 'all' } = this.run;
		const snapshot = await SnapshotAdapter.create(root, context.commit, config.outputs);
		const seen = { mutated: new Set<string>(), added: new Set<string>() };
		const observe = snapshotDriftObserver(snapshot, seen);
		try {
			for (const path of config.link) await snapshot.link(root, path);
			const { runner, failures, videoInputs } = await snapshotVideoRun(
				this.run,
				snapshot.directory,
				captureLimits(config)
			);
			const misdeclared = [...snapshot.misdeclared().map(describeOutput), ...failures];
			const setupFailures = misdeclared.length > 0 ? misdeclared : await this.setup(runner, needed);
			const tools = setupFailures.length > 0 ? [] : await this.tools(runner, setupFailures);
			const wanted = config.builds.filter((build) => needed === 'all' || needed.has(build.id));
			const compiled = await this.identities.declared(snapshot.directory, wanted);
			await observe();
			const outcomes = await checkedSnapshot(runner, plan, setupFailures, observe);
			const artifacts = await built(snapshot, artifactPaths);
			const [mutated, added] = [[...seen.mutated].sort(), [...seen.added].sort()];
			const moved = await this.identities.changed(snapshot.directory, compiled.found);
			const builds = config.builds.length > 0 ? { builds: compiled.found } : {};
			const observed = { outcomes, mutated, added, setupFailures, tools, artifacts };
			return {
				...observed,
				...videoInputs,
				...builds,
				...skippedBuilds(config, needed),
				buildFailures: [...compiled.failures, ...moved]
			};
		} finally {
			await snapshot.remove();
		}
	}

	/** A declared tool that cannot say what it is counts as failed setup: nothing runs after it. */
	private async tools(
		runner: CheckRunService,
		failures: string[]
	): Promise<Array<{ id: string; version: string }>> {
		const found: Array<{ id: string; version: string }> = [];
		for (const tool of this.run.config.tools) {
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
function skippedBuilds(
	config: SnapshotRun['config'],
	needed: ReadonlySet<string> | 'all'
): { skippedBuilds?: string[] } {
	const skipped = config.builds.filter((build) => needed !== 'all' && !needed.has(build.id));
	return needed === 'all' ? {} : { skippedBuilds: skipped.map((build) => build.id) };
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

/** Observe drift after each check, including a failing check before another could undo it. */
async function checkedSnapshot(
	runner: CheckRunService,
	plan: PlannedCheck[],
	failures: string[],
	observe: () => Promise<void>
): Promise<CheckOutcome[]> {
	const outcomes: CheckOutcome[] = [];
	for (const check of failures.length > 0 ? [] : plan) {
		outcomes.push(await runner.run(check));
		await observe();
	}
	return outcomes;
}
