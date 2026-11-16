import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { ProjectActivityService } from '../../src/services/projects-sessions/project-activity-service/ProjectActivityService';

type Repository = { root: string; git: (...args: string[]) => string };
type History = Parameters<ProjectActivityService['recorded']>[0];
type Details = Parameters<ProjectActivityService['recorded']>[1];

const unit = 'service.project-activity';
const source = 'src/services/projects-sessions/project-activity-service/ProjectActivityService.ts';
const subject = 'Show the agent roster in project activity';
const behavior = 'Shows the registered agents of the repository in the live activity.';

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
