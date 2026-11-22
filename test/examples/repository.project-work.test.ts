import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { ProjectWorkRepository } from '../../src/repositories/projects-sessions/ProjectWorkRepository';
import type { Checkout } from '../../src/repositories/projects-sessions/ProjectWorkRepository.types';

interface Repo {
	root: string;
	git: (...args: string[]) => string;
}

const identity = ['-c', 'user.name=Example', '-c', 'user.email=example@example.invalid'];

function write(root: string, path: string, text: string): void {
	mkdirSync(join(root, dirname(path)), { recursive: true });
	writeFileSync(join(root, path), text);
}

function commit(repo: Repo, message: string): string {
	repo.git('add', '-A');
	repo.git(...identity, 'commit', '--allow-empty', '-q', '-m', message);
	return repo.git('rev-parse', 'HEAD').trim();
}

function loopJson(name: string): string {
	const steps = [{ id: 'read-contract', title: 'Read the report contract', status: 'complete' }];
	const createdAt = '2026-11-09T10:12:44.067Z';
	return JSON.stringify({ name, goal: 'Example goal', createdAt, updatedAt: createdAt, steps });
}

const summary = (list: Checkout[]) => list.map(({ branch, primary }) => ({ branch, primary }));

test('Lists the checkouts of a repository with the primary first', async () => {
	await withTempRepo(async (repo) => {
		commit(repo, 'initial');
		await withTempDir('project-work-checkouts-', async (directory) => {
			repo.git('worktree', 'add', '-q', '-b', 'fix/loop-evidence', join(directory, 'fix'));
			const checkouts = await new ProjectWorkRepository(repo.root).checkouts();
			const outside = await new ProjectWorkRepository(directory).checkouts();

			expect(checkouts.map((item) => item.primary)).toEqual([true, false]);
			expect(checkouts[1].branch).toBe('fix/loop-evidence');
			expect(outside).toEqual([{ path: directory, branch: null, head: null, primary: true }]);
			recordExampleCases(
				{
					unitId: 'repository.project-work',
					symbol: 'checkouts',
					state: 'lists-the-checkouts-of-a-repository-with-the-primary-first',
					evidence: 'examples-cases',
					file: 'lists-the-checkouts-of-a-repository-with-the-primary-first.json'
				},
				[
					{
						name: 'repository with one linked worktree on a branch',
						input: { root: 'temporary repository', linked: 'fix/loop-evidence' },
						output: summary(checkouts)
					},
					{
						name: 'directory outside Git gives the directory alone',
						input: { root: 'temporary directory' },
						output: summary(outside)
					}
				]
			);
		});
	});
});

test('Reports the paths each commit added, removed or modified', async () => {
	await withTempRepo(async (repo) => {
		write(repo.root, 'src/a.ts', 'one');
		write(repo.root, 'old.txt', 'gone');
		const first = commit(repo, 'add files');
		repo.git('rm', '-q', 'old.txt');
		write(repo.root, 'src/a.ts', 'two');
		const second = commit(repo, 'remove and edit');
		const empty = commit(repo, 'nothing changed');
		const reader = new ProjectWorkRepository(repo.root);
		const found = await reader.changes([second, first, empty]);
		let error: unknown;
		try {
			await reader.changes(['no-such-revision']);
		} catch (caught) {
			error = caught;
		}

		expect(found.get(first)).toEqual([
			{ path: 'old.txt', status: 'added' },
			{ path: 'src/a.ts', status: 'added' }
		]);
		expect(found.get(second)).toEqual([
			{ path: 'old.txt', status: 'removed' },
			{ path: 'src/a.ts', status: 'modified' }
		]);
		expect(found.get(empty)).toEqual([]);
		expect(error).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'repository.project-work',
				symbol: 'changes',
				state: 'reports-the-paths-each-commit-added-removed-or-modified',
				evidence: 'examples-cases',
				file: 'reports-the-paths-each-commit-added-removed-or-modified.json'
			},
			[
				{
					name: 'root commit, edit and removal, and an empty commit',
					input: { commits: ['second commit', 'first commit', 'empty commit'] },
					output: [...found.values()]
				},
				{
					name: 'unresolvable revision rejects',
					input: { commits: ['no-such-revision'] },
					error: { name: (error as Error).name }
				}
			]
		);
	});
});

