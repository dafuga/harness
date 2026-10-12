import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand, type CommandResult } from './cli';
import { firstMessageHook, legacyCommandLine, legacyPrePush } from './legacyHooks';

export interface StageStatus {
	stage: string;
	installed: boolean;
	chained: boolean;
	enabled: boolean;
}
export interface SharedStatus {
	installed: boolean;
	enabled: boolean;
	stages: StageStatus[];
}
/** One worktree of the repository whose hooks directory all of them share. */
export interface Worktree {
	root: string;
	/** Its own Git directory, where an opt-in is kept. */
	gitDir: string;
	run(args: string[]): Promise<CommandResult>;
	/** Makes an empty commit as a person does, with the hooks Git runs for one. */
	commit(message: string): Promise<CommandResult>;
	/** Pushes the branch that is checked out, with the hook Git runs for a push. */
	push(): Promise<CommandResult>;
	head(): Promise<string>;
	/** Asks the Harness under test, started in this worktree, and reads what it printed. */
	harness(...args: string[]): Promise<SharedStatus>;
	/** The files that opt this worktree into a stage. */
	optIns(): Promise<string[]>;
}
export interface SharedHooks {
	parent: string;
	hooks: string;
	legacy: Worktree;
	current: Worktree;
	plain: Worktree;
	/** How the worktree of an earlier Harness starts it, as its opt-in recorded it. */
	legacyCommand: string;
	/** The earlier Harness installs its push hook and opts a worktree in, as it did at b4afb74. */
	optInEarlier(tree: Worktree): Promise<void>;
	/** The first release with a second stage installs it: its wrapper, and the one opt-in file. */
	optInFirstRelease(tree: Worktree): Promise<void>;
	/** Opts a worktree in with the Harness under test, started through a recorder. */
	install(tree: Worktree): Promise<SharedStatus>;
	/** What each command line was started with by a hook, in order: its first three words. */
	started(who: 'legacy' | 'current'): Promise<string[]>;
	/** Which hook that was there before ran, and in which worktree, in order. */
	existing(): Promise<string[]>;
	/** Every file of the hooks directory with its mode and the hash of its bytes. */
	snapshot(): Promise<Record<string, string>>;
	dispose(): Promise<void>;
}

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/index.ts');
const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
const signing = ['-c', 'commit.gpgsign=false'];
const lines = (file: string) =>
	readFile(file, 'utf8').then(
		(text) => text.trim().split('\n').filter(Boolean),
		() => []
	);
const executable = async (file: string, text: string) => {
	await writeFile(file, text);
	await chmod(file, 0o755);
};
/** A hook the project already had: it says that it ran, and where. */
const projectHook = (stage: string, log: string) =>
	`#!/bin/sh\n# a ${stage} hook the project already had\necho "${stage} $(basename "$PWD")" >> '${log}'\n`;

function worktree(root: string, gitDir: string): Worktree {
	const run = (args: string[]) => runCommand(args, root, false);
	return {
		root,
		gitDir,
		run,
		commit: (message) =>
			run(['git', ...identity, ...signing, 'commit', '--allow-empty', '-m', message]),
		push: () => run(['git', 'push', '-q', 'origin', 'HEAD']),
		head: async () => (await run(['git', 'rev-parse', 'HEAD'])).stdout.trim(),
		async harness(...args) {
			const result = await runCommand(['bun', cli, 'hooks', ...args, '--json'], root);
			return JSON.parse(result.stdout) as SharedStatus;
		},
		optIns: async () => (await readdir(gitDir)).filter((name) => name.startsWith('harness-hooks'))
	};
}

/** A hook that was there is kept beside the wrapper, as every install has done. */
async function wrap(hooks: string, stage: string, wrapper: string): Promise<void> {
	const hook = join(hooks, stage);
	const there = await readFile(hook, 'utf8').catch(() => undefined);
	if (there !== undefined && !there.includes('harness-managed hook'))
		await rename(hook, `${hook}.harness-chained`);
	await executable(hook, wrapper);
}

