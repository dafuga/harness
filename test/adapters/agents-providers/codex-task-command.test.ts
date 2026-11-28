import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import {
	codexTaskCommand,
	codexWritableRoots
} from '../../../src/adapters/agents-providers/module-task-runner-adapter/codexTaskCommand';

const directories: string[] = [];
afterEach(() => {
	vi.unstubAllEnvs();
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

function temporary(prefix: string): string {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	directories.push(directory);
	return directory;
}

/** A linked worktree: `.git` is a file that points at the worktree's own Git directory. */
function linkedWorktree(pointer: (gitDirectory: string, worktree: string) => string) {
	const base = temporary('codex-roots-'),
		gitDirectory = join(base, 'repo', '.git', 'worktrees', 'attempt'),
		worktree = join(base, 'attempt');
	mkdirSync(gitDirectory, { recursive: true });
	mkdirSync(worktree);
	writeFileSync(join(worktree, '.git'), `gitdir: ${pointer(gitDirectory, worktree)}\n`);
	return { gitDirectory, worktree };
}

function flagValue(argv: string[], prefix: string): string | undefined {
	return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

test('Codex tasks ignore user configuration and project docs and may write their roots', () => {
	const home = temporary('codex-resources-');
	vi.stubEnv('HARNESS_RESOURCES_HOME', home);
	const { gitDirectory, worktree } = linkedWorktree((gitDirectory) => gitDirectory);
	const argv = codexTaskCommand({
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max',
		cwd: worktree,
		platform: 'macos',
		images: ['/tmp/frame one.png', '/tmp/frame-two.png']
	});
	expect(argv.slice(0, 6)).toEqual([
		'codex',
		'exec',
		'--json',
		'--ignore-user-config',
		'--sandbox',
		'workspace-write'
	]);
	expect(argv).toEqual(
		expect.arrayContaining([
			'-m',
			'gpt-6-luna',
			'model_reasoning_effort="max"',
			'project_doc_max_bytes=0',
			'sandbox_workspace_write.network_access=true'
		])
	);
	for (const setting of ['project_doc_max_bytes=0', 'sandbox_workspace_write.network_access=true'])
		expect(argv[argv.indexOf(setting) - 1]).toBe('-c');
	const roots = flagValue(argv, 'sandbox_workspace_write.writable_roots=');
	expect(JSON.parse(roots ?? 'null')).toEqual([gitDirectory, home]);
	expect(argv.slice(-5)).toEqual(['-i', '/tmp/frame one.png', '-i', '/tmp/frame-two.png', '-']);
});

test('Codex tasks without a worktree get an empty writable roots list and no images', () => {
	const argv = codexTaskCommand({ provider: 'codex', model: 'gpt-6-luna', intelligence: 'low' });
	expect(flagValue(argv, 'sandbox_workspace_write.writable_roots=')).toBe('[]');
	expect(argv).not.toContain('-i');
	expect(argv.at(-1)).toBe('-');
});

test('a linked worktree with an absolute gitdir writes its own Git directory', () => {
	const home = temporary('codex-resources-');
	const { gitDirectory, worktree } = linkedWorktree((gitDirectory) => gitDirectory);
	expect(
		codexWritableRoots({ cwd: worktree, platform: 'macos' }, { HARNESS_RESOURCES_HOME: home })
	).toEqual([gitDirectory, home]);
});

test('a linked worktree with a relative gitdir resolves it from the worktree', () => {
	const home = temporary('codex-resources-');
	const { gitDirectory, worktree } = linkedWorktree(() => '../repo/.git/worktrees/attempt');
	expect(codexWritableRoots({ cwd: worktree }, { HARNESS_RESOURCES_HOME: home })).toEqual([
		gitDirectory,
		home
	]);
});

test('a normal repository whose .git is a directory adds only the resource home', () => {
	const home = temporary('codex-resources-'),
		repository = temporary('codex-repo-');
	mkdirSync(join(repository, '.git'));
	expect(
		codexWritableRoots({ cwd: repository, platform: 'macos' }, { HARNESS_RESOURCES_HOME: home })
	).toEqual([home]);
});

test('missing Git directories and resource homes are left out', () => {
	const base = temporary('codex-missing-');
	const { worktree } = linkedWorktree(() => join(base, 'gone', 'worktrees', 'attempt'));
	expect(
		codexWritableRoots(
			{ cwd: worktree, platform: 'macos' },
			{ HARNESS_RESOURCES_HOME: join(base, 'no-resources') }
		)
	).toEqual([]);
	const bare = temporary('codex-bare-');
	writeFileSync(join(bare, '.git'), 'not a pointer\n');
	expect(codexWritableRoots({ cwd: bare }, { HARNESS_RESOURCES_HOME: join(base, 'none') })).toEqual(
		[]
	);
});

test('Linux tasks and tasks without a working directory get no extra roots', () => {
	const home = temporary('codex-resources-');
	const { worktree } = linkedWorktree((gitDirectory) => gitDirectory);
	const env = { HARNESS_RESOURCES_HOME: home };
	expect(codexWritableRoots({ cwd: worktree, platform: 'linux' }, env)).toEqual([]);
	expect(codexWritableRoots({ platform: 'macos' }, env)).toEqual([]);
	expect(codexWritableRoots({ cwd: '' }, env)).toEqual([]);
});
