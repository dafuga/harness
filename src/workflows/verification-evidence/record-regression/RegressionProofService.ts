import type { RegressionRun, Observation } from './RegressionProofService.types';
import { focusedScreens } from './focusedScreens';
import { ScenarioRepository } from '../../../repositories/verification-evidence/ScenarioRepository';
import type { ScenarioManifest } from '../../../core/development-tooling/unitTypes';
import { benchmarkMeasurements } from '../run-verify/verification-service/record-assembly-service/sealRecord';
import { gatherCaptures } from '../run-verify/verification-service/check-run-service/gatherCaptures';
import { machineProfile } from '../../../utils/development-tooling/machineProfile';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { SnapshotAdapter } from '../../../adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import { fail } from '../../../core/development-tooling/errors';
import type {
	RegressionPhase,
	RegressionRecord
} from '../../../core/verification-evidence/regressionTypes';
import {
	defaultVerifyConfig,
	verifyConfigSchema
} from '../../../core/verification-evidence/verifyTypes';
import { RegressionProofRepository } from '../../../repositories/verification-evidence/RegressionProofRepository';
import { regressionHash } from '../../../utils/git-source-history/regressionHistory';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import { regressionFiles } from '../../../utils/verification-evidence/regressionFiles';
import { runIsolated } from '../../../utils/reports-media/run-isolated/runIsolated';

/** Run only the declared regression command, in the existing clean-snapshot mechanism. */
export class RegressionProofService {
	constructor(private readonly root: string) {}

	async run(input: RegressionRun): Promise<RegressionRecord> {
		const config = await snapshotConfig(this.root, input.commit);
		const snapshot = await SnapshotAdapter.create(this.root, input.commit, config.outputs);
		const directory = await mkdtemp(join(tmpdir(), 'harness-regression-'));
		try {
			if (snapshot.misdeclared().length) fail('Regression outputs may not cover tracked files.');
			for (const path of config.link) await snapshot.link(this.root, path);
			const observed = await observeRegression(snapshot, directory, input, config.scenarios);
			if (input.phase === 'capture' && !observed.captures.length && !observed.measurements.length)
				fail('A capture run must retain screenshots or benchmark observations.');
			const record = await sealRegression(this.root, input, observed);
			await new RegressionProofRepository(this.root).save(record, observed.output, observed.files);
			return record;
		} finally {
			await snapshot.remove();
			await rm(directory, { recursive: true, force: true });
		}
	}
}

async function sourceIdentity(root: string, commit: string) {
	const git = new GitAdapter(root);
	const tree = await git.run(['rev-parse', `${commit}^{tree}`]);
	const parent = await git.attempt(['rev-parse', '--verify', `${commit}^`]);
	if (!parent) return fail('A regression checkpoint needs a committed parent.');
	return { commit, tree, parent };
}

async function snapshotConfig(root: string, commit: string) {
	const tree = await CommitTreeAdapter.open(root, commit);
	const listed = (await tree.list()).some((entry) => entry.path === 'harness.verify.json');
	const config = listed
		? verifyConfigSchema.parse(JSON.parse(await tree.read('harness.verify.json')))
		: defaultVerifyConfig;
	const scenarios = await new ScenarioRepository(root).read(tree);
	if (scenarios.errors.length) fail(scenarios.errors.join('; '));
	return { ...config, scenarios: scenarios.manifests };
}

export function environmentProfile(
	source: Record<string, string | undefined> = process.env
): string {
	const volatile =
		/^(PWD|OLDPWD|_|SHLVL|XPC_SERVICE_NAME|HARNESS_AGENT_ID|HARNESS_VERIFY_REVISION|HARNESS_VERIFY_TREE|HARNESS_EVIDENCE_DIR|SCREENSHOT_LABEL)$/;
	const env = Object.fromEntries(
		Object.entries(source)
			.filter(([key]) => !volatile.test(key))
			.sort()
	);
	return `${process.platform}/${process.arch}/${process.versions.bun ?? process.version}/${regressionHash(canonicalJson(env))}`;
}