async function snapshot(hooks: string): Promise<Record<string, string>> {
	const entries = await Promise.all(
		(await readdir(hooks)).sort().map(async (name) => {
			const file = join(hooks, name);
			const mode = ((await stat(file)).mode & 0o777).toString(8);
			const hash = createHash('sha256')
				.update(await readFile(file))
				.digest('hex');
			return [name, `${mode} ${hash}`] as const;
		})
	);
	return Object.fromEntries(entries);
}

/**
 * A repository that declares the writing limits, with a remote, hooks the project already had
 * for both stages and one for neither, and three worktrees on its one hooks directory.
 */
async function repository(parent: string): Promise<{ hooks: string; trees: Worktree[] }> {
	const [main, at] = [join(parent, 'main'), (name: string) => join(parent, name)];
	const git = (args: string[], cwd = main) =>
		runCommand(['git', ...identity, ...signing, ...args], cwd).then((done) => done.stdout.trim());
	await git(['init', '-q', '-b', 'main', main], parent);
	await git(['init', '-q', '--bare', at('remote.git')], parent);
	await git(['remote', 'add', 'origin', at('remote.git')]);
	const limits = JSON.stringify({ schemaVersion: 1, writing: 1 });
	await writeFile(join(main, 'harness.verify.json'), limits);
	await git(['add', '-A']);
	await git(['commit', '-q', '-m', 'chore: adopt the writing limits']);
	const hooks = join(main, '.git/hooks');
	for (const stage of ['pre-push', 'commit-msg'])
		await executable(join(hooks, stage), projectHook(stage, at('existing.log')));
	await executable(join(hooks, 'pre-commit'), '#!/bin/sh\n# a hook of neither stage\nexit 0\n');
	await writeFile(join(hooks, 'notes.txt'), 'a file somebody keeps beside the hooks\n');
	const trees: Worktree[] = [];
	for (const name of ['legacy', 'current', 'plain']) {
		await git(['worktree', 'add', '-q', '-b', name, at(name)]);
		trees.push(worktree(at(name), await git(['rev-parse', '--absolute-git-dir'], at(name))));
	}
	return { hooks, trees };
}

/**
 * That repository with a worktree for an earlier Harness, one for the Harness under test and
 * one that opts into nothing, and a command line for each Harness that records how a hook
 * started it.
 */
export async function sharedHooks(): Promise<SharedHooks> {
	const parent = await mkdtemp(join(tmpdir(), 'harness-shared-hooks-'));
	const at = (name: string) => join(parent, name);
	const { hooks, trees } = await repository(parent);
	const [legacy, current, plain] = trees;
	await executable(at('legacy-harness.sh'), legacyCommandLine(at('legacy.log')));
	const recorder = [
		'#!/bin/sh',
		'# Starts the Harness under test and writes down what it was started with.',
		`printf '%s\\n' "$*" >> '${at('current.log')}'`,
		`exec bun '${cli}' "$@"`,
		''
	];
	await executable(at('current-harness.sh'), recorder.join('\n'));
	const optIn = (tree: Worktree, command: string) =>
		writeFile(join(tree.gitDir, 'harness-hooks'), `${command}\n`);
	return {
		parent,
		hooks,
		legacy,
		current,
		plain,
		legacyCommand: at('legacy-harness.sh'),
		async optInEarlier(tree) {
			await wrap(hooks, 'pre-push', legacyPrePush);
			await optIn(tree, at('legacy-harness.sh'));
		},
		async optInFirstRelease(tree) {
			await wrap(hooks, 'pre-push', legacyPrePush);
			await wrap(hooks, 'commit-msg', firstMessageHook);
			await optIn(tree, at('current-harness.sh'));
		},
		install: (tree) => tree.harness('install', '--command', at('current-harness.sh')),
		started: async (who) =>
			(await lines(at(`${who}.log`))).map((line) => line.split(' ').slice(0, 3).join(' ')),
		existing: () => lines(at('existing.log')),
		snapshot: () => snapshot(hooks),
		dispose: () => rm(parent, { recursive: true, force: true })
	};
}
