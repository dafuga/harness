import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorkspaceStore } from '../../src/lib/stores/workspace.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { EntityDetail, ProjectSnapshot } from '../../src/models/Desktop.types';
import type { ProjectCapabilities } from '../../src/models/ProjectContext.types';

const tip = 'a'.repeat(40);
const open: ProjectCapabilities = {
	comments: true,
	agents: true,
	planning: true,
	approval: true,
	source: 'local'
};
function snapshotOf(id: string | undefined, branch: string, commit: string | null = null) {
	return {
		project: { name: id ?? 'legacy', root: `/tmp/${id}`, ...(id ? { id } : {}) },
		...(id ? { capabilities: open } : {}),
		revision: { branch, commit: commit ?? tip, tip, atTip: !commit || commit === tip },
		branches: [],
		commits: [],
		entities: [],
		writable: !commit
	} satisfies ProjectSnapshot;
}
/** Like the main process: one selected project, and a request for another one is refused. */
function bridgeOf(branches: Record<string, string>) {
	let selected: string | null = null;
	const own = (input: { projectId?: string }) => {
		if (!selected || (input.projectId !== undefined && input.projectId !== selected))
			throw new Error('The requested project is not selected.');
		return selected;
	};
	const bridge = {
		addComment: vi.fn(),
		listProjects: vi.fn(async () =>
			Object.keys(branches).map((id) => ({ id, name: id, kind: 'local' as const }))
		),
		selectProject: vi.fn(async ({ projectId }: { projectId: string }) => {
			selected = projectId;
			return snapshotOf(projectId, branches[projectId]);
		}),
		snapshot: vi.fn(async (input: { projectId?: string; commit: string | null }) => {
			const id = own(input);
			return snapshotOf(id, branches[id], input.commit);
		}),
		entity: vi.fn(async (input: { projectId?: string; entityId: string }) => {
			return { id: input.entityId, title: own(input) } as EntityDetail;
		})
	};
	return bridge;
}
const connected = (bridge: object) => {
	const store = createWorkspaceStore();
	store.connect(bridge as unknown as DesktopBridge);
	return store;
};
let history: { pushState: ReturnType<typeof vi.fn>; replaceState: ReturnType<typeof vi.fn> };
beforeEach(() => {
	history = { pushState: vi.fn(), replaceState: vi.fn() };
	vi.stubGlobal('history', history);
});
afterEach(() => vi.unstubAllGlobals());

test('a project link selects its project before any read and names it in every request', async () => {
	const bridge = bridgeOf({ one: 'feat/x', two: 'main' });
	const store = connected(bridge);
	const earlier = 'c'.repeat(40);
	await store.navigate(
		`/projects/one/harness/branch/feat%2Fx/commit/${earlier}/pages/page%3Aa/history`
	);
	expect(store.error).toBe('');
	expect(bridge.selectProject).toHaveBeenCalledWith({ projectId: 'one' });
	expect(bridge.selectProject.mock.invocationCallOrder[0]).toBeLessThan(
		bridge.snapshot.mock.invocationCallOrder[0]
	);
	expect(bridge.snapshot).toHaveBeenCalledWith({
		projectId: 'one',
		branch: 'feat/x',
		commit: earlier
	});
	expect(bridge.entity).toHaveBeenCalledWith({
		projectId: 'one',
		entityId: 'page:a',
		commit: earlier
	});
	expect(store.projectId).toBe('one');
	expect(store.suffix).toBe('history');
	expect(store.path('components')).toBe(
		`/projects/one/harness/branch/feat%2Fx/commit/${earlier}/components`
	);
	expect(store.path('pages', 'page:a', 'details')).toBe(
		`/projects/one/harness/branch/feat%2Fx/commit/${earlier}/pages/page%3Aa/source`
	);
	expect(store.capabilities).toEqual(open);
});

test('switching keeps the category, drops the entity and pushes the link of the new tip', async () => {
	const bridge = bridgeOf({ one: 'feat/x', two: 'main' });
	const store = connected(bridge);
	await store.navigate('/projects/one/harness/branch/feat%2Fx/components/component%3Abutton');
	expect(store.entity?.id).toBe('component:button');
	bridge.snapshot.mockClear();
	bridge.entity.mockClear();
	await store.switchProject('two');
	expect(store.projectId).toBe('two');
	expect(store.category).toBe('components');
	expect(store.entity).toBeNull();
	expect(store.snapshot?.revision.branch).toBe('main');
	expect(history.pushState).toHaveBeenLastCalledWith(
		{},
		'',
		'/projects/two/harness/branch/main/components'
	);
	expect(bridge.entity).not.toHaveBeenCalled();
	for (const call of bridge.snapshot.mock.calls) expect(call[0].projectId).toBe('two');
	await store.navigate(store.path('pages'));
	expect(bridge.selectProject).toHaveBeenCalledTimes(2);
	expect(bridge.snapshot).toHaveBeenLastCalledWith({
		projectId: 'two',
		branch: 'main',
		commit: null
	});
});

