import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { runCommand, runHarness, type CommandResult } from './cli';
import { projectAt, unitProject, type UnitProject } from './unitProject';
import { fixtureScenarios, fixtureSources } from './verifyFixture';

export interface VerifyOutcome {
	exitCode: number;
	stderr: string;
	record: VerificationRecord;
	/** Scratch directory holding the record, evidence and logs. */
	directory: string;
}

export interface VerifyRepo extends UnitProject {
	git(args: string[]): Promise<string>;
	commit(message: string): Promise<string>;
	/** Explains every currently required change with one generic reason. */
	explainAll(range?: string[]): Promise<void>;
	verify(args?: string[], env?: Record<string, string>): Promise<VerifyOutcome>;
	/** Edits, explains and commits one file, returning the new commit. */
	change(path: string, edit: (source: string) => string): Promise<string>;
	run(args: string[], env?: Record<string, string>): Promise<CommandResult>;
	dispose(): Promise<void>;
}

export const reviewer = ['--reviewer', 'Reviewer One', '--reason', 'Reviewed fixture change'];
export const reason = [
	'--behavior',
	'Fixture change.',
	'--simplification',
	'Nothing simpler was found.',
	'--simplification-outcome',
	'not-improved',
	'--performance',
	'No hot path is touched.',
	'--performance-outcome',
	'not-applicable'
];
const identity = [
	'-c',
	'user.name=Harness Fixture',
	'-c',
	'user.email=fixture@harness.invalid',
	'-c',
	'commit.gpgsign=false'
];

export function repoAt(root: string): VerifyRepo {
	const project = projectAt(root);
	const git = async (args: string[]) =>
		(await runCommand(['git', ...identity, ...args], root)).stdout.trim();
	const commit = async (message: string) => {
		await git(['add', '-A']);
		await git(['commit', '-q', '-m', message]);
		return git(['rev-parse', 'HEAD']);
	};
	const explainAll = async (range: string[] = []) => {
		await project.harness(['explain', 'add', '--all', ...reason, ...range]);
	};
	return {
		...project,
		git,
		commit,
		explainAll,
		run: (args, env = {}) => projectHarness(root, args, env),
		async verify(args = [], env = {}) {
			const result = await projectHarness(root, ['verify', 'run', '--json', ...args], env);
			const parsed = JSON.parse(result.stdout) as { record: VerificationRecord; directory: string };
			return { exitCode: result.exitCode, stderr: result.stderr, ...parsed };
		},
		async change(path, edit) {
			await project.write(path, edit(await project.read(path)));
			await project.harness(['units', 'index', '--write']);
			await explainAll();
			return commit(`feat: change ${path}`);
		},
		dispose: () => rm(join(root, '..'), { recursive: true, force: true })
	};
}

function projectHarness(root: string, args: string[], env: Record<string, string>) {
	return runHarness(args, root, false, env);
}

/**
 * A committed fixture whose second commit establishes every baseline, so it verifies clean.
 * `extend` may add more source before the first commit.
 */
export async function baselineRepo(
	extend: (repo: VerifyRepo) => Promise<void> = () => Promise.resolve()
): Promise<VerifyRepo> {
	const project = await unitProject('lib');
	const repo = repoAt(project.root);
	for (const [path, contents] of Object.entries(fixtureSources)) await repo.write(path, contents);
	for (const scenario of fixtureScenarios) {
		await repo.write(`specification/scenarios/${scenario.id}.json`, JSON.stringify(scenario));
	}
	await repo.harness(['units', 'index', '--write']);
	const title = 'specification/units/service.title.json';
	const manifest = await repo.json<{ budgets: object }>(title);
	const performance = [{ workload: 'titles-1k', metric: 'latency-warm-ms', tolerance: 0.05 }];
	await repo.write(
		title,
		JSON.stringify({ ...manifest, budgets: { ...manifest.budgets, performance } })
	);
	await repo.harness(['units', 'index', '--write']);
	await extend(repo);
	await repo.git(['init', '-q', '-b', 'main']);
	await repo.commit('feat: fixture');
	await repo.explainAll(['--base', 'none', '--head', 'HEAD']);
	const first = await repo.verify();
	await repo.harness(['budget', 'establish', '--all', '--record', first.record.id, ...reviewer]);
	await repo.commit('chore: establish baselines');
	await repo.verify();
	return repo;
}

/** An independent copy of a prepared repository, including its scratch records. */
export async function cloneRepo(source: VerifyRepo): Promise<VerifyRepo> {
	const parent = await mkdtemp(join(tmpdir(), 'harness-verify-'));
	await cp(source.root, join(parent, 'demo'), { recursive: true });
	return repoAt(join(parent, 'demo'));
}
