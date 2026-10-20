import type { SessionRecord } from '../../../../models/HubAuthStore.types';
import type { SessionRepository } from '../../../../repositories/SessionRepository';
import { SESSION_COOKIE, authCookies } from '../../../../utils/authCookies';
import { authFail } from '../../../../utils/authFail';
import { bearerToken, sameOrigin } from './authHttp';
import { hasAuthorization } from '../../../../utils/authHttp';

export interface RequestSessionOptions {
	sessions: SessionRepository;
	origin: string;
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const OWN_ROUTES = ['/api/auth/status', '/api/auth/logout'];

/** A `project:<id>` session reaches that project and its own status and logout, nothing else. */
function inScope(resource: string, path: string): boolean {
	if (resource === 'projects') return true;
	if (!resource.startsWith('project:')) return false;
	const base = `/api/projects/${resource.slice('project:'.length)}`;
	return path === base || path.startsWith(`${base}/`) || OWN_ROUTES.includes(path);
}

/** Resolves the session behind a request: cookie for browsers, Authorization for native. */
export class RequestSessionService {
	constructor(private readonly options: RequestSessionOptions) {}

	/** Null unless the credential is live, on its own channel, same-origin and in scope. */
	async resolve(request: Request): Promise<SessionRecord | null> {
		const session = hasAuthorization(request)
			? await this.native(request)
			: await this.cookie(request);
		const path = new URL(request.url).pathname;
		return session && inScope(session.resource, path) ? session : null;
	}

	/** The browser's own cookie session, for actions a native session may not take. */
	async browser(request: Request): Promise<SessionRecord> {
		if (hasAuthorization(request)) return authFail('session-required');
		if (this.crossOrigin(request)) return authFail('origin-denied');
		return (await this.cookie(request)) ?? authFail('session-required');
	}

	/** Any live session. A cookie request from another origin is named as such. */
	async required(request: Request): Promise<SessionRecord> {
		if (!hasAuthorization(request) && this.crossOrigin(request)) return authFail('origin-denied');
		return (await this.resolve(request)) ?? authFail('session-required');
	}

	crossOrigin(request: Request): boolean {
		return !SAFE_METHODS.includes(request.method) && !sameOrigin(request, this.options.origin);
	}

	/** An Authorization header is final: a bad one never falls back to the cookie. */
	private async native(request: Request): Promise<SessionRecord | null> {
		const credential = bearerToken(request);
		const session = credential ? await this.options.sessions.find(credential) : null;
		return session?.kind === 'native' ? session : null;
	}

	/** Cookies ride along on cross-site requests, so unsafe methods need the public origin. */
	private async cookie(request: Request): Promise<SessionRecord | null> {
		if (this.crossOrigin(request)) return null;
		const credential = authCookies(request, SESSION_COOKIE);
		const session = credential ? await this.options.sessions.find(credential) : null;
		return session?.kind === 'browser' ? session : null;
	}
}
