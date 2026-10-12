import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { CapacitorBridgeAdapter } from '../../src/adapters/CapacitorBridgeAdapter';
import type {
	RemoteNativeEvent,
	RemoteNativePlugin,
	RemoteNativeStatus
} from '../../src/models/Environment.types';

type Call = { method: string; input: Record<string, unknown> };
type Answer = { value: unknown; cachedAt?: string };
const tip = 'a'.repeat(40);
const revision = { branch: 'main', commit: tip };
const shown = { ...revision, tip, atTip: true };
const png = Uint8Array.from([137, 80, 78, 71]);
const answers: Record<string, unknown> = {
	snapshot: { project: { id: 'local-1', name: 'One', root: '' }, revision: shown, writable: true },
	listProjects: [{ id: 'local-1', name: 'One', kind: 'local' }],
	image: {
		encoding: 'base64',
		mediaType: 'image/png',
		byteLength: png.length,
		sha256: createHash('sha256').update(png).digest('hex'),
		data: Buffer.from(png).toString('base64')
	}
};
const online: RemoteNativeStatus = {
	state: 'online',
	origin: 'https://relay.example.invalid',
	host: { id: 'a1'.repeat(20), name: 'Studio Mac' },
	device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
	grant: { projects: [{ id: 'local-1', name: 'One' }], agents: true },
	reason: null,
	lastOnlineAt: null
};
const live = async (call: Call): Promise<Answer> => ({ value: answers[call.method] ?? null });
function phone(request = vi.fn(live), status: RemoteNativeStatus | null = online) {
	const listeners: ((event: RemoteNativeEvent) => void)[] = [];
	const remove = vi.fn(async () => {});
	const addListener = vi.fn(async (_name: string, listener: (event: RemoteNativeEvent) => void) => {
		listeners.push(listener);
		return { remove };
	});
	const plugin = { request, addListener } as unknown as RemoteNativePlugin;
	const emit = (event: RemoteNativeEvent) => listeners.forEach((listener) => listener(event));
	const adapter = new CapacitorBridgeAdapter({ plugin });
	if (status) adapter.allow(status);
	return { adapter, bridge: adapter.connect(), request, emit, remove };
}
const sent = (request: ReturnType<typeof phone>['request']) =>
	request.mock.calls.map(([call]) => call);
const draft = { entityId: 'page:activity', projectId: 'local-1' } as never;

test('selecting a project is a snapshot, and every later read names that project', async () => {
	const { bridge, request } = phone();
	await bridge.selectProject!({ projectId: 'local-1' });
	await bridge.entity({ entityId: 'page:activity', commit: tip });
	await bridge.listProjects!();
	await bridge.providers();
	expect(sent(request)).toEqual([
		{ method: 'snapshot', input: { projectId: 'local-1', branch: null, commit: null } },
		{ method: 'entity', input: { entityId: 'page:activity', commit: tip, projectId: 'local-1' } },
		{ method: 'listProjects', input: {} },
		{ method: 'providers', input: {} }
	]);
});

test('a change names the revision of the latest snapshot, and none is sent without one', async () => {
	const { bridge, request } = phone();
	await expect(bridge.openThread(draft)).rejects.toThrow('Open the project');
	expect(request).not.toHaveBeenCalled();
	await bridge.snapshot({ projectId: 'local-1', branch: 'main', commit: null });
	await bridge.openThread(draft);
	await bridge.cancelRun({ runId: 'run-1', projectId: 'local-1' });
	expect(sent(request)[1]).toEqual({
		method: 'openThread',
		input: { entityId: 'page:activity', projectId: 'local-1', revision }
	});
	expect(sent(request)[2].input).toEqual({ runId: 'run-1', projectId: 'local-1' });
});

test('a view pinned to a commit names no revision, also when that commit is the tip', async () => {
	const { bridge, request } = phone();
	await bridge.snapshot({ projectId: 'local-1', branch: 'main', commit: null });
	await bridge.snapshot({ projectId: 'local-1', branch: 'main', commit: tip });
	await expect(bridge.openThread(draft)).rejects.toThrow('branch tip');
	await expect(bridge.startRun(draft)).rejects.toThrow('branch tip');
	expect(sent(request).map((call) => call.method)).toEqual(['snapshot', 'snapshot']);
});

