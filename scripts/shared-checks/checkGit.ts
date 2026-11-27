// @harness-uid u_sbz3zzk4fx
import { ExpectedCliError } from '../../src/core/errors';
import { spawnSync } from 'node:child_process';
import { realpathSync, mkdtempSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CandidateTree, CheckRequest } from './sharedCheck.types';

export class CandidateConflict extends Error {}

export function checkGit(repo: string, args: string[], input?: string): string {
	const child = spawnSync(
		process.platform === 'darwin' ? '/usr/bin/git' : 'git',
		['-C', repo, ...args],
		{
			encoding: 'utf8',
			input,
			timeout: 30_000,
			maxBuffer: 8 * 1024 * 1024,
			env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' }
		}
	);
	if (child.error) throw child.error;
	if (child.status !== 0)
		throw new ExpectedCliError(`git ${args[0]} exited ${child.status ?? child.signal}`);
	return child.stdout.trimEnd();
}

export function emptyCheckCommit(repo: string, message: string, write: boolean): string {
	const update = write ? ['-w'] : [];
	const tree = checkGit(repo, ['hash-object', '-t', 'tree', '--stdin', ...update], '');
	const identity = 'Harness Check Queue <harness-check@localhost> 0 +0000';
	const data = `tree ${tree}\nauthor ${identity}\ncommitter ${identity}\n\n${message}`;
	return checkGit(repo, ['hash-object', '-t', 'commit', '--stdin', ...update], data);
}

export function checkRepository(cwd: string): string {
	return realpathSync(checkGit(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
}

export function checkCommit(repo: string, ref: string): string {
	return checkGit(repo, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
}

export function checkMain(repo: string): string {
	// Refresh the integration base once per batch. If origin is configured, fail closed on fetch failure.
	if (checkGit(repo, ['remote']).split('\n').includes('origin')) {
		checkGit(repo, [
			'fetch',
			'--no-tags',
			'--no-auto-gc',
			'--no-write-fetch-head',
			'origin',
			'+refs/heads/main:refs/harness/check-base'
		]);
		return checkCommit(repo, 'refs/harness/check-base');
	}
	return checkCommit(repo, 'refs/heads/main');
}

export function pinCandidate(request: CheckRequest): void {
	checkGit(request.repo, ['update-ref', candidateRef(request.id), request.commit]);
}

export function unpinCandidate(request: CheckRequest): void {
	checkGit(request.repo, ['update-ref', '-d', candidateRef(request.id), request.commit]);
}

function candidateRef(id: string): string {
	return `refs/harness/queued-checks/${id}`;
}

export function combineCandidates(base: string, requests: CheckRequest[]): CandidateTree {
	const repo = requests[0]!.repo;
	let commit = base;
	for (const tip of new Set(requests.map((request) => request.commit))) {
		if (commit === tip) continue;
		const ancestor = checkGit(repo, ['merge-base', commit, tip]);
		if (ancestor === tip) continue;
		commit = ancestor === commit ? tip : mergeCandidate(repo, commit, tip);
	}
	return { repo, base, commit, tree: checkGit(repo, ['rev-parse', `${commit}^{tree}`]) };
}

function mergeCandidate(repo: string, head: string, tip: string): string {
	let tree: string;
	try {
		tree = checkGit(repo, ['merge-tree', '--write-tree', head, tip]).split('\n')[0]!;
	} catch (error) {
		throw new CandidateConflict(`Could not combine ${tip.slice(0, 12)} with queued changes.`, {
			cause: error
		});
	}
	return checkGit(repo, [
		'-c',
		'user.name=Harness Check Queue',
		'-c',
		'user.email=harness-check@localhost',
		'commit-tree',
		tree,
		'-p',
		head,
		'-p',
		tip,
		'-m',
		'Harness check queue candidate'
	]);
}

export async function inCheckWorktree<T>(
	candidate: CandidateTree,
	home: string,
	run: (directory: string) => Promise<T>
): Promise<T> {
	const temporary = mkdtempSync(join(home, 'snapshot-'));
	const directory = join(temporary, 'checkout');
	let added = false;
	try {
		checkGit(candidate.repo, [
			'worktree',
			'add',
			'--detach',
			'--quiet',
			directory,
			candidate.commit
		]);
		added = true;
		return await run(directory);
	} finally {
		if (added) checkGit(candidate.repo, ['worktree', 'remove', '--force', directory]);
		rmdirSync(temporary);
	}
}
