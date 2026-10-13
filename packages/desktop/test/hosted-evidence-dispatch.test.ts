import { expect, test, vi } from 'vitest';
import type { DesktopBridge } from '../src/models/DesktopBridge.types';
import type { RemoteProjectPort } from '../src/models/ProjectContext.types';
import { HostedProjectService } from '../src/services/HostedProjectService';
import { ProjectSessionService } from '../src/services/ProjectSessionService';

const query = {
	projectId: 'shared-one',
	entityId: 'page.home',
	commit: 'a'.repeat(40),
	branch: 'main',
	mode: 'current' as const
};
const capture = {
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
const unread = /^Recorded evidence of a shared project is not read on this computer yet\.$/;

/** A window on the shared project `shared-one`, over a hosted port with these reads. */
async function shared(reads: Partial<Pick<RemoteProjectPort, 'evidence' | 'artifact'>>) {
	const local = { listProjects: async () => [], evidence: vi.fn(), artifact: vi.fn() };
	const remote = {
		snapshot: async () => ({ project: { id: 'shared-one' } }),
		listProjects: async () => [],
		...reads
	} as unknown as RemoteProjectPort;
	const bridge = new HostedProjectService(new ProjectSessionService(), remote).wrap(
		local as unknown as Omit<DesktopBridge, 'onRunEvent'>
	);
	await bridge.selectProject!({ projectId: 'shared-one' });
	return { bridge, local };
}

test('a shared project reads recorded evidence and its bytes from the hosted port that offers them', async () => {
	const answer = { scope: {}, identity: {}, evidence: {}, behavior: {} };
	const file = { bytes: new Uint8Array([1, 2, 3]), mediaType: 'image/png', sha256: capture.sha256 };
	const evidence = vi.fn(async () => answer),
		artifact = vi.fn(async () => file);
	const { bridge, local } = await shared({ evidence, artifact } as never);
	expect(await bridge.evidence!(query)).toBe(answer);
	expect(evidence).toHaveBeenLastCalledWith(query);
	expect(await bridge.artifact!(capture)).toBe(file);
	expect(artifact).toHaveBeenLastCalledWith(capture);
	// A request that names no project is of the selected one, and of no other.
	const unnamed = { entityId: query.entityId, commit: query.commit, branch: 'main' };
	await bridge.evidence!({ ...unnamed, mode: 'commit' });
	expect(evidence).toHaveBeenLastCalledWith({
		...unnamed,
		mode: 'commit',
		projectId: 'shared-one'
	});
	const elsewhere = [() => bridge.evidence!(other(query)), () => bridge.artifact!(other(capture))];
	for (const read of elsewhere)
		await expect(read()).rejects.toThrow('The requested project is not selected.');
	expect([evidence.mock.calls.length, artifact.mock.calls.length]).toEqual([2, 1]);
	// The evidence of a shared project is never read from this computer's own repository.
	expect(local.evidence).not.toHaveBeenCalled();
	expect(local.artifact).not.toHaveBeenCalled();
});

test('a hosted port that offers one of the two reads refuses the other as a shared project', async () => {
	const evidence = vi.fn(async () => ({})),
		artifact = vi.fn(async () => ({}));
	const readsEvidence = await shared({ evidence } as never);
	await readsEvidence.bridge.evidence!(query);
	await expect(readsEvidence.bridge.artifact!(capture)).rejects.toThrow(unread);
	const readsBytes = await shared({ artifact } as never);
	await readsBytes.bridge.artifact!(capture);
	await expect(readsBytes.bridge.evidence!(query)).rejects.toThrow(unread);
	for (const { local } of [readsEvidence, readsBytes]) {
		expect(local.evidence).not.toHaveBeenCalled();
		expect(local.artifact).not.toHaveBeenCalled();
	}
});

function other<T extends { projectId: string }>(input: T): T {
	return { ...input, projectId: 'shared-two' };
}
