import type {
	AuthStatus,
	GithubStatus,
	HubAuth
} from '../../../../models/accounts-access/HubAuth.types';
import { AuthFailure } from '../../../../utils/accounts-access/authFail';
import { authFailure, authHttp, authPath } from '../../../../utils/verification-evidence/authHttp';

const status: AuthStatus = { actor: null, configured: false, clientId: null };

const github: GithubStatus = { configured: false, connected: false, login: null };

/**
 * Authentication when it is not configured: both status routes say so, every other route is a
 * 503, nobody is an actor and no token exists. There is no fallback identity.
 */
export function authDisabled(): HubAuth {
	const refuse = () => Promise.reject(new AuthFailure('github-disabled'));
	return {
		actor: async () => null,
		async handle(request) {
			const path = authPath(request);
			if (path === null) return null;
			const read = request.method === 'GET';
			if (read && path === '/api/auth/status') return authHttp(status);
			if (read && path === '/api/github/status') return authHttp(github);
			return authFailure(new AuthFailure('auth-disabled'));
		},
		authorizeRepository: refuse,
		token: refuse
	};
}
