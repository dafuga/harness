import { hubHttp } from '../../../../utils/networking-security/hub-http/hubHttp';
import { hubFail } from '../../../../utils/development-tooling/hubJson';

export function hubQuery(request: Request) {
	const url = new URL(request.url),
		fields = Object.fromEntries(url.searchParams);
	const entityId = fields.entityId ?? '',
		commit = fields.commit ?? '';
	if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(entityId) || !/^[a-f0-9]{40}$/.test(commit))
		return hubFail('invalid-input');
	return {
		entityId,
		commit,
		branch: fields.branch ?? '',
		path: fields.path ?? '',
		version: fields.version ?? '',
		sha256: fields.sha256 ?? '',
		threadId: fields.threadId ?? ''
	};
}

const publicErrors: Record<string, number> = {
	'evidence-stale': 409,
	'evidence-unreadable': 404,
	'artifact-refused': 404,
	'artifact-too-large': 413,
	'invalid-evidence-revision': 409,
	forbidden: 403,
	'not-found': 404,
	'invalid-input': 400,
	'invalid-invitation': 400,
	'anchor-conflict': 409,
	'request-conflict': 409,
	conflict: 409,
	'invalid-path': 400,
	'revision-mismatch': 409,
	unavailable: 503,
	'github-unavailable': 503,
	'repository-denied': 403,
	'collaboration-disabled': 503,
	'remote-disabled': 503,
	'artifact-corrupt': 409,
	'blob-integrity': 409,
	'truncated-tree': 503,
	'metadata-too-large': 503,
	'ref-mismatch': 409,
	'cache-hash-mismatch': 409,
	'invitation-invalid': 400,
	'invitation-expired': 400,
	'auth-disabled': 503,
	'github-disabled': 503,
	'invalid-request': 400,
	'origin-denied': 403,
	'challenge-invalid': 400,
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
	'token-scope-denied': 403,
	'method-not-allowed': 405
};

export function hubHttpFailure(error: unknown) {
	let candidate: unknown = null;
	if (error && typeof error === 'object' && 'code' in error) candidate = error.code;
	const code =
		typeof candidate === 'string' && Object.hasOwn(publicErrors, candidate)
			? candidate
			: 'unavailable';
	return hubHttp({ error: code }, publicErrors[code]);
}
