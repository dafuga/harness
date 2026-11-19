import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createWorkspaceStore } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import { closedCapabilities } from '../../src/utils/projects-sessions/projectCapabilities';

const commit = 'c'.repeat(40);
const snapshot = {
	project: { id: 'project-7', name: 'sample', root: '/workspace/sample' },
	capabilities: { comments: true, agents: true, planning: true, approval: true, source: 'local' },
	revision: { branch: 'main', commit, tip: commit, atTip: true },
	branches: [],
	commits: [],
	entities: [],
	writable: true
};

afterEach(() => vi.unstubAllGlobals());

test('starts with no project shown', () => {
	const first = createWorkspaceStore();
	const second = createWorkspaceStore();
	const shown = {
		distinct: first !== second,
		projectId: first.projectId,
		snapshot: first.snapshot,
		entity: first.entity,
		category: first.category,
		suffix: first.suffix,
		projects: first.projects,
		capabilities: first.capabilities,
		offline: first.offline,
		error: first.error,
		bridge: first.bridge,
		path: first.path()
	};

	expect(shown).toEqual({
		distinct: true,
		projectId: null,
		snapshot: null,
		entity: null,
		category: 'pages',
		suffix: null,
		projects: [],
		capabilities: closedCapabilities,
		offline: null,
		error: '',
		bridge: undefined,
		path: '/'
	});
	recordExampleCases(
		{
			unitId: 'desktop.store.workspace',
			symbol: 'createWorkspaceStore',
			state: 'starts-with-no-project-shown',
			evidence: 'examples-cases',
			file: 'starts-with-no-project-shown.json'
		},
		[{ name: 'create two stores with no bridge connected', input: null, output: shown }]
	);
});

test('ignores actions while no bridge is connected', async () => {
	const pushState = vi.fn();
	vi.stubGlobal('history', { pushState, replaceState: vi.fn() });
	// refresh reads the page address before navigate checks for a bridge; a browser always has one.
	vi.stubGlobal('location', { pathname: '/harness/branch/main/pages' });
	const store = createWorkspaceStore();
	await store.navigate('/harness/branch/main/pages');
	await store.loadProjects();
	await store.refresh();
	const idle = {
		snapshot: store.snapshot,
		entity: store.entity,
		projects: store.projects,
		busy: store.busy,
		error: store.error,
		pushed: pushState.mock.calls.length
	};

	expect(idle).toEqual({
		snapshot: null,
		entity: null,
		projects: [],
		busy: false,
		error: '',
		pushed: 0
	});
	recordExampleCases(
		{
			unitId: 'desktop.store.workspace',
			symbol: 'navigate, loadProjects, refresh',
			state: 'ignores-actions-while-no-bridge-is-connected',
			evidence: 'examples-cases',
			file: 'ignores-actions-while-no-bridge-is-connected.json'
		},
		[
			{
				name: 'navigate, list and refresh before connect',
				input: { url: '/harness/branch/main/pages' },
				output: idle
			}
		]
	);
});

test('loads the shown project once connect supplies a bridge', async () => {
	const pushState = vi.fn();
	vi.stubGlobal('history', { pushState, replaceState: vi.fn() });
	const calls: string[] = [];
	const bridge = {
		snapshot: async () => {
			calls.push('snapshot');
			return snapshot;
		}
	} as unknown as DesktopBridge;
	const store = createWorkspaceStore();
	store.connect(bridge);
	await store.navigate('/harness/branch/main/pages');
	const loaded = {
		calls,
		projectId: store.projectId,
		busy: store.busy,
		error: store.error,
		pushed: pushState.mock.calls.length
	};

	expect(loaded).toEqual({ calls: ['snapshot'], projectId: 'project-7', busy: false, error: '', pushed: 1 });
	recordExampleCases(
		{
			unitId: 'desktop.store.workspace',
			symbol: 'connect, navigate',
			state: 'loads-the-shown-project-once-connect-supplies-a-bridge',
			evidence: 'examples-cases',
			file: 'loads-the-shown-project-once-connect-supplies-a-bridge.json'
		},
		[
			{
				name: 'connect the bridge then open the main branch pages',
				input: { url: '/harness/branch/main/pages' },
				output: loaded
			}
		]
	);
});
