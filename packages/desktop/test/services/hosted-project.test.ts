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
