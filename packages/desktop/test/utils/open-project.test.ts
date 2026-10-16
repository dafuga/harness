import { afterEach, expect, test, vi } from 'vitest';
import { createWorkspaceStore } from '../../src/lib/stores/workspace.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';

const tip = 'a'.repeat(40);
const snapshot = {
	project: { name: 'legacy', root: '/tmp/legacy' },
	revision: { branch: 'feat/x', commit: tip, tip, atTip: true },
	branches: [],
	commits: [],
	entities: [],
	writable: true
} satisfies ProjectSnapshot;
afterEach(() => vi.unstubAllGlobals());

test('a chosen folder opens at its branch; a cancelled choice changes nothing', async () => {
	const pushState = vi.fn();
	vi.stubGlobal('history', { pushState });
	const openProject = vi.fn(async (): Promise<ProjectSnapshot | null> => null);
	const read = vi.fn(async () => snapshot);
	const store = createWorkspaceStore();
	store.connect({ openProject, snapshot: read } as unknown as DesktopBridge);
	await store.openProject();
	expect(store.snapshot).toBeNull();
	expect(read).not.toHaveBeenCalled();
	openProject.mockResolvedValueOnce(snapshot);
	await store.openProject();
	expect(read).toHaveBeenCalledWith({ branch: 'feat/x', commit: null });
	expect(pushState).toHaveBeenCalledWith({}, '', '/harness/branch/feat%2Fx/pages');
	expect(store.busy).toBe(false);
});
