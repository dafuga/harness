import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { RequestSessionService } from '../../src/lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import { SessionRepository } from '../../src/repositories/projects-sessions/SessionRepository';
import type { OverviewBucket } from '../../src/routes/api/tracker-overview/trackerOverviewCache.types';
import type { ReadyOverviewPayload } from '../../src/routes/api/tracker-overview/trackerOverviewInput.types';
import { serveTrackerOverview } from '../../src/routes/api/tracker-overview/trackerOverviewPolicy';
import type { OverviewDeps } from '../../src/routes/api/tracker-overview/trackerOverviewPolicy.types';
import { ORIGIN, SECRET, ada, grace } from './authFixture';
import { memoryAuthStore } from './memoryAuthStore';

export const OWNER = ada;
export const OTHER = grace;
export const NOW = Date.UTC(2026, 10, 21, 8, 0, 0);
export const OVERVIEW_URL = ORIGIN + '/api/tracker-overview';
export function memoryBucket() {
	const objects = new Map<string, string>();
	const bucket = {
		objects,
		async get(key: string) {
			const body = objects.get(key);
			return body === undefined ? null : { text: async () => body };
		},
		async put(key: string, body: string) {
			objects.set(key, body);
			return null;
		},
		async delete(key: string) {
			objects.delete(key);
		}
	};
	return bucket;
}
/** A ready snapshot with synthetic records only. Its live total agrees with its cards. */
export function snapshot(): ReadyOverviewPayload {
	const item = {
		id: 'item-1',
		title: 'Synthetic release notes',
		status: 'in_progress' as const,
		updatedAt: '2026-11-21T07:59:00.000Z',
		due: '2026-11-21T10:00:00.000Z',
		live: true,
		runs: [{ id: 101, computer: 'synthetic-computer' }],
		stale: false
	};
	return {
		status: 'ready',
		projects: [
			{
				agent: 'synthetic-project',
				state: 'needs-you',
				liveSessions: 1,
				counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
				items: [item],
				attention: { item, text: 'Choose the synthetic scope' },
				blocked: null,
				milestone: { text: 'Synthetic tests passed', at: '2026-11-21T07:58:00.000Z' },
				updatedAt: '2026-11-21T07:59:00.000Z'
			}
		],
		machines: [
			{
				name: 'synthetic-computer',
				status: 'ok',
				queued: 0,
				lastTickAt: '2026-11-21T07:59:00.000Z'
			}
		],
		providerBudgets: [
			{
				provider: 'claude',
				readAt: '2026-11-21T07:59:00.000Z',
				limits: [{ label: 'Weekly', left: 72, resetsAt: null }]
			}
		],
		liveSessions: 1
	};
}

/** Sessions and a clock for the test. Sign-ins use the same repository the Hub uses. */
export function overviewFixture(options: { owner?: string | null } = {}) {
	let clock = NOW;
	const now = () => clock;
	const store = memoryAuthStore();
	const repository = new SessionRepository({
		store: store.sessions,
		secrets: authSecrets(SECRET),
		now
	});
	const sessions = new RequestSessionService({ sessions: repository, origin: ORIGIN });
	const bucket = memoryBucket();
	const owner = options.owner === undefined ? OWNER.id : (options.owner ?? undefined);
	const deps = (ownerId: string | undefined): OverviewDeps => ({
		ownerId,
		sessions: {
			resolve: (request) => sessions.resolve(request),
			publisherLive: async (idHash, ownerId) =>
				(await repository.live(idHash))?.actor.id === ownerId
		},
		bucket: bucket as unknown as OverviewBucket,
		now: now()
	});
	return {
		bucket,
		homeDeps: () => deps(owner),
		owner,
		async revoke(bearer: string) {
			const record = await repository.find(bearer);
			if (!record) throw new Error('Missing fixture session');
			await repository.revoke(record);
		},
		advance(milliseconds: number) {
			clock += milliseconds;
		},
		/** A browser session cookie for the actor, the same credential shape the sign-in issues. */
		async browser(actor = OWNER): Promise<string> {
			const issued = await repository.issue({
				kind: 'browser',
				actor,
				resource: 'projects',
				parentHash: null
			});
			return issued.credential;
		},
		/** A native bearer credential for the actor in the given scope. */
		async native(actor = OWNER, resource = 'projects'): Promise<string> {
			const issued = await repository.issue({ kind: 'native', actor, resource, parentHash: null });
			return issued.credential;
		},
		/** Serves the request with the fixture owner, or with another owner set for this call only. */
		handle(request: Request, call: { owner?: string | undefined } = {}): Promise<Response> {
			const ownerId = 'owner' in call ? call.owner : owner;
			return serveTrackerOverview(request, deps(ownerId));
		}
	};
}

