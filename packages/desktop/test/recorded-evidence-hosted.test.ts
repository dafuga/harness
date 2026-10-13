import { expect, test, vi } from 'vitest';
import type { DesktopBridge } from '../src/models/DesktopBridge.types';
import type { RemoteProjectPort } from '../src/models/ProjectContext.types';
import { HostedProjectService } from '../src/services/HostedProjectService';
import { ProjectSessionService } from '../src/services/ProjectSessionService';

const commit = 'a'.repeat(40);
const query = {
	projectId: 'shared-one',
	entityId: 'page.home',
	commit,
	branch: 'main',
	mode: 'current' as const
};
const artifact = {
	...query,
	side: 'after' as const,
	recordId: 'b'.repeat(64),
	scenarioId: 'home-page',
	state: 'filled',
	evidenceId: 'screens',
	viewport: 'desktop',
	sha256: 'c'.repeat(64),
	notesRevision: null,
	evidenceRevision: null
};

test('recorded evidence of a shared project is refused as that, and never read from a local one', async () => {
	const evidence = vi.fn(),
		read = vi.fn();
	const local = {
		listProjects: async () => [],
		evidence,
		artifact: read
	} as unknown as Omit<DesktopBridge, 'onRunEvent'>;
	const remote = {
		snapshot: async () => ({ project: { id: 'shared-one' } }),
		listProjects: async () => []
	} as unknown as RemoteProjectPort;
	const bridge = new HostedProjectService(new ProjectSessionService(), remote).wrap(local);
	await bridge.selectProject!({ projectId: 'shared-one' });
	const unread = /^Recorded evidence of a shared project is not read on this computer yet\.$/;
	await expect(bridge.evidence!(query)).rejects.toThrow(unread);
	await expect(bridge.artifact!(artifact)).rejects.toThrow(unread);
	await expect(bridge.evidence!({ ...query, projectId: 'shared-two' })).rejects.toThrow(
		'The requested project is not selected.'
	);
	expect(evidence).not.toHaveBeenCalled();
	expect(read).not.toHaveBeenCalled();
});
