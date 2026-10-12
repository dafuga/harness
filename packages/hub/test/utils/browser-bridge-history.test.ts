import { expect, test, vi } from 'vitest';
import { browserBridge } from '../../src/utils/browserBridge';
import type { BrowserApi } from '../../src/utils/browserApi';

const projectId = '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f';
const commit = 'a'.repeat(40);
const base = `/api/projects/${projectId}`;
const refusal = (status: number) => Object.assign(new Error('refused'), { status });
const query = { projectId, entityId: 'page.activity', commit };

test('further history is read for the named project, entity, commit, branch and page', async () => {
	const answer = { entries: [], complete: true, nextPage: null };
	const get = vi.fn(async () => answer);
	const bridge = browserBridge({ get } as unknown as BrowserApi);
	expect(await bridge.history!({ ...query, branch: 'feat/x', page: 2 })).toBe(answer);
	expect(get).toHaveBeenCalledWith(`${base}/history`, {
		entityId: 'page.activity',
		commit,
		branch: 'feat/x',
		page: '2'
	});
});

test('a refused read is told before it rejects: the session for 401, the one project for 403', async () => {
	const get = vi.fn(async () => {
		throw refusal(403);
	});
	const bytes = vi.fn(async () => {
		throw refusal(401);
	});
	const bridge = browserBridge({ get, bytes } as unknown as BrowserApi);
	const heard: unknown[] = [];
	const off = bridge.onCacheStatus!((event) => heard.push(event));
	await expect(bridge.source({ ...query, path: 'src/a.ts' })).rejects.toMatchObject({
		status: 403
	});
	expect(heard).toEqual([{ projectId, status: 'denied' }]);
	await expect(
		bridge.image({ ...query, version: 'v001', sha256: 'b'.repeat(64) })
	).rejects.toThrow();
	expect(heard[1]).toEqual({ projectId: '$projects', status: 'denied' });
	off();
	await expect(bridge.entity(query)).rejects.toThrow();
	expect(heard).toHaveLength(2);
});

test('a refused comment and a failure that is no refusal tell nothing', async () => {
	const send = vi.fn(async () => {
		throw refusal(403);
	});
	const get = vi.fn(async () => {
		throw refusal(503);
	});
	const bridge = browserBridge({ get, send } as unknown as BrowserApi);
	const heard: unknown[] = [];
	bridge.onCacheStatus!((event) => heard.push(event));
	await expect(
		bridge.addComment!({ ...query, requestId: 'r', text: 't' } as never)
	).rejects.toThrow();
	await expect(bridge.snapshot({ projectId, branch: null, commit: null })).rejects.toThrow();
	expect(heard).toEqual([]);
});