function checkResult(
	input: RegressionRun,
	result: Awaited<ReturnType<typeof runIsolated>>,
	output: string
) {
	if (invalidExecution(result))
		fail('A timeout, missing executable or unfinished process is not regression proof.');
	if (input.phase === 'green' && result.status !== 'passed')
		fail(`The unchanged regression must pass on the fix commit.\n${output.slice(-8000)}`);
	if (input.phase === 'red' && (result.exitCode === 0 || !output.includes(input.assertion)))
		fail(
			'The committed failing test must fail with the named assertion; setup errors do not prove the defect.'
		);
}

async function observeRegression(
	snapshot: SnapshotAdapter,
	directory: string,
	input: RegressionRun,
	scenarios: ScenarioManifest[]
): Promise<Observation> {
	const startedAt = new Date().toISOString(),
		profile = environmentProfile();
	if (input.red && profile !== input.red.profile)
		fail('Use the same regression environment and runtime.');
	const result = await runIsolated({
		command: 'sh',
		args: ['-c', input.command],
		cwd: snapshot.directory,
		env: {
			...process.env,
			HARNESS_ANALYTICS_DISABLED: '1',
			HARNESS_EVIDENCE_DIR: directory,
			TAKE_SCREENSHOT: '1',
			HARNESS_VERIFY_REVISION: input.commit
		},
		timeoutMs: input.timeoutMs,
		log: join(directory, 'output.log'),
		maxLogBytes: 2_000_000
	});
	const drift = await snapshot.drift();
	if (drift.mutated.length || drift.added.length)
		fail('The regression changed snapshot inputs or wrote undeclared outputs.');
	const output = await readFile(result.log.path);
	checkResult(input, result, output.toString('utf8'));
	const captures = gatherCaptures(directory, 'focused');
	if (captures.failures.length) fail(captures.failures.join('; '));
	const measurements = benchmarkMeasurements(captures.gathered, {
		profile: machineProfile().id,
		commit: input.commit
	});
	return {
		profile,
		startedAt,
		result,
		output,
		measurements,
		...(await focusedScreens(captures.gathered, directory, {
			commit: input.commit,
			scenarios,
			knownUnits: input.knownUnits
		}))
	};
}

async function sealRegression(
	root: string,
	input: RegressionRun,
	observed: Observation
): Promise<RegressionRecord> {
	const { profile, startedAt, result } = observed;
	const draft: Omit<RegressionRecord, 'id'> = {
		schemaVersion: 1,
		loop: input.loop,
		phase: input.phase,
		status: recordedStatus(input.phase, observed.result.exitCode),
		source: await sourceIdentity(root, input.commit),
		tests: input.tests,
		units: input.units,
		inputs: await regressionFiles(root, input.commit, input.tests),
		command: input.command,
		assertion: input.assertion,
		profile,
		startedAt,
		finishedAt: new Date().toISOString(),
		exitCode: result.exitCode!,
		...(observed.measurements.length ? { measurements: observed.measurements } : {}),
		...(observed.captures.length ? { captures: observed.captures } : {}),
		log: { ...result.log, path: 'output.log' },
		...(input.red ? { red: { commit: input.red.source.commit, record: input.red.id } } : {})
	};
	return { ...draft, id: regressionHash(canonicalJson(draft)) };
}

function recordedStatus(phase: RegressionPhase, exitCode: number | null): 'passed' | 'failed' {
	if (phase === 'capture') return exitCode === 0 ? 'passed' : 'failed';
	return phase === 'red' ? 'failed' : 'passed';
}

function invalidExecution(result: Awaited<ReturnType<typeof runIsolated>>): boolean {
	return (
		result.timedOut ||
		result.exitCode === null ||
		result.exitCode >= 126 ||
		result.survivors.length > 0 ||
		Boolean(result.unknown)
	);
}

export type { RegressionRun } from './RegressionProofService.types';
