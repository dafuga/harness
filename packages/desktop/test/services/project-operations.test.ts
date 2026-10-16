import { test, expect, vi } from 'vitest';
import { fixture, git } from '../project-fixture';
import { desktopBridge } from '../../src/utils/desktopBridge';
import type { ProviderDiscoveryService } from '../../src/services/ProviderDiscoveryService';
import type { DesktopRunService } from '../../src/services/DesktopRunService';
import type { HumanCommentDraft } from '../../src/models/ProjectContext.types';
function bridgeFor(session: Awaited<ReturnType<typeof fixture>>['session']) {
	const start = vi.fn(),
		cancel = vi.fn();
	const bridge = desktopBridge({
		session,
		providers: { list: async () => [] } as unknown as ProviderDiscoveryService,
		runs: { start, cancel } as unknown as DesktopRunService,
		choose: async () => null
	});
	return { bridge, start, cancel };
}
test('a historical human comment saves a pending draft without Git mutation or agent execution', async () => {
	const f = await fixture(),
		{ bridge, start } = bridgeFor(f.session);
	const before = git(f.root, 'status', '--porcelain'),
		head = git(f.root, 'rev-parse', 'HEAD');
	const input: HumanCommentDraft = {
		projectId: f.session.projectId!,
		requestId: '10000000-0000-4000-8000-000000000001',
		anchor: {
			branch: 'main',
			commit: f.base,
			entityId: 'page.home',
			version: null,
			imageSha256: null,
			state: null,
			viewport: null,
			region: null
		},
		text: 'Human review of historical source'
	};
	const result = await bridge.addComment!(input);
	expect(result.kind).toBe('pending');
	expect(start).not.toHaveBeenCalled();
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(head);
	expect(git(f.root, 'status', '--porcelain')).toBe(before);
	expect(await bridge.pendingComments!({ projectId: f.session.projectId! })).toEqual([result]);
	await expect(
		bridge.addComment!({
			...input,
			requestId: '10000000-0000-4000-8000-000000000002',
			anchor: { ...input.anchor, entityId: 'unknown' }
		})
	).rejects.toThrow();
}, 15000);
test('every explicit request refuses stale project context before reading or starting an agent', async () => {
	const a = await fixture(),
		b = await fixture(),
		{ bridge, start, cancel } = bridgeFor(a.session);
	const projectId = a.session.projectId!;
	await a.session.open(b.root);
	const input = { projectId, entityId: 'page.home', commit: b.tip };
	await expect(bridge.entity(input)).rejects.toThrow('project');
	await expect(bridge.source({ ...input, path: 'src/pages/Home.ts' })).rejects.toThrow('project');
	await expect(bridge.image({ ...input, version: 'v001', sha256: 'a'.repeat(64) })).rejects.toThrow(
		'project'
	);
	await expect(
		bridge.startRun({
			projectId,
			entityId: 'page.home',
			threadId: 'one',
			mode: 'plan',
			provider: 'codex',
			model: 'fixture',
			effort: null,
			text: 'do not execute',
			approval: null
		})
	).rejects.toThrow('project');
	await expect(bridge.cancelRun({ projectId, runId: 'one' })).rejects.toThrow('project');
	expect(start).not.toHaveBeenCalled();
	expect(cancel).not.toHaveBeenCalled();
	expect((await bridge.entity({ entityId: 'page.home', commit: b.tip })).id).toBe('page.home');
}, 15000);
