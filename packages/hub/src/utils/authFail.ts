import type { AuthFailureCode } from '../models/HubAuth.types';

const statuses: Record<AuthFailureCode, number> = {
	'auth-disabled': 503,
	'auth-unavailable': 500,
	'github-disabled': 503,
	'invalid-request': 400,
	'origin-denied': 403,
	'challenge-invalid': 401,
	'credential-invalid': 401,
	'email-not-authoritative': 403,
	'email-proof-required': 401,
	'email-code-invalid': 400,
	'email-rate-limited': 429,
	'email-delivery-disabled': 503,
	'email-delivery-failed': 502,
	'session-required': 401,
	'handoff-invalid': 400,
	'github-not-connected': 403,
	'github-unavailable': 502,
	'repository-denied': 403,
	'token-scope-denied': 403,
	'not-found': 404,
	'method-not-allowed': 405
};

/** The only error shape that leaves hub authentication: a stable code, never provider detail. */
export class AuthFailure extends Error {
	readonly status: number;

	constructor(readonly code: AuthFailureCode) {
		super(`Hub auth ${code}`);
		this.name = 'AuthFailure';
		this.status = statuses[code];
	}
}

export function authFail(code: AuthFailureCode): never {
	throw new AuthFailure(code);
}