test('Lists uncommitted paths in order and cuts to the limit', async () => {
	await withTempRepo(async (repo) => {
		write(repo.root, 'a.txt', 'one');
		commit(repo, 'base');
		write(repo.root, 'a.txt', 'two');
		write(repo.root, 'b.txt', 'new');
		write(repo.root, '.cache/run.json', '{}');
		const reader = new ProjectWorkRepository(repo.root);
		const all = await reader.uncommitted(repo.root, 50);
		const cut = await reader.uncommitted(repo.root, 1);

		expect(all).toEqual({
			changes: [
				{ path: 'a.txt', status: 'modified' },
				{ path: 'b.txt', status: 'untracked' }
			],
			truncated: false
		});
		expect(cut).toEqual({ changes: [{ path: 'a.txt', status: 'modified' }], truncated: true });
		recordExampleCases(
			{
				unitId: 'repository.project-work',
				symbol: 'uncommitted',
				state: 'lists-uncommitted-paths-in-order-and-cuts-to-the-limit',
				evidence: 'examples-cases',
				file: 'lists-uncommitted-paths-in-order-and-cuts-to-the-limit.json'
			},
			[
				{ name: 'limit 50 returns every change, cache excluded', input: { limit: 50 }, output: all },
				{ name: 'limit 1 cuts to the first path', input: { limit: 1 }, output: cut }
			]
		);
	});
});

test('Reads loops from the working tree and skips broken files', async () => {
	await withTempRepo(async (repo) => {
		write(repo.root, 'specification/loops/evidence-grid/loop.json', loopJson('evidence-grid'));
		write(repo.root, 'specification/loops/broken/loop.json', '{not json');
		mkdirSync(join(repo.root, 'specification/loops/empty'), { recursive: true });
		const loops = await new ProjectWorkRepository(repo.root).loops();

		expect(loops.map((loop) => loop.name)).toEqual(['evidence-grid']);
		expect(loops[0].steps[0].status).toBe('complete');
		recordExampleCases(
			{
				unitId: 'repository.project-work',
				symbol: 'loops',
				state: 'reads-loops-from-the-working-tree-and-skips-broken-files',
				evidence: 'examples-cases',
				file: 'reads-loops-from-the-working-tree-and-skips-broken-files.json'
			},
			[
				{
					name: 'sorted entries: invalid JSON and a folder without loop.json are skipped',
					input: { entries: ['broken', 'empty', 'evidence-grid'] },
					output: loops.map((loop) => ({ name: loop.name, steps: loop.steps.length }))
				}
			]
		);
	});
});

test('Reads loops as committed at a revision at any depth', async () => {
	await withTempRepo(async (repo) => {
		write(repo.root, 'specification/loops/evidence-grid/loop.json', loopJson('evidence-grid'));
		write(repo.root, 'specification/loops/group/nested/loop.json', loopJson('nested-loop'));
		const revision = commit(repo, 'track loops');
		repo.git('rm', '-r', '-q', 'specification/loops');
		commit(repo, 'remove loops');
		const reader = new ProjectWorkRepository(repo.root);
		const committed = await reader.loops(revision);
		const current = await reader.loops();

		expect(committed.map((loop) => loop.name)).toEqual(['evidence-grid', 'nested-loop']);
		expect(current).toEqual([]);
		recordExampleCases(
			{
				unitId: 'repository.project-work',
				symbol: 'loops',
				state: 'reads-loops-as-committed-at-a-revision-at-any-depth',
				evidence: 'examples-cases',
				file: 'reads-loops-as-committed-at-a-revision-at-any-depth.json'
			},
			[
				{
					name: 'revision lists loop.json files at any depth in Git order',
					input: { commit: 'revision that tracked the loops' },
					output: committed.map((loop) => loop.name)
				},
				{
					name: 'working tree after removal has no loops',
					input: {},
					output: current.map((loop) => loop.name)
				}
			]
		);
	});
});