test('an answer for the previous project that arrives late is discarded', async () => {
	const bridge = bridgeOf({ one: 'feat/x', two: 'main' });
	const store = connected(bridge);
	await store.navigate('/projects/one/harness/branch/feat%2Fx/pages');
	let release = () => {};
	bridge.entity.mockImplementationOnce(async (input) => {
		await new Promise<void>((done) => (release = done));
		return { id: input.entityId, title: 'one' } as EntityDetail;
	});
	const slow = store.navigate('/projects/one/harness/branch/feat%2Fx/pages/page%3Aa');
	await vi.waitFor(() => expect(bridge.entity).toHaveBeenCalled());
	const switched = store.switchProject('two');
	expect(bridge.selectProject).toHaveBeenCalledTimes(1);
	release();
	await Promise.all([slow, switched]);
	expect(store.projectId).toBe('two');
	expect(store.entity).toBeNull();
	expect(store.busy).toBe(false);
	expect(store.error).toBe('');
	expect(history.pushState).toHaveBeenLastCalledWith(
		{},
		'',
		'/projects/two/harness/branch/main/pages'
	);
});

test('an answer that names another project is refused', async () => {
	const bridge = bridgeOf({ one: 'feat/x', two: 'main' });
	bridge.snapshot.mockImplementation(async () => snapshotOf('two', 'main', 'c'.repeat(40)));
	const store = connected(bridge);
	await store.navigate(`/projects/one/harness/branch/feat%2Fx/commit/${'c'.repeat(40)}/pages`);
	expect(store.snapshot).toBeNull();
	expect(store.error).toMatch(/another project/);
});

test('a bridge without project operations keeps legacy links and its proven capabilities', async () => {
	const snapshot = vi.fn(async () => snapshotOf(undefined, 'feat/activity'));
	const store = connected({ snapshot });
	await store.navigate('/harness/branch/feat%2Factivity/functions');
	expect(snapshot).toHaveBeenCalledWith({ branch: 'feat/activity', commit: null });
	expect(store.projectId).toBeNull();
	expect(store.context).toEqual({});
	expect(store.path('pages', 'page:a')).toBe('/harness/branch/feat%2Factivity/pages/page%3Aa');
	expect(store.capabilities).toEqual({ ...open, comments: false });
	await store.loadProjects();
	expect(store.projects).toEqual([]);
	expect(store.error).toBe('');
});

test('capabilities that cannot be read close every write', async () => {
	const bridge = bridgeOf({ one: 'main' });
	bridge.selectProject.mockImplementation(async () => ({
		...snapshotOf('one', 'main'),
		capabilities: undefined
	}));
	const capabilities = vi.fn(async () => {
		throw new Error('offline');
	});
	const store = connected({ ...bridge, capabilities, addComment: vi.fn() });
	await store.navigate('/projects/one/harness/pages');
	expect(capabilities).toHaveBeenCalledWith({ projectId: 'one' });
	expect(store.snapshot?.project.id).toBe('one');
	expect(store.capabilities).toMatchObject({
		comments: false,
		agents: false,
		planning: false,
		approval: false
	});
});

test.each([false, true])(
	'a refreshed account list clears a removed shared project (cached=%s) and all of its actions',
	async (cached) => {
		const bridge = bridgeOf({ shared: 'main' });
		const store = connected(bridge);
		await store.navigate('/projects/shared/harness/pages');
		store.capabilities = { ...open, source: 'github' };
		if (cached) store.offline = { cachedAt: '2026-10-19T12:00:00.000Z' };
		bridge.listProjects.mockResolvedValue([]);
		await store.loadProjects();
		expect(store.projects).toEqual([]);
		expect(store.snapshot, 'removed shared project is no longer rendered').toBeNull();
		expect(store.entity).toBeNull();
		expect(store.capabilities.agents).toBe(false);
		expect(store.capabilities.comments).toBe(false);
	}
);
