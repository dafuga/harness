import type { Media } from './browser-bridge-evidence.test.types';
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import type { BrowserApi } from '../../src/utils/browserApi';
import { browserBridge } from '../../src/utils/browser-bridge/browserBridge';

const projectId = '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f';
const commit = 'a'.repeat(40);
const base = `/api/projects/${projectId}`;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7]);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const scope = { entityId: 'page.titles', commit, branch: 'feat/x', mode: 'commit' as const };
const capture = {
	...scope,
	side: 'before' as const,
	recordId: 'b'.repeat(64),
	scenarioId: 'titles-page',
	state: 'default',
	evidenceId: 'screens',
	viewport: null,
	sha256: hash(png),
	notesRevision: 'c'.repeat(40),
	evidenceRevision: null
};
function apiOf(answer: unknown, media: Media = { bytes: png, mediaType: 'image/png' }) {
	const get = vi.fn(async () => answer);
	const read = vi.fn(async () => media);
	return { api: { get, media: read } as unknown as BrowserApi, get, read };
}

test('recorded evidence is read at the address of the project with the fields of its scope', async () => {
	const answer = { scope: { mode: 'commit' }, identity: {}, evidence: {}, behavior: {} };
	const { api, get } = apiOf(answer);
	const bridge = browserBridge(api);
	const extra = { ...scope, projectId, path: '../x' };
	expect(await bridge.evidence!(extra)).toBe(answer);
	expect(get).toHaveBeenCalledTimes(1);
	expect(get).toHaveBeenCalledWith(`${base}/evidence`, scope);
});

test('an artifact is asked for by its binding and given once its bytes are checked', async () => {
	const { api, read } = apiOf(null);
	const found = await browserBridge(api).artifact!({ ...capture, projectId });
	expect(read).toHaveBeenCalledWith(`${base}/artifact`, capture);
	expect(found).toEqual({ bytes: png, mediaType: 'image/png', sha256: capture.sha256 });
	expect(JSON.stringify(read.mock.calls)).not.toMatch(/path|url|file/);
});

test('bytes of another hash or of a type a page could run are not given', async () => {
	const other = apiOf(null, {
		bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 8]),
		mediaType: 'image/png'
	});
	await expect(browserBridge(other.api).artifact!({ ...capture, projectId })).rejects.toThrow(
		/not the recorded file that was asked for/
	);
	const markup = new TextEncoder().encode('<html></html>');
	const unsafe = apiOf(null, { bytes: markup, mediaType: 'text/html' });
	const asked = { ...capture, projectId, sha256: hash(markup) };
	await expect(browserBridge(unsafe.api).artifact!(asked)).rejects.toThrow(/does not show/);
});

test('a refused read of either kind ends what may be shown of that project', async () => {
	const denied = Object.assign(new Error('You do not have access to this.'), { status: 403 });
	const api = {
		get: vi.fn(async () => Promise.reject(denied)),
		media: vi.fn(async () => Promise.reject(denied))
	} as unknown as BrowserApi;
	const bridge = browserBridge(api);
	const heard: unknown[] = [];
	bridge.onCacheStatus!((event) => heard.push(event));
	await expect(bridge.evidence!({ ...scope, projectId })).rejects.toBe(denied);
	await expect(bridge.artifact!({ ...capture, projectId })).rejects.toBe(denied);
	expect(heard).toEqual([
		{ projectId, status: 'denied' },
		{ projectId, status: 'denied' }
	]);
});

test('a read that names no project is refused before anything is sent', async () => {
	const { api, get, read } = apiOf({});
	const bridge = browserBridge(api);
	await expect(bridge.evidence!(scope)).rejects.toThrow(/project/);
	await expect(bridge.artifact!(capture)).rejects.toThrow(/project/);
	expect([get.mock.calls, read.mock.calls]).toEqual([[], []]);
});
