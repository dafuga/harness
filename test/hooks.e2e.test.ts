import type { HookStatus } from './hooks.e2e.test.types';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runCommand } from './support/cli';
import {
	evidenceRef,
	harnessJson,
	noteLines,
	notesRef,
	removeRemote,
	withRemote
} from './support/historyRepo';
import { baselineRepo, cloneRepo, repoAt, type VerifyRepo } from './support/verifyRepo';

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.ts');
const command = ['--command', `bun ${cli}`];
const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');
const grow = (source: string) =>
	source.replace(
		'\treturn input',
		"\tif (input.length > 99 || input.includes('?')) return input;\n\treturn input"
	);
const existing =
	'#!/bin/sh\n# a hook the project already had\necho "existing hook ran" >> "$(git rev-parse --git-common-dir)/existing.log"\nexit ${EXISTING_HOOK_EXIT:-0}\n';
const push = (repo: VerifyRepo, args: string[] = [], env = {}) =>
	runCommand(['git', 'push', ...args, 'origin', 'HEAD'], repo.root, false, env);
const remoteHead = (repo: VerifyRepo, branch = 'main') =>
	repo.git(['ls-remote', 'origin', `refs/heads/${branch}`]).then((line) => line.split(/\s/)[0]);
const status = (repo: VerifyRepo) => harnessJson<HookStatus>(repo, ['hooks', 'status']);
const records = async (repo: VerifyRepo) =>
	(await readdir(join(repo.root, '.cache/harness/verifications'), { recursive: true })).filter(
		(path) => path.endsWith('record.json')
	).length;

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

async function prepared(): Promise<{ repo: VerifyRepo; remote: string; hook: string }> {
	const repo = await cloneRepo(baseline);
	const remote = await withRemote(repo);
	await repo.verify();
	return { repo, remote, hook: join(repo.root, '.git/hooks/pre-push') };
}

test('installing composes with an existing hook and uninstalling restores it byte for byte', async () => {
	const { repo, remote, hook } = await prepared();
	await mkdir(dirname(hook), { recursive: true });
	await writeFile(hook, existing);
	await chmod(hook, 0o755);
	expect(await status(repo)).toMatchObject({ installed: false, enabled: false });

	const installed = await harnessJson<HookStatus>(repo, ['hooks', 'install', ...command]);
	expect(installed).toMatchObject({
		installed: true,
		enabled: true,
		stage: 'pre-push',
		chained: true
	});
	expect(await readFile(`${hook}.harness-chained`, 'utf8')).toBe(existing);
	expect(await readFile(hook, 'utf8')).toContain('harness-managed hook');
	const again = await harnessJson<HookStatus>(repo, ['hooks', 'install', ...command]);
	expect(again).toEqual(installed);
	expect(await readFile(`${hook}.harness-chained`, 'utf8')).toBe(existing);

	await repo.change('src/utils/slugify.ts', upper);
	const blockedByExisting = await push(repo, [], { EXISTING_HOOK_EXIT: '3' });
	expect(blockedByExisting.exitCode).not.toBe(0);
	const log = join(repo.root, '.git/existing.log');
	expect((await readFile(log, 'utf8')).trim().split('\n')).toHaveLength(1);
	expect(await records(repo)).toBe(3);
	const passed = await push(repo);
	expect(passed.exitCode).toBe(0);
	expect((await readFile(log, 'utf8')).trim().split('\n')).toHaveLength(2);
	expect(await remoteHead(repo)).toBe(await repo.git(['rev-parse', 'HEAD']));

	await harnessJson(repo, ['hooks', 'uninstall']);
	expect(await readFile(hook, 'utf8')).toBe(existing);
	expect((await readdir(dirname(hook))).filter((name) => name.includes('harness'))).toEqual([]);
	expect(await status(repo)).toMatchObject({ installed: false, enabled: false });
	await Promise.all([repo.dispose(), removeRemote(remote)]);
}, 300_000);