test('nothing is offered before a status grants it, and what is not attached is never sent', async () => {
	const { adapter, bridge, request } = phone(vi.fn(live), null);
	const surface = bridge as unknown as Record<string, unknown>;
	for (const name of ['listProjects', 'selectProject', 'addComment', 'pendingComments', 'history'])
		expect(surface[name]).toBeUndefined();
	await expect(bridge.entity({ entityId: 'page:activity', commit: tip })).rejects.toMatchObject({
		code: 'method-denied'
	});
	adapter.allow({ ...online, methods: ['listProjects', 'snapshot', 'entity'] });
	expect(typeof bridge.listProjects).toBe('function');
	expect(typeof bridge.selectProject).toBe('function');
	expect(bridge.addComment).toBeUndefined();
	expect(bridge.history).toBeUndefined();
	await bridge.snapshot({ projectId: 'local-1', branch: 'main', commit: null });
	await expect(bridge.startRun(draft)).rejects.toMatchObject({ code: 'method-denied' });
	await expect(bridge.providers()).rejects.toMatchObject({ code: 'method-denied' });
	expect(sent(request).map((call) => call.method)).toEqual(['snapshot']);
	adapter.allow({ ...online, state: 'revoked', grant: null });
	expect(bridge.listProjects).toBeUndefined();
});

test('a saved snapshot is a dated read-only copy and names no revision to change', async () => {
	const cachedAt = '2026-10-12T07:30:00.000Z';
	const saved = vi.fn(
		async (call: Call): Promise<Answer> => ({
			value: answers[call.method],
			cachedAt
		})
	);
	const { bridge, request } = phone(saved, { ...online, state: 'offline' });
	const snapshot = await bridge.snapshot({ projectId: 'local-1', branch: 'main', commit: null });
	expect(snapshot.writable).toBe(false);
	expect(snapshot.cache).toMatchObject({ status: 'offline', readOnly: true, cachedAt });
	expect(snapshot.cache?.identity.principalId).toBe(online.device!.id);
	await expect(bridge.openThread(draft)).rejects.toThrow('branch tip');
	expect(sent(request).map((call) => call.method)).toEqual(['snapshot']);
});

test('media is decoded and verified; folders and hosted sign-in do not exist on a phone', async () => {
	const { bridge, request } = phone();
	const image = await bridge.image({ projectId: 'local-1' } as never);
	expect(Array.from(image)).toEqual(Array.from(png));
	await expect(bridge.openProject()).rejects.toThrow('no folders');
	expect(sent(request).map((call) => call.method)).toEqual(['image']);
	const surface = bridge as unknown as Record<string, unknown>;
	expect(surface.connectHosted).toBeUndefined();
	expect(surface.hostedStatus).toBeUndefined();
});

test('a refusal keeps the words and the code of the computer and is never a success', async () => {
	const refuse = vi.fn(async () => {
		throw { code: 'offline', message: 'The computer is not connected.' };
	});
	const { bridge } = phone(refuse as never);
	await expect(bridge.listProjects!()).rejects.toMatchObject({
		message: 'The computer is not connected.',
		code: 'offline'
	});
});

test('run events reach the run listener only, until it is released', async () => {
	const { bridge, emit, remove } = phone();
	const runs = vi.fn();
	const cache = vi.fn();
	const release = bridge.onRunEvent(runs);
	bridge.onCacheStatus!(cache);
	await Promise.resolve();
	emit({ channel: 'run', sequence: 1, value: { runId: 'run-1', kind: 'cancelled' } });
	emit({ channel: 'connection', sequence: 2, value: { kind: 'revoked' } });
	expect(runs).toHaveBeenCalledExactlyOnceWith({ runId: 'run-1', kind: 'cancelled' });
	expect(cache).not.toHaveBeenCalled();
	release();
	await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
});
