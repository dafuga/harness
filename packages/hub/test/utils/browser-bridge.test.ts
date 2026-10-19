import { expect, test, vi } from 'vitest';
import { browserBridge } from '../../src/utils/browserBridge';
import type { BrowserApi } from '../../src/utils/browserApi';

const projectId = '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f';
const commit = 'a'.repeat(40);
const base = `/api/projects/${projectId}`;
const anchor = {
	branch: 'main',
	commit,
	entityId: 'page.activity',
	version: 'v001',
	imageSha256: 'b'.repeat(64),
	state: 'default',
	viewport: 'desktop',
	region: null
};
const thread = {
	id: '33333333-3333-4333-8333-333333333333',
	projectId,
	anchor,
	collaborationCommit: 'f'.repeat(40),
	comments: [
		{
			id: 'c1',
			requestId: 'r1',
			actor: { id: 'google:1', email: 'ada@example.invalid', name: 'Ada', emailVerified: true },
			text: 'Looks right',
			createdAt: '2026-10-12T00:00:00.000Z'
		}
	]
};
const snapshot = {
	project: { id: projectId, name: 'Atlas', root: '' },
	revision: { branch: 'main', commit, tip: commit, atTip: true },
	branches: [],
	commits: [],
	entities: [],
	writable: true,
	capabilities: { comments: true, agents: true, planning: true, approval: true, source: 'local' }
};
function apiOf(answers: Record<string, unknown>) {
	const get = vi.fn(async (path: string) => answers[path]);
	const send = vi.fn(async (_method: string, path: string, body: unknown) =>
		(body as { method?: string })?.method === 'events'
			? {
					events: [
						{
							sequence: 1,
							value: { runId: 'run-1', kind: 'finished', summary: 'Done', verified: false }
						}
					]
				}
			: answers[path]
	);
	const bytes = vi.fn(async () => new Uint8Array([1, 2]));
	return { api: { get, send, bytes } as unknown as BrowserApi, get, send, bytes };
}

test('reads use the addresses of the named project and the given revision', async () => {
	const { api, get, bytes } = apiOf({
		'/api/projects': [{ id: projectId, name: 'Atlas', role: 'owner' }],
		[`${base}/snapshot`]: snapshot,
		[`${base}/entity`]: { id: 'page.activity' },
		[`${base}/source`]: { path: 'src/a.ts', text: 'a' },
		[`${base}/threads`]: [thread]
	});
	const bridge = browserBridge(api);
	expect(await bridge.listProjects!()).toEqual([{ id: projectId, name: 'Atlas', kind: 'shared' }]);
	await bridge.selectProject!({ projectId });
	expect(get).toHaveBeenLastCalledWith(`${base}/snapshot`, { branch: null, commit: null });
	await bridge.snapshot({ projectId, branch: 'feat/x', commit });
	expect(get).toHaveBeenLastCalledWith(`${base}/snapshot`, { branch: 'feat/x', commit });
	const entity = { projectId, entityId: 'page.activity', commit };
	await bridge.entity(entity);
	expect(get).toHaveBeenLastCalledWith(`${base}/entity`, {
		entityId: 'page.activity',
		commit,
		branch: 'main'
	});
	await bridge.source({ ...entity, path: 'src/a.ts' });
	expect(get).toHaveBeenLastCalledWith(`${base}/source`, {
		entityId: 'page.activity',
		commit,
		path: 'src/a.ts'
	});
	const image = await bridge.image({ ...entity, version: 'v001', sha256: 'b'.repeat(64) });
	expect(bytes).toHaveBeenCalledWith(`${base}/image`, {
		entityId: 'page.activity',
		commit,
		version: 'v001',
		sha256: 'b'.repeat(64)
	});
	expect(image).toBeInstanceOf(Uint8Array);
	const messages = await bridge.messages({ ...entity, threadId: thread.id });
	expect(get).toHaveBeenLastCalledWith(`${base}/threads`, { entityId: 'page.activity', commit });
	expect(messages).toMatchObject([
		{ id: 'c1', author: 'user', authorName: 'Ada', text: 'Looks right' }
	]);
	expect(await bridge.messages({ ...entity, threadId: 'unknown' })).toEqual([]);
});