test('an unverified commit cannot be pushed, a verified one can, and its evidence is attached', async () => {
	const { repo, remote } = await prepared();
	await harnessJson(repo, ['hooks', 'install', ...command]);
	const before = await remoteHead(repo);
	await repo.change('src/utils/slugify.ts', grow);
	const blocked = await push(repo);
	expect(blocked.exitCode).not.toBe(0);
	expect(blocked.stderr).toContain('harness: push blocked');
	expect(blocked.stderr).toContain(
		'function.slugify: source-bytes grew from 100 to 161 without a recorded approval'
	);
	expect(await remoteHead(repo)).toBe(before);
	expect((await noteLines(repo)).filter((line) => line.kind === 'verification')).toEqual([
		expect.objectContaining({ status: 'failed' })
	]);

	await repo.git(['reset', '-q', '--hard', 'HEAD~1']);
	const good = await repo.change('src/utils/slugify.ts', upper);
	const allowed = await push(repo);
	expect(allowed.exitCode).toBe(0);
	expect(await remoteHead(repo)).toBe(good);
	const lines = (await noteLines(repo)).filter((line) => line.kind === 'verification');
	expect(lines).toEqual([
		expect.objectContaining({ status: 'passed', source: expect.objectContaining({ commit: good }) })
	]);
	expect(await repo.git(['ls-remote', 'origin', evidenceRef, notesRef])).toBe('');

	const count = await records(repo);
	const synced = await harnessJson<{ pushed: boolean }>(repo, ['history', 'push', 'origin']);
	expect(synced.pushed).toBe(true);
	expect(await records(repo)).toBe(count);
	const unchanged = await push(repo);
	expect(unchanged.exitCode).toBe(0);
	expect(await records(repo)).toBe(count);
	await Promise.all([repo.dispose(), removeRemote(remote)]);
}, 300_000);

test('another worktree is unaffected until it opts in, and --no-verify is a stated bypass', async () => {
	const { repo, remote } = await prepared();
	const installed = await harnessJson<HookStatus>(repo, ['hooks', 'install', ...command]);
	expect(installed.limitations).toEqual(
		expect.arrayContaining([
			expect.stringContaining('--no-verify'),
			expect.stringContaining('other worktrees')
		])
	);
	const secondRoot = join(repo.root, '..', 'second');
	await repo.git(['worktree', 'add', '-q', '-b', 'second', secondRoot]);
	const second = repoAt(secondRoot);
	expect(await status(second)).toMatchObject({ installed: true, enabled: false });
	await second.change('src/utils/slugify.ts', grow);
	const unguarded = await push(second);
	expect(unguarded.exitCode).toBe(0);
	expect(await remoteHead(second, 'second')).toBe(await second.git(['rev-parse', 'HEAD']));

	await harnessJson(second, ['hooks', 'install', ...command]);
	await second.git(['commit', '-q', '--allow-empty', '-m', 'chore: still unverified']);
	expect((await push(second)).exitCode).not.toBe(0);

	await repo.change('src/utils/slugify.ts', grow);
	const bypassed = await push(repo, ['--no-verify']);
	expect(bypassed.exitCode).toBe(0);
	expect(await remoteHead(repo)).toBe(await repo.git(['rev-parse', 'HEAD']));
	await Promise.all([repo.dispose(), removeRemote(remote)]);
}, 300_000);

test('a hooks directory that lives in the working tree is left alone', async () => {
	const repo = await cloneRepo(baseline);
	await repo.write('.githooks/pre-push', existing);
	await repo.git(['config', 'core.hooksPath', '.githooks']);
	const refused = await repo.run(['hooks', 'install', ...command]);
	expect(refused.exitCode).toBe(1);
	expect(refused.stderr).toContain('core.hooksPath points into the working tree');
	expect(await repo.read('.githooks/pre-push')).toBe(existing);
	await repo.dispose();
}, 60_000);
