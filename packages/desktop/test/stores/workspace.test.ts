import { expect } from '../../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import { createWorkspaceStore } from '../../src/lib/stores/workspace.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';

afterEach(() => vi.unstubAllGlobals());
test('preview cannot open or navigate without the native bridge', async () => {
	const store = createWorkspaceStore();
	await store.openProject();
	await store.navigate('/harness/branch/main/pages');
	expect(store.snapshot).toBeNull();
	expect(store.entity).toBeNull();
	expect(store.busy).toBe(false);
});
test('historical paths preserve encoded branch, full commit, actual tip and entity identity', async () => {
	const commit = 'a'.repeat(40),
		tip = 'b'.repeat(40);
	const snapshot = vi.fn(
		async () =>
			({
				revision: { branch: 'feat/activity', commit, tip, atTip: false },
				entities: [],
				branches: [],
				commits: [],
				writable: false,
				project: { name: 'fixture', root: '/tmp/fixture' }
			}) satisfies ProjectSnapshot
	);
	const entity = vi.fn(async () => ({ id: 'page:activity' }));
	const history = { pushState: vi.fn() };
	vi.stubGlobal('history', history);
	const store = createWorkspaceStore();
	store.connect({ snapshot, entity } as unknown as DesktopBridge);
	await store.navigate(
		`/harness/branch/feat%2Factivity/commit/${commit}/pages/page%3Aactivity/history`
	);
	expect(snapshot).toHaveBeenCalledWith({ branch: 'feat/activity', commit });
	expect(entity).toHaveBeenCalledWith({ entityId: 'page:activity', commit });
	expect(store.snapshot?.revision.tip).toBe(tip);
	expect(store.path('pages', 'page:activity')).toBe(
		`/harness/branch/feat%2Factivity/commit/${commit}/pages/page%3Aactivity`
	);
	expect(store.snapshot?.writable).toBe(false);
});

test('explicit current-tip commit stays pinned through navigation until returning to branch tip', async () => {
	const tip = 'b'.repeat(40);
	const snapshot = vi.fn(async ({ commit }: { commit: string | null }) => ({
		project: { name: 'fixture', root: '/tmp/fixture' },
		revision: { branch: 'feat/activity', commit: commit || tip, tip, atTip: true },
		entities: [],
		branches: [],
		commits: [],
		writable: !commit
	}));
	vi.stubGlobal('history', { pushState: vi.fn() });
	const store = createWorkspaceStore();
	store.connect({ snapshot } as unknown as DesktopBridge);
	await store.navigate(`/harness/branch/feat%2Factivity/commit/${tip}/pages`);
	expect(store.path('pages', 'page:activity')).toBe(
		`/harness/branch/feat%2Factivity/commit/${tip}/pages/page%3Aactivity`
	);
	await store.navigate(store.path('components'));
	expect(snapshot).toHaveBeenLastCalledWith({ branch: 'feat/activity', commit: tip });
	expect(store.snapshot?.writable).toBe(false);
	await store.navigate('/harness/branch/feat%2Factivity/pages');
	expect(store.path('pages', 'page:activity')).toBe(
		'/harness/branch/feat%2Factivity/pages/page%3Aactivity'
	);
	expect(store.snapshot?.writable).toBe(true);
});
