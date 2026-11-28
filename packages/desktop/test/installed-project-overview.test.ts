import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import type { OverviewSnapshot } from '../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
import { HostedHttpAdapter } from '../src/adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../src/adapters/networking-security/NativeSessionAdapter';
import { NativeAuthService } from '../src/lib/development-tooling/desktop-initialization/NativeAuthService';
import { LocalOperationsService } from '../src/lib/development-tooling/desktop-initialization/LocalOperationsService';
import { CommentOutboxService } from '../src/services/projects-sessions/CommentOutboxService';
import { ProjectSyncService } from '../src/services/projects-sessions/ProjectSyncService';
import { localFixture } from './local-transport-fixture';

const reader = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../reports/src/lib/projects-sessions/project-overview/readProjectOverview', () => ({
	readProjectOverview: reader.read
}));

/** Synthetic snapshots: the local tracker reads one computer, the Hub answers for another. */
const item = {
	id: 'fixture-item-1',
	title: 'Synthetic item',
	status: 'in_progress',
	updatedAt: '2026-11-20T09:00:00.000Z',
	due: null,
	live: false,
	stale: false
};
const project = (agent: string) => ({
	agent,
	state: 'quiet' as const,
	liveSessions: 0,
	counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
	items: [item as never],
	attention: null,
	blocked: null,
	milestone: null,
	updatedAt: '2026-11-20T09:00:00.000Z'
});
const local: OverviewSnapshot = {
	status: 'ready',
	projects: [project('local-project')],
	machines: [{ name: 'local-computer', status: 'ok' }],
	liveSessions: 0
};
const hubOverview: OverviewSnapshot = {
	status: 'ready',
	projects: [project('hub-project')],
	machines: [{ name: 'hub-computer', status: 'ok' }],
	liveSessions: 0
};

const origin = 'https://hub.example.invalid';
const credential = { origin, principalId: 'google:owner', token: 'synthetic-owner-token' };
const overviewPath = origin + '/api/tracker-overview';

/**
 * A synthetic connection to the Hub. The store is a native session with a generation counter; a
 * test may change it while the overview is in flight, as a sign-out or account switch would.
 */
function connection(answer: {
	status?: number;
	body?: unknown;
	signedIn?: boolean;
	unreachable?: boolean;
	switchDuringRead?: boolean;
}) {
	const store = {
		generation: 0,
		available: () => true,
		read: vi.fn(async () => (answer.signedIn === false ? null : credential)),
		save: vi.fn(),
		clear: vi.fn(),
		invalidate: vi.fn()
	};
	const overviewRequests: { method: string; url: string; body: unknown }[] = [];
	const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		if (answer.unreachable) throw new TypeError('synthetic network failure');
		if (url.endsWith('/api/auth/status'))
			return Response.json({
				actor: {
					id: 'google:owner',
					name: 'Owner',
					email: 'owner@example.invalid',
					emailVerified: true
				}
			});
		overviewRequests.push({ method: init?.method ?? 'GET', url, body: init?.body ?? null });
		if (answer.switchDuringRead) store.generation++;
		return Response.json(answer.body ?? hubOverview, { status: answer.status ?? 200 });
	});
	const http = new HostedHttpAdapter({
		origin,
		credentials: () => store.read(),
		fetch: transport as unknown as typeof fetch
	});
	const service = new NativeAuthService({
		origin,
		http,
		store: store as unknown as NativeSessionAdapter,
		open: vi.fn(async () => {})
	});
	return { service, overviewRequests };
}

test('a signed-in owner reads the Hub overview with one exact GET and no query or body', async () => {
	reader.read.mockReset();
	const hub = connection({});
	expect(await hub.service.overview()).toEqual(hubOverview);
	expect(hub.overviewRequests).toEqual([{ method: 'GET', url: overviewPath, body: null }]);
	expect(reader.read).not.toHaveBeenCalled();
}, 30000);

test('a signed-out installed Desktop asks the Hub for nothing and shows unavailable', async () => {
	const hub = connection({ signedIn: false });
	expect(await hub.service.overview()).toEqual({ status: 'unavailable' });
	expect(hub.overviewRequests).toEqual([]);
}, 30000);

