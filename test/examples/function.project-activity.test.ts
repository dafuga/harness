import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { projectActivity } from '../../src/services/projects-sessions/project-activity-service/projectActivity';
import type {
	ActivityRevision,
	ActivitySource
} from '../../src/utils/projects-sessions/projectActivity';

const REVISIONS: ActivityRevision[] = [
	{
		commit: 'c3',
		subject: 'Add loop reporting',
		author: 'Fixture Author',
		committedAt: '2026-11-15T10:00:00.000Z',
		branches: ['main']
	},
	{
		commit: 'c2',
		subject: 'Share loop state',
		author: 'Fixture Author',
		committedAt: '2026-11-14T10:00:00.000Z',
		branches: ['main']
	},
	{
		commit: 'c1',
		subject: 'Start loops',
		author: 'Fixture Author',
		committedAt: '2026-11-13T10:00:00.000Z',
		branches: ['main']
	}
];

const CHANGES: Record<string, Array<{ path: string; status: string }>> = {
	c3: [
		{ path: 'docs/notes.md', status: 'M' },
		{ path: 'src/report.ts', status: 'A' },
		{ path: 'src/loop.ts', status: 'M' }
	],
	c2: [
		{ path: 'src/report.ts', status: 'M' },
		{ path: 'src/loop.ts', status: 'M' }
	],
	c1: [{ path: 'src/loop.ts', status: 'A' }]
};

const REASONS: Record<string, Array<{ unit: string; behavior: string }>> = {
	c3: [
		{ unit: 'function.report', behavior: 'Add loop reporting' },
		{ unit: 'function.report', behavior: 'Add loop reporting' },
		{ unit: 'function.loop', behavior: 'Track loop steps' }
	],
	c1: [{ unit: 'function.loop', behavior: 'Start loops' }]
};

const LOOPS = [
	{
		name: 'project-activity',
		goal: 'Show committed work',
		createdAt: '2026-11-13T09:00:00.000Z',
		updatedAt: '2026-11-15T09:00:00.000Z',
		steps: []
	}
];

const ALL_LIMIT = { work: 10, files: 10, reasons: 5, units: 5 };
const SMALL_LIMIT = { work: 1, files: 1, reasons: 1, units: 1 };

const EXPECTED_WORK = [
	{
		commit: 'c3',
		units: ['function.loop', 'function.report'],
		unitCount: 2,
		reasonCount: 2,
		files: 3
	},
	{
		commit: 'c2',
		units: ['function.loop', 'function.report'],
		unitCount: 2,
		reasonCount: 0,
		files: 2
	},
	{ commit: 'c1', units: ['function.loop'], unitCount: 1, reasonCount: 1, files: 1 }
];

const EXPECTED_FILES = [
	{
		path: 'src/report.ts',
		status: 'A',
		units: ['function.report'],
		commit: 'c3',
		committedAt: '2026-11-15T10:00:00.000Z'
	},
	{
		path: 'src/loop.ts',
		status: 'M',
		units: ['function.loop'],
		commit: 'c3',
		committedAt: '2026-11-15T10:00:00.000Z'
	},
	{
		path: 'docs/notes.md',
		status: 'M',
		units: [],
		commit: 'c3',
		committedAt: '2026-11-15T10:00:00.000Z'
	}
];

function ownersOf(path: string): string[] {
	if (path.startsWith('src/report')) return ['function.report'];
	return path.startsWith('src/loop') ? ['function.loop'] : [];
}

function activitySource(
	options: { revisions?: ActivityRevision[]; limit?: ActivitySource['limit'] } = {}
): ActivitySource {
	return {
		kind: 'recorded',
		repository: { name: 'example-project', branch: 'main', head: 'c3' },
		revisions: options.revisions ?? REVISIONS,
		reasons: (commit) => REASONS[commit] ?? [],
		changes: (commit) => CHANGES[commit] ?? [],
		owners: ownersOf,
		loops: LOOPS,
		limit: options.limit ?? ALL_LIMIT
	};
}

function workSummary(activity: ReturnType<typeof projectActivity>) {
	return activity.work.map(({ commit, units, unitCount, reasonCount, files }) => ({
		commit,
		units,
		unitCount,
		reasonCount,
		files
	}));
}

test('Assembles committed work and latest file revisions', () => {
	const activity = projectActivity(activitySource({ limit: ALL_LIMIT }));
	expect(activity.asOf).toEqual({ commit: 'c3', committedAt: '2026-11-15T10:00:00.000Z' });
	expect(activity.loops.total).toBe(1);
	expect(workSummary(activity)).toEqual(EXPECTED_WORK);
	expect(activity.files).toEqual(EXPECTED_FILES);
	recordExampleCases(
		{
			unitId: 'function.project-activity',
			symbol: 'projectActivity',
			state: 'assembles-committed-work-and-latest-file-revisions',
			evidence: 'examples-cases',
			file: 'assembles-committed-work-and-latest-file-revisions.json'
		},
		[
			{
				name: 'newest revisions with owned files first and each path once',
				input: { revisions: ['c3', 'c2', 'c1'], limit: ALL_LIMIT },
				output: activity
			}
		]
	);
});

test('Caps work, file, reason and unit lists at their limits', () => {
	const activity = projectActivity(activitySource({ limit: SMALL_LIMIT }));
	expect(activity.work).toHaveLength(1);
	expect(activity.work[0]).toMatchObject({
		commit: 'c3',
		units: ['function.loop'],
		unitCount: 2,
		reasons: [{ unit: 'function.loop', behavior: 'Track loop steps' }],
		reasonCount: 2,
		files: 3
	});
	expect(activity.files.map((file) => file.path)).toEqual(['src/report.ts']);
	recordExampleCases(
		{
			unitId: 'function.project-activity',
			symbol: 'projectActivity',
			state: 'caps-work-file-reason-and-unit-lists-at-their-limits',
			evidence: 'examples-cases',
			file: 'caps-work-file-reason-and-unit-lists-at-their-limits.json'
		},
		[
			{
				name: 'one work item, one file, one reason and one unit kept of more',
				input: { revisions: ['c3', 'c2', 'c1'], limit: SMALL_LIMIT },
				output: activity
			}
		]
	);
});

test('Reports no activity for a project with no commits', () => {
	const activity = projectActivity(activitySource({ revisions: [] }));
	expect(activity.asOf).toBeNull();
	expect(activity.work).toEqual([]);
	expect(activity.files).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.project-activity',
			symbol: 'projectActivity',
			state: 'reports-no-activity-for-a-project-with-no-commits',
			evidence: 'examples-cases',
			file: 'reports-no-activity-for-a-project-with-no-commits.json'
		},
		[{ name: 'no revisions are supplied', input: { revisions: [] }, output: activity }]
	);
});
