import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { expect } from '../../verificationExpect';
import { taskWorkspace } from '../../../src/services/agents-providers/module-task-worker-service/taskWorkspace';

const exec = promisify(execFile);
const selection = { provider: 'codex' as const, model: 'gpt-6-luna', intelligence: 'max' };

async function sourceState(root: string) {
	const git = async (args: string[]) => (await exec('git', ['-C', root, ...args])).stdout;
	return {
		head: await git(['rev-parse', 'HEAD']),
		status: await git(['status', '--porcelain=v1']),
		index: await git(['ls-files', '--stage']),
		diff: await git(['diff', 'HEAD']),
		note: await readFile(join(root, 'user-note.txt'), 'utf8')
	};
}

async function checkoutResults(root: string, base: Parameters<typeof taskWorkspace>[1]) {
	const before = await sourceState(root);
	const results = [];
	for (const [token, repairCommit] of [
		['00000000-0000-4000-8000-000000000001', undefined],
		['00000000-0000-4000-8000-000000000002', 'b'.repeat(40)]
	] as const) {
		const task = {
			...structuredClone(base),
			repairCommit,
			claim: {
				worker: 'owner',
				token,
				startedAt: '2026-10-26T12:00:00.000Z',
				owner: { workspace: '00000000-0000-4000-8000-000000000003', pid: 1, startedAt: 'synthetic' }
			}
		};
		const original = structuredClone(task);
		const result = await taskWorkspace(root, task, selection);
		expect(result).toMatchObject({
			...selection,
			attempt: token,
			sourceCommit: repairCommit ?? base.sourceCommit
		});
		expect(task).toEqual(original);
		expect((await taskWorkspace(root, task, selection)).worktree).toBe(result.worktree);
		results.push(result);
	}
	expect(results[0].worktree).not.toBe(results[1].worktree);
	expect(await sourceState(root)).toEqual(before);
	return results;
}

export async function assertWorkspacePlacement(
	source: string,
	base: Parameters<typeof taskWorkspace>[1]
) {
	const temp = await realpath(await mkdtemp(join(tmpdir(), 'task-workspace-placement-')));
	const ordinary = join(temp, 'ordinary'),
		linked = join(temp, 'linked');
	try {
		await exec('git', ['clone', '--no-hardlinks', source, ordinary]);
		await exec('git', ['-C', ordinary, 'worktree', 'add', '--detach', linked, 'HEAD']);
		expect((await stat(join(ordinary, '.git'))).isDirectory()).toBe(true);
		expect((await stat(join(linked, '.git'))).isFile()).toBe(true);
		for (const root of [ordinary, linked])
			await writeFile(join(root, 'user-note.txt'), 'Preserve synthetic user notes.');
		const outcomes = [];
		for (const root of [ordinary, linked]) {
			for (const result of await checkoutResults(root, base)) {
				outcomes.push({ checkout: root, worktree: result.worktree, attempt: result.attempt });
			}
		}
		for (const { checkout, worktree, attempt } of outcomes) {
			expect(isAbsolute(worktree)).toBe(true);
			expect(relative(checkout, worktree).startsWith(`..${sep}`)).toBe(true);
			const nested = relative(join(temp, '.cache/harness/task-worktrees'), worktree);
			expect(nested).not.toBe('');
			expect(isAbsolute(nested)).toBe(false);
			expect(nested.split(sep)).not.toContain('..');
			expect(basename(worktree)).toBe(attempt);
		}
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
}
