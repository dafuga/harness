import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte.types';
import { accountView, forgetRemote } from '../../src/utils/networking-security/forgetRemote';

const NOTICE = 'Computer disconnected';

/** A plain workspace with the fields forgetRemote reads; `patch` overrides any of them. */
function makeWorkspace(patch: Record<string, unknown>): Workspace {
	return {
		bridge: undefined,
		capabilities: { source: 'local' },
		snapshot: null,
		entity: null,
		offline: null,
		projects: [],
		error: '',
		target: null,
		selection: { id: null },
		invalidate: () => undefined,
		...patch
	} as unknown as Workspace;
}

/** The fields that matter after a call, as plain JSON. */
function summarize(workspace: Workspace, returned: boolean) {
	return {
		returned,
		projects: workspace.projects.map((item) => item.id),
		snapshotProject: workspace.snapshot?.project.id ?? null,
		entity: workspace.entity,
		target: workspace.target,
		selection: workspace.selection.id,
		error: workspace.error
	};
}

const computerProjects = [{ id: 'local-laptop', kind: 'local' }];
const accountProjects = [
	{ id: 'local-laptop', kind: 'local' },
	{ id: 'acct-repo', kind: 'hosted' }
];

test('Clears the computer view when no hosted account is signed in', () => {
	const workspace = makeWorkspace({
		projects: computerProjects,
		snapshot: { project: { id: 'local-laptop' } },
		entity: { id: 'local-laptop-entity' },
		target: 'local-laptop',
		selection: { id: 'local-laptop' }
	});
	const before = summarize(workspace, false);
	const returned = forgetRemote(workspace, NOTICE);
	const after = summarize(workspace, returned);

	expect(returned).toBe(false);
	expect(after.projects).toEqual([]);
	expect(after.snapshotProject).toBeNull();
	expect(after.entity).toBeNull();
	expect(after.target).toBeNull();
	expect(after.selection).toBeNull();
	expect(after.error).toBe(NOTICE);

	recordExampleCases(
		{
			unitId: 'desktop.function.forget-remote',
			symbol: 'forgetRemote',
			state: 'clears-the-computer-view-when-no-hosted-account-is-signed-in',
			evidence: 'examples-cases',
			file: 'clears-the-computer-view-when-no-hosted-account-is-signed-in.json'
		},
		[
			{
				name: 'forget a computer with no hosted account',
				input: { hostedStatus: false, projects: ['local-laptop'], notice: NOTICE },
				output: { before, after }
			}
		]
	);
});

test('Keeps the account view and its projects when signed in', () => {
	const workspace = makeWorkspace({
		bridge: { hostedStatus: true },
		capabilities: { source: 'github' },
		snapshot: { project: { id: 'acct-repo' } },
		projects: accountProjects,
		target: 'local-laptop',
		selection: { id: 'local-laptop' }
	});
	const kept = accountView(workspace);
	const returned = forgetRemote(workspace);
	const after = summarize(workspace, returned);

	expect(kept).toBe(true);
	expect(returned).toBe(true);
	expect(after.projects).toEqual(['acct-repo']);
	expect(after.snapshotProject).toBe('acct-repo');
	expect(after.target).toBeNull();
	expect(after.selection).toBeNull();
	expect(after.error).toBe('');

	recordExampleCases(
		{
			unitId: 'desktop.function.forget-remote',
			symbol: 'forgetRemote',
			state: 'keeps-the-account-view-and-its-projects-when-signed-in',
			evidence: 'examples-cases',
			file: 'keeps-the-account-view-and-its-projects-when-signed-in.json'
		},
		[
			{
				name: 'account view is eligible to keep',
				input: { hostedStatus: true, source: 'github', snapshotProject: 'acct-repo' },
				output: kept
			},
			{
				name: 'forget remote keeps the account view',
				input: { projects: ['local-laptop', 'acct-repo'], notice: '' },
				output: after
			}
		]
	);
});

test('Clears a computer view while the account stays signed in', () => {
	const workspace = makeWorkspace({
		bridge: { hostedStatus: true },
		capabilities: { source: 'github' },
		snapshot: { project: { id: 'local-laptop' } },
		entity: { id: 'local-laptop-entity' },
		projects: accountProjects,
		target: 'local-laptop'
	});
	const kept = accountView(workspace);
	const returned = forgetRemote(workspace, NOTICE);
	const after = summarize(workspace, returned);

	expect(kept).toBe(false);
	expect(returned).toBe(true);
	expect(after.projects).toEqual(['acct-repo']);
	expect(after.snapshotProject).toBeNull();
	expect(after.entity).toBeNull();
	expect(after.target).toBeNull();
	expect(after.error).toBe(NOTICE);

	recordExampleCases(
		{
			unitId: 'desktop.function.forget-remote',
			symbol: 'forgetRemote',
			state: 'clears-a-computer-view-while-the-account-stays-signed-in',
			evidence: 'examples-cases',
			file: 'clears-a-computer-view-while-the-account-stays-signed-in.json'
		},
		[
			{
				name: 'computer view is not an eligible account view',
				input: { hostedStatus: true, source: 'github', snapshotProject: 'local-laptop' },
				output: kept
			},
			{
				name: 'forget remote clears the computer view',
				input: { projects: ['local-laptop', 'acct-repo'], notice: NOTICE },
				output: after
			}
		]
	);
});
