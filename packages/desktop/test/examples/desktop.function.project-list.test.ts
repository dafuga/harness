import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { projectList } from '../../src/components/projects-sessions/project-switcher/projectList';
import { listedProjects } from '../../src/utils/projects-sessions/projectList';

type Projects = Parameters<typeof projectList>[0];
type Snapshot = NonNullable<Parameters<typeof projectList>[1]>;
type Bridge = Parameters<typeof listedProjects>[0];

const LISTED: Projects = [{ id: 'project-1', name: 'Atlas', kind: 'local' }];
const SHA = 'a'.repeat(40);

function snapshotOf(id: string | undefined, source: string): Snapshot {
	return {
		project: { id, name: 'Atlas', root: '/workspace/project' },
		capabilities: { comments: true, agents: true, planning: true, approval: false, source },
		revision: { branch: 'main', commit: SHA, tip: SHA, atTip: true },
		branches: [{ name: 'main', tip: SHA, current: true }],
		commits: [{ hash: SHA, subject: 'Initial commit', authoredAt: '2026-11-10T12:00:00.000Z' }],
		entities: [],
		writable: true
	} as Snapshot;
}

function summary(snapshot: Snapshot | null) {
	if (!snapshot) return null;
	return { projectId: snapshot.project.id ?? '', source: snapshot.capabilities?.source ?? null };
}

test('Keeps the list when the shown project is listed', () => {
	const snapshot = snapshotOf('project-1', 'github');
	const result = projectList(LISTED, snapshot);

	expect(result).toBe(LISTED);
	expect(result).toEqual([{ id: 'project-1', name: 'Atlas', kind: 'local' }]);

	recordExampleCases(
		{
			unitId: 'desktop.function.project-list',
			symbol: 'projectList',
			state: 'keeps-the-list-when-the-shown-project-is-listed',
			evidence: 'examples-cases',
			file: 'keeps-the-list-when-the-shown-project-is-listed.json'
		},
		[
			{
				name: 'shown project already in the list',
				input: { projects: LISTED, snapshot: summary(snapshot) },
				output: result
			}
		]
	);
});

test('Appends the shown project as local', () => {
	const snapshot = snapshotOf('project-2', 'local');
	const unnamed = snapshotOf(undefined, 'local');
	const result = projectList(LISTED, snapshot);
	const fallback = projectList(LISTED, unnamed);

	expect(result).toEqual([...LISTED, { id: 'project-2', name: 'Atlas', kind: 'local' }]);
	expect(fallback).toEqual([...LISTED, { id: '', name: 'Atlas', kind: 'local' }]);

	recordExampleCases(
		{
			unitId: 'desktop.function.project-list',
			symbol: 'projectList',
			state: 'appends-the-shown-project-as-local',
			evidence: 'examples-cases',
			file: 'appends-the-shown-project-as-local.json'
		},
		[
			{
				name: 'shown project missing from the bridge list',
				input: { projects: LISTED, snapshot: summary(snapshot) },
				output: result
			},
			{
				name: 'shown project without an id falls back to empty id',
				input: { projects: LISTED, snapshot: summary(unnamed) },
				output: fallback
			}
		]
	);
});

test('Appends the shown project as shared for github', () => {
	const snapshot = snapshotOf('project-3', 'github');
	const result = projectList(LISTED, snapshot);

	expect(result).toEqual([...LISTED, { id: 'project-3', name: 'Atlas', kind: 'shared' }]);

	recordExampleCases(
		{
			unitId: 'desktop.function.project-list',
			symbol: 'projectList',
			state: 'appends-the-shown-project-as-shared-for-github',
			evidence: 'examples-cases',
			file: 'appends-the-shown-project-as-shared-for-github.json'
		},
		[
			{
				name: 'github source appends a shared entry',
				input: { projects: LISTED, snapshot: summary(snapshot) },
				output: result
			}
		]
	);
});

test('Returns the list as given when no project is shown', () => {
	const result = projectList(LISTED, null);

	expect(result).toBe(LISTED);

	recordExampleCases(
		{
			unitId: 'desktop.function.project-list',
			symbol: 'projectList',
			state: 'returns-the-list-as-given-when-no-project-is-shown',
			evidence: 'examples-cases',
			file: 'returns-the-list-as-given-when-no-project-is-shown.json'
		},
		[{ name: 'no snapshot shown', input: { projects: LISTED, snapshot: null }, output: result }]
	);
});

test('Lists bridge projects or none when unsupported', async () => {
	const supported = { listProjects: () => Promise.resolve(LISTED) } as Bridge;
	const unsupported = {} as Bridge;
	const listed = await listedProjects(supported);
	const absent = await listedProjects(unsupported);

	expect(listed).toEqual(LISTED);
	expect(absent).toEqual([]);

	recordExampleCases(
		{
			unitId: 'desktop.function.project-list',
			symbol: 'listedProjects',
			state: 'lists-bridge-projects-or-none-when-unsupported',
			evidence: 'examples-cases',
			file: 'lists-bridge-projects-or-none-when-unsupported.json'
		},
		[
			{ name: 'bridge lists one project', input: 'bridge with listProjects', output: listed },
			{ name: 'bridge without listProjects', input: 'bridge without listProjects', output: absent }
		]
	);
});

test('Rejects with the bridge reason when listing fails', async () => {
	const reason = new Error('Bridge offline.');
	const failing = { listProjects: () => Promise.reject(reason) } as Bridge;
	const error = await listedProjects(failing).catch((caught: unknown) => caught);

	expect(error).toBe(reason);

	recordExampleCases(
		{
			unitId: 'desktop.function.project-list',
			symbol: 'listedProjects',
			state: 'rejects-with-the-bridge-reason-when-listing-fails',
			evidence: 'examples-cases',
			file: 'rejects-with-the-bridge-reason-when-listing-fails.json'
		},
		[
			{
				name: 'bridge listing rejects',
				input: 'bridge whose listProjects rejects',
				error: { name: reason.name, message: reason.message }
			}
		]
	);
});
