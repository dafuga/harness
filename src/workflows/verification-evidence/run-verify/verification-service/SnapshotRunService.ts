import { SnapshotAdapter } from '../../../../adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import {
	verifyConfigFile,
	type VerifyConfig
} from '../../../../core/verification-evidence/verifyTypes';
import type { BuiltArtifacts } from '../../../../utils/development-tooling/unitMeasurements';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import {
	BuildIdentityService,
	type BuiltIdentity
} from '../../../../services/verification-evidence/BuildIdentityService';
import {
	CheckRunService,
	type CheckOutcome,
	type RunContext
} from './check-run-service/CheckRunService';

export interface SnapshotRun {
	root: string;
	config: VerifyConfig;
	/** Everything about the run except the snapshot directory, which is created here. */
	context: Omit<RunContext, 'snapshot'>;
}

export interface Executed {
	outcomes: CheckOutcome[];
	/** Tracked files that setup or a check changed or deleted. */
	mutated: string[];
	/** Files that appeared outside the declared outputs. */
	added: string[];
	setupFailures: string[];
	/** Each declared tool with the version it reported in the snapshot. */
	tools: Array<{ id: string; version: string }>;
	/** Declared artifacts that exist in the snapshot after the run, by path. */
	artifacts: BuiltArtifacts;
	/** Identity of each declared build as setup compiled it; undefined when none is declared. */
	builds?: BuiltIdentity[];
	/** Declared builds that are missing, or whose files changed while checks ran. */
	buildFailures: string[];
}

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
		const snapshot = await SnapshotAdapter.create(root, context.commit, config.outputs);
		const seen = { mutated: new Set<string>(), added: new Set<string>() };
		const observe = async (): Promise<void> => {
			const drift = await snapshot.drift();
			for (const path of drift.mutated) seen.mutated.add(path);
			for (const path of drift.added) seen.added.add(path);
		};
		try {
			for (const path of config.link) await snapshot.link(root, path);
			const runner = new CheckRunService({ ...context, snapshot: snapshot.directory });
			const misdeclared = snapshot.misdeclared().map(describeOutput);
			const setupFailures = misdeclared.length > 0 ? misdeclared : await this.setup(runner);
			const tools = setupFailures.length > 0 ? [] : await this.tools(runner, setupFailures);
			const compiled = await this.identities.declared(snapshot.directory, config.builds);
			await observe();
			const outcomes: CheckOutcome[] = [];
			for (const check of setupFailures.length > 0 ? [] : plan) {
				outcomes.push(await runner.run(check));
				await observe();
			}
			const artifacts = await built(snapshot, artifactPaths);
			const [mutated, added] = [[...seen.mutated].sort(), [...seen.added].sort()];
			const moved = await this.identities.changed(snapshot.directory, compiled.found);
			const builds = config.builds.length > 0 ? { builds: compiled.found } : {};
			const buildFailures = [...compiled.failures, ...moved];
			const observed = { outcomes, mutated, added, setupFailures, tools, artifacts };
			return { ...observed, ...builds, buildFailures };
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

	/** Setup runs under the same isolation and limits as any check. */
	private async setup(runner: CheckRunService): Promise<string[]> {
		const failures: string[] = [];
		for (const [index, step] of this.run.config.setup.entries()) {
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