test.each([401, 403, 404, 500])(
	'a Hub answer of %s is unavailable, never a local fallback',
	async (status) => {
		reader.read.mockReset();
		const hub = connection({ status, body: { error: 'refused' } });
		expect(await hub.service.overview()).toEqual({ status: 'unavailable' });
		expect(reader.read).not.toHaveBeenCalled();
	},
	30000
);

test.each([
	{ status: 'unavailable' },
	{ status: 'ready', projects: [] },
	{ status: 'ready', projects: 'not-a-list', machines: [] }
])(
	'a malformed Hub overview %j is unavailable',
	async (body) => {
		const hub = connection({ body });
		expect(await hub.service.overview()).toEqual({ status: 'unavailable' });
	},
	30000
);

test('an unreachable Hub is unavailable, not a snapshot of nothing', async () => {
	reader.read.mockReset();
	const hub = connection({ unreachable: true });
	expect(await hub.service.overview()).toEqual({ status: 'unavailable' });
	expect(reader.read).not.toHaveBeenCalled();
}, 30000);

test('an overview answered after the session changed is discarded as unavailable', async () => {
	const hub = connection({ switchDuringRead: true });
	expect(await hub.service.overview()).toEqual({ status: 'unavailable' });
}, 30000);

test('a Hub-configured operation takes no fields and never reads the local tracker', async () => {
	reader.read.mockReset();
	const operations = new LocalOperationsService({
		bridge: {} as never,
		control: {} as never,
		hubOverview: async () => hubOverview
	});
	expect(await operations.handle({ method: 'projectOverview', input: {} } as never)).toEqual(
		hubOverview
	);
	await expect(
		operations.handle({ method: 'projectOverview', input: { url: 'http://127.0.0.1:1/' } } as never)
	).rejects.toThrow('This operation takes no fields.');
	expect(reader.read).not.toHaveBeenCalled();
});

test('a window of a Desktop with a Hub reads the owner overview through its native account', async () => {
	reader.read.mockReset();
	reader.read.mockResolvedValue(local);
	const hub = connection({});
	const f = await localFixture();
	const shared = {
		registry: f.registry,
		arbiter: f.arbiter,
		providers: f.providers,
		renderMockups: f.renderMockups,
		outbox: new CommentOutboxService(),
		auth: hub.service
	};
	const client = f.connect(f.window({ shared }));
	expect(await client.request('projectOverview')).toEqual(hubOverview);
	expect(reader.read).not.toHaveBeenCalled();
	expect(hub.overviewRequests).toHaveLength(1);
}, 30000);

test('a signed-in Mac approves an exact draft revision through its local window', async () => {
	const version = { id: '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c', revision: 2 };
	const result = { ...version, status: 'sent' };
	const hub = connection({ body: result });
	await hub.service.status();
	const f = await localFixture();
	const shared = {
		registry: f.registry,
		arbiter: f.arbiter,
		providers: f.providers,
		renderMockups: f.renderMockups,
		outbox: new CommentOutboxService(),
		auth: hub.service
	};
	const client = f.connect(f.window({ shared }));
	const approval = { ...version, action: 'send' };
	expect(await client.request('outgoingDrafts', approval)).toEqual(result);
	expect(hub.overviewRequests).toEqual([
		{
			method: 'POST',
			url: origin + '/api/outgoing-drafts',
			body: JSON.stringify(approval)
		}
	]);
	const guest = f.connect(f.window());
	await expect(guest.request('outgoingDrafts', approval)).rejects.toThrow(/Sign in/);
}, 30000);

test('a window of a Desktop without a Hub keeps reading the local tracker', async () => {
	reader.read.mockReset();
	reader.read.mockResolvedValue(local);
	const f = await localFixture();
	expect(await f.connect(f.window()).request('projectOverview')).toEqual(local);
	expect(reader.read).toHaveBeenCalledTimes(1);
}, 30000);

test('a desktop app with a Hub re-reads the owner overview on its interval and stops when told', async () => {
	vi.useFakeTimers();
	try {
		const hub = connection({});
		const sync = new ProjectSyncService({
			refresh: async () => {
				await hub.service.overview();
			}
		});
		sync.start();
		await vi.advanceTimersByTimeAsync(30000);
		expect(hub.overviewRequests).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(30000);
		expect(hub.overviewRequests).toHaveLength(2);
		sync.stop();
		await vi.advanceTimersByTimeAsync(90000);
		expect(hub.overviewRequests).toHaveLength(2);
	} finally {
		vi.useRealTimers();
	}
});
