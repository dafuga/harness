import type { Repo } from './repository.project-work.test.types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { ProjectWorkRepository } from '../../src/repositories/projects-sessions/ProjectWorkRepository';

const identity = ['-c', 'user.name=Example', '-c', 'user.email=example@example.invalid'];

export function write(root: string, path: string, text: string): void {
	mkdirSync(join(root, dirname(path)), { recursive: true });
	writeFileSync(join(root, path), text);
}

export function commit(repo: Repo, message: string): string {
	repo.git('add', '-A');
	repo.git(...identity, 'commit', '--allow-empty', '-q', '-m', message);
	return repo.git('rev-parse', 'HEAD').trim();
}

export function loopJson(name: string): string {
	const steps = [{ id: 'read-contract', title: 'Read the report contract', status: 'complete' }];
	const createdAt = '2026-11-09T10:12:44.067Z';
	return JSON.stringify({ name, goal: 'Example goal', createdAt, updatedAt: createdAt, steps });
}

export const committedLoopSummaryExample = async () => {
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
};