test('the hosted workspace honors fresh server capabilities and closes unspecified access', async () => {
	const { api } = apiOf({ [`${base}/snapshot`]: snapshot });
	const bridge = browserBridge(api);
	const shown = await bridge.snapshot({ projectId, branch: null, commit: null });
	expect(shown.writable).toBe(true);
	expect(shown.capabilities).toEqual({
		comments: true,
		agents: true,
		planning: true,
		approval: true,
		source: 'github'
	});
	expect(await bridge.capabilities!({ projectId })).toEqual(shown.capabilities);
	const silent = apiOf({ [`${base}/snapshot`]: { ...snapshot, capabilities: undefined } });
	const closed = await browserBridge(silent.api).snapshot({
		projectId,
		branch: null,
		commit: null
	});
	expect(closed.capabilities?.comments).toBe(false);
});

test('requests without a selected project or writable tip never start agents', async () => {
	const { api, get, send } = apiOf({});
	const bridge = browserBridge(api);
	await expect(bridge.providers()).rejects.toThrow(/project/);
	await expect(bridge.startRun({} as never)).rejects.toThrow(/branch tip/);
	await expect(bridge.approve({} as never)).rejects.toThrow(/branch tip/);
	await expect(bridge.createPlan({} as never)).rejects.toThrow(/runs no agent/);
	expect(get).not.toHaveBeenCalled();
	expect(send).not.toHaveBeenCalled();
});

test('Write requests use the selected project and shown revision; Read and Comment refuse changes', async () => {
	const { api, send } = apiOf({
		[`${base}/snapshot`]: snapshot,
		[`${base}/agent`]: { runId: 'run-1' }
	});
	const bridge = browserBridge(api);
	await bridge.snapshot({ projectId, branch: null, commit: null });
	await bridge.startRun({ projectId, text: 'Explain this' } as never);
	expect(send).toHaveBeenCalledWith(
		'POST',
		`${base}/agent`,
		expect.objectContaining({
			method: 'startRun',
			revision: { branch: 'main', commit },
			requestId: expect.any(String)
		})
	);
	// No listener/polling left active after a terminal result.
	for (const comments of [false, true]) {
		const f = apiOf({
			[`${base}/snapshot`]: {
				...snapshot,
				writable: false,
				capabilities: { comments, agents: false }
			}
		});
		const read = browserBridge(f.api);
		await read.snapshot({ projectId, branch: null, commit: null });
		await expect(read.startRun({ projectId } as never)).rejects.toThrow(/branch tip/);
		expect(f.send).not.toHaveBeenCalled();
	}
});

test('a comment is posted without an author and answered by its collaboration commit', async () => {
	const { api, send } = apiOf({ [`${base}/comments`]: thread });
	const bridge = browserBridge(api);
	const draft = { projectId, requestId: 'r1', threadId: thread.id, anchor, text: 'Looks right' };
	const result = await bridge.addComment!({ ...draft, actor: { id: 'forged' } } as never);
	expect(send).toHaveBeenCalledTimes(1);
	expect(send).toHaveBeenCalledWith('POST', `${base}/comments`, draft);
	expect(JSON.stringify(send.mock.calls[0])).not.toMatch(/forged|actor|author/);
	expect(result).toEqual({ kind: 'shared', projectId, thread });
});

test('a request that names no project is refused before it is sent', async () => {
	const { api, get } = apiOf({});
	const bridge = browserBridge(api);
	await expect(bridge.snapshot({ branch: null, commit: null })).rejects.toThrow(/project/);
	await expect(bridge.entity({ entityId: 'page.activity', commit })).rejects.toThrow(/project/);
	expect(get).not.toHaveBeenCalled();
});
