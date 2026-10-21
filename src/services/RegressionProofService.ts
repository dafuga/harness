import { focusedScreens } from './regression-proof-service/focusedScreens';
import { ScenarioRepository } from '../repositories/ScenarioRepository';
import type { ScenarioManifest } from '../core/unitTypes';
import { benchmarkMeasurements } from './record-assembly-service/sealRecord';
import { gatherCaptures } from '../utils/gatherCaptures';
import { machineProfile } from '../utils/machineProfile';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import { SnapshotAdapter } from '../adapters/snapshot-adapter/SnapshotAdapter';
import { fail } from '../core/errors';
import type { RegressionPhase, RegressionRecord } from '../core/regressionTypes';
import { defaultVerifyConfig, verifyConfigSchema } from '../core/verifyTypes';
import { RegressionProofRepository } from '../repositories/RegressionProofRepository';
import { regressionHash } from '../utils/regressionHistory';
import { canonicalJson } from '../utils/canonicalJson';
import { regressionFiles } from '../utils/regressionFiles';
import { runIsolated } from '../utils/run-isolated/runIsolated';

export interface RegressionRun {
	commit: string;
	loop: string;
	phase: RegressionPhase;
	tests: string[];
	units: string[];
	command: string;
	assertion: string;
	timeoutMs: number;
	red?: RegressionRecord;
}

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

function environmentProfile(): string {
	const volatile =
		/^(PWD|OLDPWD|_|SHLVL|HARNESS_AGENT_ID|HARNESS_VERIFY_REVISION|HARNESS_VERIFY_TREE|HARNESS_EVIDENCE_DIR|SCREENSHOT_LABEL)$/;
	const env = Object.fromEntries(
		Object.entries(process.env)
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
		fail('The unchanged regression must pass on the fix commit.');
	if (input.phase === 'red' && (result.exitCode === 0 || !output.includes(input.assertion)))
		fail(
			'The committed failing test must fail with the named assertion; setup errors do not prove the defect.'
		);
}

interface Observation {
	profile: string;
	startedAt: string;
	result: Awaited<ReturnType<typeof runIsolated>>;
	output: Buffer;
	measurements: NonNullable<RegressionRecord['measurements']>;
	captures: NonNullable<RegressionRecord['captures']>;
	files: Array<{ path: string; bytes: Buffer }>;
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
		...(await focusedScreens(captures.gathered, directory, { commit: input.commit, scenarios }))
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
		status: input.phase === 'red' ? 'failed' : 'passed',
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

function invalidExecution(result: Awaited<ReturnType<typeof runIsolated>>): boolean {
	return (
		result.timedOut ||
		result.exitCode === null ||
		result.exitCode >= 126 ||
		result.survivors.length > 0 ||
		Boolean(result.unknown)
	);
}
