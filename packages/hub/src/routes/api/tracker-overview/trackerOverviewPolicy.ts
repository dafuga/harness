// @harness-uid u_k4rxbz6pq3
import type { HubEnv } from '../../../configs/development-tooling/hubEnvConfig.types';
import { authConfig } from '../../../lib/verification-evidence/server/auth/authConfig';
import { createD1AuthStore } from '../../../lib/verification-evidence/server/auth/auth';
import { authSecrets } from '../../../lib/verification-evidence/server/auth/authSecrets';
import { RequestSessionService } from '../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import { SessionRepository } from '../../../repositories/projects-sessions/SessionRepository';
import { hubHttpFailure } from '../[...path]/hub-api-controller/hubHttp';
import type { OverviewDeps } from './trackerOverviewPolicy.types';
import { clearOverview, overviewKey, readOverview, storeOverview } from './trackerOverviewCache';
import { parseOverviewPayload, readOverviewText } from './trackerOverviewInput';

/**
 * The verified session behind a request, from the same resolver the rest of the Hub uses: a cookie
 * for browsers, an Authorization bearer for native clients, and never a fallback between them.
 */
export function overviewSessions(env: HubEnv): Pick<RequestSessionService, 'resolve'> | null {
	const config = authConfig(env);
	if (!config || !env.DB) return null;
	const repository = new SessionRepository({
		store: createD1AuthStore(env.DB).sessions,
		secrets: authSecrets(config.secret),
		now: () => Date.now()
	});
	return new RequestSessionService({ sessions: repository, origin: config.origin });
}

/** The one path this endpoint answers. Trailing slashes and other aliases are not the same resource. */
export const OVERVIEW_PATH = '/api/tracker-overview';

/** Every response of this endpoint is private and never stored; no CORS header is ever written. */
function privateHeaders(): Record<string, string> {
	return { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
}

function problem(status: number, error: string): Response {
	return Response.json({ error }, { status, headers: privateHeaders() });
}

function overview(body: unknown, status: number): Response {
	return Response.json(body, { status, headers: privateHeaders() });
}

/**
 * The owner-only overview. Configuration, then authentication, then authorization, and only then
 * the body is read. A missing owner setting answers the same way as an unknown route.
 */
export async function serveTrackerOverview(
	request: Request,
	deps: OverviewDeps
): Promise<Response> {
	try {
		return await dispatch(request, deps);
	} catch (error) {
		const failure = hubHttpFailure(error);
		failure.headers.set('Cache-Control', 'private, no-store');
		return failure;
	}
}

async function dispatch(request: Request, deps: OverviewDeps): Promise<Response> {
	const ownerId = deps.ownerId;
	if (!ownerId || new URL(request.url).pathname !== OVERVIEW_PATH) return problem(404, 'not-found');
	const session = deps.sessions ? await deps.sessions.resolve(request) : null;
	if (!session) return problem(401, 'session-required');
	if (session.actor.id !== ownerId) return problem(403, 'forbidden');
	const key = await overviewKey(ownerId);
	if (request.method === 'GET') return read(request, deps, key);
	if (!isNativePublish(request, session)) return problem(403, 'forbidden');
	if (new URL(request.url).search !== '') return problem(400, 'invalid-input');
	return publish(request, deps, key);
}

/** Only a native client holding a project-scoped session may PUT; browser and other scopes are refused. */
function isNativePublish(request: Request, session: { kind: string; resource: string }): boolean {
	return request.method === 'PUT' && session.kind === 'native' && session.resource === 'projects';
}

async function read(
	request: Request,
	deps: Pick<OverviewDeps, 'bucket' | 'now'>,
	key: string
): Promise<Response> {
	if (new URL(request.url).search !== '' || request.body !== null)
		return problem(400, 'invalid-input');
	const snapshot = deps.bucket ? await readOverview(deps.bucket, key, deps.now) : null;
	return snapshot ? overview(snapshot, 200) : overview({ status: 'unavailable' }, 503);
}

async function publish(
	request: Request,
	deps: Pick<OverviewDeps, 'bucket' | 'now'>,
	key: string
): Promise<Response> {
	if (!deps.bucket) return problem(503, 'unavailable');
	const payload = parseOverviewPayload(await readOverviewText(request));
	if (payload.status === 'unavailable') await clearOverview(deps.bucket, key);
	else await storeOverview(deps.bucket, key, payload, deps.now);
	return new Response(null, { status: 204, headers: privateHeaders() });
}
