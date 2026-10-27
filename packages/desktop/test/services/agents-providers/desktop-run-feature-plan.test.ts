import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { DesktopRunService } from '../../../src/services/agents-providers/desktop-run-service/DesktopRunService';
import type { ProjectSessionService } from '../../../src/services/projects-sessions/project-session-service/ProjectSessionService';
import type { FeaturePlanPreparationRequest } from '../../../src/models/development-tooling/DesktopBridge.types';

test('prepareFeaturePlan enforces project and revision guards while releasing its lease', async () => {
	const missingSession = {
		root: null,
		busy: false,
		assertProject: vi.fn()
	} as unknown as ProjectSessionService;
	const missingService = new DesktopRunService(missingSession, null!, null!, vi.fn());
	await expect(
		missingService.prepareFeaturePlan({ projectId: 'selected' } as FeaturePlanPreparationRequest)
	).rejects.toThrow('A project operation is already active.');
	expect(missingSession.assertProject).toHaveBeenCalledExactlyOnceWith('selected');
	expect(missingSession.busy).toBe(false);
	const root = await mkdtemp(join(tmpdir(), 'harness-feature-plan-run-')),
		arbiter = { hold: vi.fn(() => true), release: vi.fn() },
		staleSession = {
			root,
			busy: false,
			arbiter,
			assertProject: vi.fn(),
			mutable: vi.fn(async () => ({ revision: { commit: 'b'.repeat(40) } }))
		} as unknown as ProjectSessionService,
		staleService = new DesktopRunService(staleSession, null!, null!, vi.fn());
	try {
		await expect(
			staleService.prepareFeaturePlan({
				projectId: 'selected',
				sourceCommit: 'a'.repeat(40),
				proposal: { feature: 'feature' }
			} as FeaturePlanPreparationRequest)
		).rejects.toThrow('Feature plan source must match the writable project revision.');
		expect(staleSession.busy).toBe(false);
		expect(arbiter.release).toHaveBeenCalledExactlyOnceWith(root, staleService);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('cancelActive aborts the currently active desktop run', () => {
	const service = new DesktopRunService({} as ProjectSessionService, null!, null!, vi.fn()),
		controller = new AbortController();
	(service as unknown as { active: { id: string; controller: AbortController } }).active = {
		id: 'run-1',
		controller
	};
	service.cancelActive();
	expect(controller.signal.aborted).toBe(true);
});

test('cancel aborts only the matching desktop run ID', () => {
	const service = new DesktopRunService({} as ProjectSessionService, null!, null!, vi.fn()),
		controller = new AbortController();
	(service as unknown as { active: { id: string; controller: AbortController } }).active = {
		id: 'run-1',
		controller
	};
	expect(service.cancel('run-other')).toBe(false);
	expect(controller.signal.aborted).toBe(false);
	expect(service.cancel('run-1')).toBe(true);
	expect(controller.signal.aborted).toBe(true);
});
