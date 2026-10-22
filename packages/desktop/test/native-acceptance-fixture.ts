import { mkdir, mkdtemp, readFile, rename, rm, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GitAdapter } from '../../../src/adapters/GitAdapter';
import { SnapshotAdapter } from '../../../src/adapters/snapshot-adapter/SnapshotAdapter';
import { profileEnvironment } from '../../../src/adapters/source-profile-adapter/runnerSelection';
import { runIsolated } from '../../../src/utils/run-isolated/runIsolated';
import { measureProcess } from '../../../test/support/cli-measurement/measureHarness';
import { gatherCaptures } from '../../../src/utils/gatherCaptures';
import { benchmarkCaptureSchema } from '../../../src/core/verifyTypes';
import { recordCapture } from '../../../src/utils/record-capture/recordCapture';
import { randomUUID } from 'node:crypto';

const repository = resolve(import.meta.dirname, '../../..');

/** A nested export protects the parent verification's compiled, stamped desktop renderer. */
async function sourceSnapshot() {
	const git = new GitAdapter(repository);
	const commit = process.env.HARNESS_VERIFY_REVISION ?? (await git.run(['rev-parse', 'HEAD']));
	const objects =
		process.env.HARNESS_VERIFY_GIT_OBJECTS ??
		(await git.run(['rev-parse', '--path-format=absolute', '--git-path', 'objects']));
	const format =
		process.env.HARNESS_VERIFY_GIT_OBJECT_FORMAT ??
		(await git.run(['rev-parse', '--show-object-format']));
	await mkdir(join(repository, '.cache'), { recursive: true });
	const metadata = await mkdtemp(join(repository, '.cache/native-source-'));
	try {
		const selected = new GitAdapter(metadata);
		await selected.run(['init', '--bare', `--object-format=${format}`, '.']);
		await writeFile(join(metadata, 'objects/info/alternates'), objects + '\n');
		await selected.run(['update-ref', '--no-deref', 'HEAD', commit]);
		await selected.run(['read-tree', 'HEAD']);
		const tree = await selected.run(['rev-parse', 'HEAD^{tree}']);
		if (process.env.HARNESS_VERIFY_TREE && process.env.HARNESS_VERIFY_TREE !== tree)
			throw new Error('Native acceptance selected a different source tree');
		const config = JSON.parse(await readFile(join(repository, 'harness.verify.json'), 'utf8'));
		const snapshot = await SnapshotAdapter.create(metadata, commit, [...config.outputs, 'work/']);
		const held = join(snapshot.directory, '.cache/native-source.git');
		await mkdir(join(snapshot.directory, '.cache'), { recursive: true });
		await rename(metadata, held);
		return { snapshot, commit, tree, metadata: held };
	} finally {
		await rm(metadata, { recursive: true, force: true });
	}
}

/** Actual native workflow, with its own outputs; no physical camera, phone or deployment. */
export async function nativeAcceptance() {
	const source = await sourceSnapshot();
	const parent = process.env.HARNESS_EVIDENCE_DIR ?? join(repository, '.cache/native-acceptance');
	await mkdir(parent, { recursive: true });
	const evidence = await mkdtemp(join(parent, 'simulator-'));
	const env = {
		...process.env,
		HARNESS_VERIFY_REVISION: source.commit,
		HARNESS_VERIFY_TREE: source.tree,
		HARNESS_NATIVE_SOURCE_GIT_DIR: source.metadata,
		...profileEnvironment(source.snapshot.directory, join(evidence, 'profiles'))
	};
	try {
		for (const [name, command] of [
			['install', 'bun install --frozen-lockfile --backend=copyfile'],
			['sync', 'bun run sync:workspaces']
		])
			await prepare(source.snapshot.directory, evidence, env, { name, command });
		const result = await observedAcceptance(source.snapshot.directory, evidence, env);
		console.info(result.stdout);
		if (result.exitCode !== 0) throw new Error(result.stdout + result.stderr);
		const report = JSON.parse(await readFile(join(evidence, 'artifacts/report.json'), 'utf8'));
		const drift = await source.snapshot.drift();
		await writeFile(join(evidence, 'drift.json'), JSON.stringify(drift));
		const profileUnits = await retainProfiles(join(evidence, 'profiles'));
		return { report, drift, profileUnits, commit: source.commit, tree: source.tree };
	} finally {
		await source.snapshot.remove();
	}
}

/** Forward unchanged observations from the same-commit child, keeping its raw sink as well. */
async function retainProfiles(directory: string) {
	const found = gatherCaptures(directory, 'native-profiles');
	if (found.failures.length) throw new Error(found.failures.join('; '));
	const complete = new Set<string>();
	const destination = process.env.HARNESS_RUNTIME_PROFILE_DIR ?? process.env.HARNESS_EVIDENCE_DIR;
	for (const capture of found.gathered.filter((item) => item.line.kind === 'benchmark')) {
		const { measurements } = benchmarkCaptureSchema.parse(capture.benchmark);
		for (const reading of measurements.filter((item) => item.unitOfMeasure === 'ms'))
			if (
				measurements.some(
					(item) =>
						item.unit === reading.unit &&
						item.workload === reading.workload &&
						item.unitOfMeasure === 'bytes'
				)
			)
				complete.add(reading.unit);
		if (destination)
			recordCapture(
				{
					evidence: 'native-source-profiles',
					state: 'native-profile',
					kind: 'benchmark',
					file: `native-source-${randomUUID()}.json`,
					mediaType: 'application/json'
				},
				await readFile(join(directory, capture.line.file)),
				{
					...process.env,
					TAKE_SCREENSHOT: '1',
					HARNESS_EVIDENCE_DIR: destination
				}
			);
	}
	return [...complete].sort();
}

async function prepare(
	cwd: string,
	evidence: string,
	env: NodeJS.ProcessEnv,
	step: { name: string; command: string }
) {
	const result = await runIsolated({
		command: 'sh',
		args: ['-c', step.command],
		cwd,
		env,
		timeoutMs: 600000,
		maxLogBytes: 2_000_000,
		log: join(evidence, step.name + '.log')
	});
	if (result.status !== 'passed') throw new Error(await readFile(result.log.path, 'utf8'));
}

async function observedAcceptance(root: string, evidence: string, environment: NodeJS.ProcessEnv) {
	const env = Object.fromEntries(
		Object.entries(environment).filter(
			(entry): entry is [string, string] => typeof entry[1] === 'string'
		)
	);
	try {
		return await measureProcess(
			{
				units: ['desktop.script.ios-acceptance'],
				workload: 'actual-simulator-acceptance-synthetic-scanner',
				target: 'module',
				command: ['bun', 'run', 'ios:acceptance'],
				cwd: join(root, 'packages/desktop'),
				env,
				partial:
					'Actual task-owned simulator with synthetic scanner and local fixture computer. Includes builds and inspector overhead; excludes physical camera, phone and deployed servers.'
			},
			async (command, cwd) => {
				const result = await runIsolated({
					command: command[0],
					args: command.slice(1),
					cwd,
					env,
					timeoutMs: 900000,
					maxLogBytes: 2_000_000,
					log: join(evidence, 'acceptance.log')
				});
				if (result.status !== 'passed') throw new Error(await readFile(result.log.path, 'utf8'));
				return {
					exitCode: result.exitCode ?? 1,
					stdout: await readFile(result.log.path, 'utf8'),
					stderr: ''
				};
			}
		);
	} finally {
		const artifacts = join(root, 'work/mobile/ios-acceptance');
		if (existsSync(artifacts))
			await cp(artifacts, join(evidence, 'artifacts'), { recursive: true });
	}
}
