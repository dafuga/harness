import { test, expect, vi } from 'vitest';
import { HostedProjectService } from '../../src/services/HostedProjectService';
import { ProjectSessionService } from '../../src/services/ProjectSessionService';
import type { RemoteProjectPort } from '../../src/models/ProjectContext.types';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
test('selected shared context never falls through to local executors and stale context cannot cross projects', async () => {
	const localRun = vi.fn(),
		localRead = vi.fn();
	const local = {
		listProjects: async () => [],
		startRun: localRun,
		entity: localRead
	} as unknown as Omit<DesktopBridge, 'onRunEvent'>;
	const snapshot = { project: { id: 'shared-one' } };
	const remote = {
		snapshot: async () => snapshot,
		listProjects: async () => [],
		entity: vi.fn(async () => ({ id: 'page.home' })),
		addComment: vi.fn()
	} as unknown as RemoteProjectPort;
	const bridge = new HostedProjectService(new ProjectSessionService(), remote).wrap(local);
	await bridge.selectProject!({ projectId: 'shared-one' });
	await expect(
		bridge.entity({ projectId: 'shared-two', entityId: 'page.home', commit: 'a'.repeat(40) })
	).rejects.toThrow('project');
	await expect(
		bridge.startRun({ projectId: 'shared-one' } as Parameters<DesktopBridge['startRun']>[0])
	).rejects.toThrow('unavailable');
	expect(
		await bridge.entity({ projectId: 'shared-one', entityId: 'page.home', commit: 'a'.repeat(40) })
	).toEqual({ id: 'page.home' });
	expect(localRun).not.toHaveBeenCalled();
	expect(localRead).not.toHaveBeenCalled();
});

test('during active work the open local project is read again, while any switch still waits', async () => {
	const session = new ProjectSessionService();
	Object.assign(session, { projectId: 'local-' + 'a'.repeat(64) });
	const reread = vi.fn(async (input: { projectId: string }) => ({
		project: { id: input.projectId }
	}));
	const local = { listProjects: async () => [], selectProject: reread } as unknown as Omit<
		DesktopBridge,
		'onRunEvent'
	>;
	const remote = {
		snapshot: vi.fn(async () => ({ project: { id: 'shared-one' } })),
		listProjects: async () => []
	} as unknown as RemoteProjectPort;
	const bridge = new HostedProjectService(session, remote).wrap(local),
		open = { projectId: session.projectId! },
		waits = 'Wait for the active project operation.';
	for (const work of [
		{ busy: true, pending: 0 },
		{ busy: false, pending: 1 }
	]) {
		Object.assign(session, work);
		await expect(bridge.selectProject!(open)).resolves.toEqual({ project: { id: open.projectId } });
		await expect(bridge.selectProject!({ projectId: 'local-' + 'b'.repeat(64) })).rejects.toThrow(
			waits
		);
		await expect(bridge.selectProject!({ projectId: 'shared-one' })).rejects.toThrow(waits);
		expect(session).toMatchObject(work);
	}
	expect(reread.mock.calls).toEqual([[open], [open]]);
	expect(remote.snapshot).not.toHaveBeenCalled();
	Object.assign(session, { busy: false, pending: 0 });
	await bridge.selectProject!({ projectId: 'shared-one' });
	Object.assign(session, { busy: true });
	await expect(bridge.selectProject!(open)).rejects.toThrow(waits);
});
