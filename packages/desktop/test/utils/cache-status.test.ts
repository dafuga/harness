import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorkspaceStore } from '../../src/lib/stores/workspace.svelte';
import { deniedNotice, offlineNotice } from '../../src/utils/cache-status/cacheStatus';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { EntityDetail, ProjectSnapshot } from '../../src/models/Desktop.types';
import type { CacheStatus } from '../../src/models/ProjectContext.types';

const tip = 'a'.repeat(40);
const saved = '2026-10-12T08:00:00.000Z';
type Cache = NonNullable<ProjectSnapshot['cache']>;
function snapshotOf(id: string, source: 'local' | 'github', status: Cache['status'] = 'fresh') {
	return {
		project: { name: id, root: '', id },
		capabilities: { comments: true, agents: false, planning: false, approval: false, source },
		cache: { identity: {} as Cache['identity'], status, publication: 'remote' },
		revision: { branch: 'main', commit: tip, tip, atTip: true },
		branches: [],
		commits: [],
		entities: [],
		writable: true
	} satisfies ProjectSnapshot;
}
/** A bridge with one local and one shared project and a cache channel the test speaks on. */
function connected(status: Cache['status'] = 'fresh') {
	let emit: (event: CacheStatus) => void = () => {};
	const off = vi.fn();
	const kinds = { 'local-1': 'local', 'shared-1': 'github', 'shared-2': 'github' } as const;
	const bridge = {
		addComment: vi.fn(),
		onCacheStatus: (listener: (event: CacheStatus) => void) => {
			emit = listener;
			return off;
		},
		listProjects: vi.fn(async () => [
			{ id: 'local-1', name: 'Local', kind: 'local' as const },
			{ id: 'shared-1', name: 'Shared', kind: 'shared' as const }
		]),
		selectProject: vi.fn(async ({ projectId }: { projectId: keyof typeof kinds }) =>
			snapshotOf(projectId, kinds[projectId], status)
		),
		entity: vi.fn(async ({ entityId }: { entityId: string }) => ({ id: entityId }) as EntityDetail)
	};
	const store = createWorkspaceStore();
	store.connect(bridge as unknown as DesktopBridge);
	return { store, bridge, off, emit: (event: CacheStatus) => emit(event) };
}
const closed = { comments: false, agents: false, planning: false, approval: false };
let history: { pushState: ReturnType<typeof vi.fn>; replaceState: ReturnType<typeof vi.fn> };
beforeEach(() => {
	history = { pushState: vi.fn(), replaceState: vi.fn() };
	vi.stubGlobal('history', history);
});
afterEach(() => vi.unstubAllGlobals());

test('an offline event of the shown project makes it read-only at once; a later fresh one does not undo it', async () => {
	const { store, emit } = connected();
	await store.navigate('/projects/shared-1/harness/pages/page.a');
	emit({ projectId: 'shared-2', status: 'offline', cachedAt: saved });
	expect(store.offline).toBeNull();
	expect(store.capabilities.comments).toBe(true);
	emit({ projectId: 'shared-1', status: 'offline', cachedAt: saved });
	expect(store.offline).toEqual({ cachedAt: saved });
	expect(store.snapshot?.writable).toBe(false);
	expect(store.snapshot?.cache).toMatchObject({
		status: 'offline',
		readOnly: true,
		cachedAt: saved
	});
	expect(store.capabilities).toEqual({ ...closed, source: 'github', reason: offlineNotice });
	expect(store.entity?.id).toBe('page.a');
	emit({ projectId: 'shared-1', status: 'fresh' });
	expect(store.offline).toEqual({ cachedAt: saved });
	expect(store.capabilities.comments).toBe(false);
});

test('a snapshot that is itself a cached copy allows nothing, whatever it states', async () => {
	const { store } = connected('offline');
	await store.navigate('/projects/shared-1/harness/pages');
	expect(store.snapshot?.project.id).toBe('shared-1');
	expect(store.snapshot?.writable).toBe(false);
	expect(store.offline).toEqual({ cachedAt: null });
	expect(store.capabilities).toMatchObject({ ...closed, source: 'github' });
});

test('a denied session clears the shown shared project and its listing; a denial for another project does not', async () => {
	const { store, emit } = connected();
	await store.loadProjects();
	await store.navigate('/projects/shared-1/harness/pages/page.a');
	emit({ projectId: 'shared-2', status: 'denied' });
	expect(store.entity?.id).toBe('page.a');
	emit({ projectId: '$projects', status: 'denied' });
	expect(store.snapshot).toBeNull();
	expect(store.entity).toBeNull();
	expect(store.capabilities).toMatchObject(closed);
	expect(store.error).toBe(deniedNotice);
	expect(store.projects.map((item) => item.id)).toEqual(['local-1']);
	emit({ projectId: 'shared-1', status: 'fresh' });
	expect(store.snapshot).toBeNull();
});

test('a local project stays when the session is denied', async () => {
	const { store, emit } = connected();
	await store.loadProjects();
	await store.navigate('/projects/local-1/harness/pages/page.a');
	emit({ projectId: '$projects', status: 'denied' });
	expect(store.snapshot?.project.id).toBe('local-1');
	expect(store.entity?.id).toBe('page.a');
	expect(store.error).toBe('');
	expect(store.projects.map((item) => item.id)).toEqual(['local-1']);
});

test('a read under way for a denied project is never published, also when it answers late', async () => {
	const { store, bridge, emit } = connected();
	await store.loadProjects();
	await store.navigate('/projects/local-1/harness/pages');
	let answer = () => {};
	bridge.entity.mockImplementationOnce(async ({ entityId }) => {
		await new Promise<void>((done) => (answer = done));
		return { id: entityId } as EntityDetail;
	});
	const pending = store.navigate('/projects/shared-1/harness/pages/page.secret');
	await vi.waitFor(() => expect(bridge.entity).toHaveBeenCalled());
	emit({ projectId: 'shared-1', status: 'denied' });
	expect(store.busy).toBe(false);
	answer();
	await pending;
	expect(store.snapshot?.project.id).toBe('local-1');
	expect(store.entity).toBeNull();
	expect(history.pushState).toHaveBeenCalledTimes(1);
});

test('the subscription ends with the workspace', () => {
	const { store, off } = connected();
	expect(off).not.toHaveBeenCalled();
	store.connect(undefined);
	expect(off).toHaveBeenCalledTimes(1);
});
