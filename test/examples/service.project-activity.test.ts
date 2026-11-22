import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { ProjectActivityService } from '../../src/services/projects-sessions/project-activity-service/ProjectActivityService';

type Repository = { root: string; git: (...args: string[]) => string };
type History = Parameters<ProjectActivityService['recorded']>[0];
type Details = Parameters<ProjectActivityService['recorded']>[1];

const unit = 'service.project-activity';
const source = 'src/services/projects-sessions/project-activity-service/ProjectActivityService.ts';
const subject = 'Show the agent roster in project activity';
const behavior = 'Shows the registered agents of the repository in the live activity.';
const none: History = { branches: [], revisions: [], truncated: false };

/** Commits one file in the fixture repository and returns the new commit hash. */
function commitFile(repository: Repository): string {
	writeFileSync(join(repository.root, 'ProjectActivityService.ts'), 'export const value = 1;\n');
	repository.git('add', '.');
	repository.git(
		'-c',
		'user.name=Example Author',
		'-c',
		'user.email=author@example.invalid',
		'-c',
		'commit.gpgsign=false',
		'commit',
		'-m',
		subject
	);
	return repository.git('rev-parse', 'HEAD').trim();
}

/** A history index with one newest revision on main, built from a made-up commit. */
function historyOf(commit: string): History {
	return {
		branches: [{ name: 'main', head: commit }],
		revisions: [
			{
				commit,
				tree: '2f8a6c0e91b4d7305ac6e8f2d19b74a0c5e3f861',
				parents: ['b04f8e2d6a17c93e5f0b8d41a6e27c9f3d05b2a6'],
				subject,
				author: 'Mira Halvorsen',
				authoredAt: '2026-11-13T16:20:41+01:00',
				committedAt: '2026-11-13T16:24:02+01:00',
				branches: ['main'],
				retained: false
			}
		],
		truncated: false
	};
}

/** The details of that revision: its registry unit, its noted reason and its changed file. */
function detailsOf(commit: string): Details {
	const detail = {
		registry: { units: [{ id: unit, owns: { source: [source] } }] },
		explanations: [{ unit, behavior }],
		sourceImpact: { changed: [{ path: source, status: 'modified' }] }
	};
	return new Map([[commit, detail]]) as unknown as Details;
}

/** The error that `run` rejects with, or undefined when it resolves. */
async function failureOf(run: () => Promise<unknown>): Promise<Error | undefined> {
	try {
		await run();
		return undefined;
	} catch (error) {
		return error as Error;
	}
}

/** The metadata that records a state's cases under this unit and symbol. */
function meta(symbol: string, state: string) {
	return { unitId: unit, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Shows a checkout that has no commits yet', async () => {
	await withTempRepo(async (repository) => {
		const input = { root: repository.root, limit: 10 };
		const { activity, live } = await new ProjectActivityService(repository.root).show(10);

		expect(activity.kind).toBe('live');
		expect(activity.asOf).toBeNull();
		expect(activity.work).toEqual([]);
		expect(live.worktrees).toHaveLength(1);
		expect(live.worktrees[0]?.primary).toBe(true);
		expect(live.worktrees[0]?.changes).toEqual([]);
		expect(live.agents.roster).toEqual([]);

		recordExampleCases(
			{
				unitId: 'service.project-activity',
				symbol: 'show',
				state: 'shows-a-checkout-that-has-no-commits-yet',
				evidence: 'examples-cases',
				file: 'shows-a-checkout-that-has-no-commits-yet.json'
			},
			[
				{
					name: 'unborn checkout shows no history, one primary worktree and an empty roster',
					input,
					output: {
						kind: activity.kind,
						asOf: activity.asOf,
						work: activity.work,
						worktrees: live.worktrees.length,
						primary: live.worktrees[0]?.primary,
						agents: live.agents.roster
					}
				}
			]
		);
	}, 'project-activity-');
});

