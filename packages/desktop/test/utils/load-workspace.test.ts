import { expect, test, vi } from 'vitest';
import { loadWorkspace } from '../../src/utils/loadWorkspace';
import { workspaceRoute } from '../../src/utils/workspaceRoute';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';

const tip = 'a'.repeat(40);
const snapshotOf = (id: string, branch: string) =>
	({
		project: { name: id, root: '', id },
		capabilities: {
			comments: false,
			agents: false,
			planning: false,
			approval: false,
			source: 'github'
		},
		revision: { branch, commit: tip, tip, atTip: true },
		branches: [],
		commits: [],
		entities: [],
		writable: false
	}) as ProjectSnapshot;
const bridge = (value: object) => value as unknown as DesktopBridge;

test('the snapshot of a selection is reused when the link asks for that tip', async () => {
	const selectProject = vi.fn(async () => snapshotOf('p', 'main'));
	const snapshot = vi.fn(async () => snapshotOf('p', 'release'));
	const selection = { id: null as string | null };
	const tipLink = await loadWorkspace(
		bridge({ selectProject, snapshot }),
		workspaceRoute('/projects/p/harness/branch/main/pages'),
		selection
	);
	expect(tipLink.snapshot.revision.branch).toBe('main');
	expect(snapshot).not.toHaveBeenCalled();
	expect(selection.id).toBe('p');
	selection.id = null;
	const other = await loadWorkspace(
		bridge({ selectProject, snapshot }),
		workspaceRoute('/projects/p/harness/branch/release/pages'),
		selection
	);
	expect(snapshot).toHaveBeenCalledWith({ projectId: 'p', branch: 'release', commit: null });
	expect(other.snapshot.revision.branch).toBe('release');
});

test('a selection that fails leaves no project selected', async () => {
	const selectProject = vi.fn(async () => {
		throw new Error('Cancel or finish the current run before switching projects.');
	});
	const selection = { id: 'previous' as string | null };
	await expect(
		loadWorkspace(bridge({ selectProject }), workspaceRoute('/projects/p/harness/pages'), selection)
	).rejects.toThrow(/current run/);
	expect(selection.id).toBeNull();
});
