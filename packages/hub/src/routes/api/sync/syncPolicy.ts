import type { Handler } from './syncRoutes.types';
import type { SyncCall, SyncDeps } from './syncPolicy.types';
import { hubHttpFailure } from '../[...path]/hub-api-controller/hubHttp';
import { approvalPush } from './syncApprovalPush';
import { bootstrap, readRecovery } from './syncBootstrap';
import { changeDevices } from './syncDevices';
import { bindDeviceSession, readDeviceSession, requireApprovedAccess } from './syncDeviceSession';
import { appendChain, readChain } from './syncChain';
import { enroll } from './syncEnroll';
import { putGrants, readGrants } from './syncGrants';
import { isDeviceId, SYNC_PREFIX, syncProblem } from './syncHttp';
import { foreignUpgrade, live, namedDevice } from './syncLive';
import { getObject, listObjects, putObject } from './syncObjects';
import { postOps, readOps } from './syncOps';

const routes: Record<string, Record<string, { handler: Handler; parts: number[] }>> = {
	bootstrap: {
		GET: { handler: readRecovery, parts: [1] },
		POST: { handler: bootstrap, parts: [1] }
	},
	devices: { POST: { handler: changeDevices, parts: [1] } },
	'approval-push': {
		GET: { handler: approvalPush, parts: [1] },
		POST: { handler: approvalPush, parts: [1] },
		DELETE: { handler: approvalPush, parts: [1] }
	},
	'device-session': {
		GET: { handler: readDeviceSession, parts: [1] },
		POST: { handler: bindDeviceSession, parts: [1] }
	},
	chain: { GET: { handler: readChain, parts: [1] }, POST: { handler: appendChain, parts: [1] } },
	grants: { GET: { handler: readGrants, parts: [1] }, POST: { handler: putGrants, parts: [1] } },
	ops: { GET: { handler: readOps, parts: [2] }, POST: { handler: postOps, parts: [2] } },
	objects: {
		GET: { handler: objectReader, parts: [2, 3] },
		PUT: { handler: putObject, parts: [3] }
	},
	live: { GET: { handler: live, parts: [1] } },
	enroll: {
		GET: { handler: enroll, parts: [1, 2] },
		POST: { handler: enroll, parts: [1, 2] }
	}
};

function objectReader(call: SyncCall): Promise<Response> {
	return call.parts.length === 2 ? listObjects(call) : getObject(call);
}

/**
 * The sealed sync API. Configuration, then authentication, then the call. The account is the
 * signed-in actor and nothing in a request can name another. The server stores ciphertext, public
 * device keys and opaque ids; it reads envelope headers for ids and never a body.
 */
export async function serveSync(request: Request, deps: SyncDeps): Promise<Response> {
	try {
		return await dispatch(request, deps);
	} catch (error) {
		const failure = hubHttpFailure(error);
		failure.headers.set('Cache-Control', 'private, no-store');
		return failure;
	}
}

/** The route a method and path name, or the refusal when they name none. */
function namedRoute(method: string, parts: string[]) {
	const verbs = routes[parts[0]];
	if (!verbs) return syncProblem(404, 'not-found');
	const route = verbs[method];
	if (!route) return syncProblem(405, 'method-not-allowed');
	if (!route.parts.includes(parts.length) || parts.includes(''))
		return syncProblem(404, 'not-found');
	return route;
}

async function dispatch(request: Request, deps: SyncDeps): Promise<Response> {
	const url = new URL(request.url);
	if (!deps.db || !url.pathname.startsWith(SYNC_PREFIX)) return syncProblem(404, 'not-found');
	const parts = url.pathname.slice(SYNC_PREFIX.length).split('/');
	const route = namedRoute(request.method, parts);
	if (route instanceof Response) return route;
	if (foreignUpgrade(request, url, parts)) return syncProblem(403, 'origin-denied');
	const session = deps.sessions ? await deps.sessions.resolve(request) : null;
	if (!session) return syncProblem(401, 'session-required');
	const device = namedDevice(request, parts);
	if (!isDeviceId(device)) return syncProblem(400, 'device-required');
	const call = {
		request,
		url,
		account: session.actor.id,
		sessionHash: session.idHash,
		device,
		deps: { ...deps, db: deps.db },
		parts
	};
	const denial = await requireApprovedAccess(call);
	if (denial) return denial;
	return route.handler(call);
}
