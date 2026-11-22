import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { openProject } from '../../src/utils/projects-sessions/openProject';

function makeWorkspace(response: unknown, failure?: Error) {
	const calls = { navigated: '', loaded: 0 };
	const workspace = {
		bridge: { openProject: async () => {
			if (failure) throw failure;
			return response;
		} },
		selection: { id: 'previous' },
		busy: false,
		error: 'old error',
		navigate: async (path: string) => { calls.navigated = path; },
		loadProjects: async () => { calls.loaded += 1; }
	} as unknown as Parameters<typeof openProject>[0];
	return { workspace, calls };
}

test('opens a project on its branch pages and refreshes the list', async () => {
	const { workspace, calls } = makeWorkspace({
		project: { id: 'project-42' }, revision: { branch: 'feature/demo' }
	});
	await openProject(workspace);

	expect(workspace.selection.id).toBe('project-42');
	expect(calls.navigated).toContain('project-42');
	expect(calls.navigated).toContain('feature%2Fdemo');
	expect(calls.loaded).toBe(1);
	expect(workspace.busy).toBe(false);
	expect(workspace.error).toBe('');
	recordExampleCases(
		{
			unitId: 'desktop.function.open-project',
			symbol: 'openProject',
			state: 'opens-a-project-on-its-branch-pages-and-refreshes-the-list',
			evidence: 'examples-cases',
			file: 'opens-a-project-on-its-branch-pages-and-refreshes-the-list.json'
		},
		[{
			name: 'select project-42 on feature/demo',
			input: { projectId: 'project-42', branch: 'feature/demo' },
			output: {
				selectionId: workspace.selection.id,
				navigation: calls.navigated,
				loaded: calls.loaded,
				busy: workspace.busy,
				error: workspace.error
			}
		}]
	);
});

test('stores a bridge failure and clears busy state', async () => {
	const { workspace, calls } = makeWorkspace(null, new Error('Connection unavailable'));
	await openProject(workspace);

	expect(workspace.error).toBe('Error: Connection unavailable');
	expect(workspace.busy).toBe(false);
	expect(calls.loaded).toBe(0);
	recordExampleCases(
		{
			unitId: 'desktop.function.open-project',
			symbol: 'openProject',
			state: 'stores-a-bridge-failure-and-clears-busy-state',
			evidence: 'examples-cases',
			file: 'stores-a-bridge-failure-and-clears-busy-state.json'
		},
		[{
			name: 'connection fails while opening a project',
			input: { failure: 'Connection unavailable' },
			output: { error: workspace.error, busy: workspace.busy, loaded: calls.loaded }
		}]
	);
});