test('Lists the recorded work of a project history', async () => {
	await withTempRepo(async (repository) => {
		const commit = commitFile(repository);
		const service = new ProjectActivityService(repository.root);
		const activity = await service.recorded(historyOf(commit), detailsOf(commit));
		const empty = await service.recorded({ branches: [], revisions: [], truncated: false }, new Map() as Details);

		expect(activity.kind).toBe('recorded');
		expect(activity.repository.branch).toBe('main');
		expect(activity.repository.head).toBe(commit);
		expect(activity.work.map((item) => item.commit)).toEqual([commit]);
		expect(activity.work[0]?.reasons).toEqual([{ unit, behavior }]);
		expect(empty.asOf).toBeNull();
		expect(empty.work).toEqual([]);

		recordExampleCases(
			{
				unitId: 'service.project-activity',
				symbol: 'recorded',
				state: 'lists-the-recorded-work-of-a-project-history',
				evidence: 'examples-cases',
				file: 'lists-the-recorded-work-of-a-project-history.json'
			},
			[
				{
					name: 'history with one newest commit gives its work item, reason and changed file',
					input: { revisions: 1, details: [commit] },
					output: activity
				},
				{
					name: 'history with no revisions gives no repository head, work or files',
					input: { revisions: 0, details: [] },
					output: empty
				}
			]
		);
	}, 'project-activity-');
});

test('Throws TypeError when every worktree is bare', async () => {
	await withTempDir('project-activity-', async (directory) => {
		execFileSync('git', ['init', '--bare', '-q', directory]);
		const service = new ProjectActivityService(directory);
		const failure = await failureOf(() => service.show(10));
		const recordFailure = await failureOf(() => service.recorded(none, new Map() as Details));

		expect(failure).toBeInstanceOf(TypeError);
		expect(recordFailure).toBeInstanceOf(TypeError);

		recordExampleCases(meta('show', 'throws-typeerror-when-every-worktree-is-bare'), [
			{
				name: 'bare repository leaves no checkout to show',
				input: { root: directory, limit: 10 },
				error: { name: failure?.name ?? null }
			}
		]);
	});
});

test('Throws BoundedCommandFailure when git cannot start', async () => {
	await withTempDir('project-activity-', async (directory) => {
		const missing = join(directory, 'missing-checkout');
		const failure = await failureOf(() => new ProjectActivityService(missing).show(10));

		expect(failure?.name).toBe('BoundedCommandFailure');

		recordExampleCases(meta('show', 'throws-boundedcommandfailure-when-git-cannot-start'), [
			{
				name: 'checkout directory that does not exist',
				input: { root: missing, limit: 10 },
				error: { name: failure?.name ?? null }
			}
		]);
	});
});

test('Throws Error when a git read exits non-zero', async () => {
	await withTempRepo(async (repository) => {
		const commit = commitFile(repository);
		rmSync(join(repository.root, '.git', 'objects', commit.slice(0, 2), commit.slice(2)));
		const failure = await failureOf(() => new ProjectActivityService(repository.root).show(10));

		expect(failure).toBeInstanceOf(Error);
		expect(failure?.message).toContain('failed:');

		recordExampleCases(meta('show', 'throws-error-when-a-git-read-exits-non-zero'), [
			{
				name: 'head commit object removed so the commit walk fails',
				input: { root: repository.root, limit: 10 },
				error: { name: failure?.name ?? null }
			}
		]);
	}, 'project-activity-');
});

test('Throws Error when a units directory is not a directory', async () => {
	await withTempRepo(async (repository) => {
		mkdirSync(join(repository.root, 'specification'));
		writeFileSync(join(repository.root, 'specification', 'units'), 'not a directory\n');
		const failure = await failureOf(() => new ProjectActivityService(repository.root).show(10));

		expect(failure?.name).toBe('Error');
		expect(failure?.message).toContain('ENOTDIR');

		recordExampleCases(meta('show', 'throws-error-when-a-units-directory-is-not-a-directory'), [
			{
				name: 'specification/units is a file, so the unit registry cannot be read',
				input: { root: repository.root, limit: 10 },
				error: { name: failure?.name ?? null }
			}
		]);
	}, 'project-activity-');
});