/** A request with the credential on its own channel: a cookie for browsers or a bearer for native. */
export function overviewRequest(
	method: string,
	credential: { cookie?: string; bearer?: string } = {},
	body?: unknown
): Request {
	const headers: Record<string, string> = {};
	if (credential.cookie) {
		headers.cookie = `${SESSION_COOKIE}=${credential.cookie}`;
		headers.origin = ORIGIN;
	}
	if (credential.bearer) headers.authorization = `Bearer ${credential.bearer}`;
	if (body !== undefined) {
		headers['content-type'] = 'application/json';
		return new Request(OVERVIEW_URL, { method, headers, body: JSON.stringify(body) });
	}
	return new Request(OVERVIEW_URL, { method, headers });
}
/** Bodies the strict publish check must refuse: unknown keys, credential fields, bad shapes and inconsistent totals. */
export function invalidSnapshots(): unknown[] {
	const base = snapshot();
	const card = base.projects[0];
	const item = card.items[0];
	return [
		{ ...base, extra: true },
		{ ...base, receivedAt: NOW },
		{ ...base, providerBudgets: [{ ...base.providerBudgets?.[0], account: 'private' }] },
		{
			...base,
			projects: [
				{ ...card, items: [{ ...item, runs: [{ id: 1, computer: null, output: 'private' }] }] }
			]
		},
		{ ...base, liveSessions: 2 },
		{ ...base, projects: [{ ...card, accessToken: 'synthetic' }] },
		{ ...base, projects: [{ ...card, state: 'unknown' }] },
		{ ...base, projects: [{ ...card, items: [{ ...item, status: 'deleted' }] }] },
		{ ...base, machines: [{ name: 'computer', status: 'ok', secret: 'synthetic' }] },
		{ ...base, projects: [card, card], liveSessions: 2 },
		{ status: 'maybe' },
		[],
		'synthetic'
	];
}

/** A raw request for the framing cases: any URL, optional bearer, and the caller's own headers and body. */
export function rawRequest(url: string, init: RequestInit & { bearer?: string } = {}): Request {
	const { bearer, ...rest } = init;
	const headers = new Headers(rest.headers);
	if (bearer) headers.set('authorization', `Bearer ${bearer}`);
	return new Request(url, { ...rest, headers });
}

/** A JSON publish with a bearer and a raw body, for the framing cases. */
export function rawPublish(bearer: string, body: BodyInit, url = OVERVIEW_URL): Request {
	return rawRequest(url, {
		method: 'PUT',
		bearer,
		headers: { 'content-type': 'application/json' },
		body
	});
}

/** A publish whose body streams 64 KiB chunks with no Content-Length; `pulled` counts what was read. */
export function streamedPublish(bearer: string, chunks: number) {
	const pulled = { count: 0 };
	const chunk = new TextEncoder().encode(' '.repeat(64 * 1024));
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (pulled.count >= chunks) return controller.close();
			pulled.count += 1;
			controller.enqueue(chunk);
		}
	});
	const init = {
		method: 'PUT',
		bearer,
		headers: { 'content-type': 'application/json' },
		body,
		duplex: 'half'
	};
	return { request: rawRequest(OVERVIEW_URL, init as RequestInit & { bearer: string }), pulled };
}
