// @harness-uid u_s6cbo3yjed
import type { UntrustedValue } from '../../../core/agents-providers/projectAssistant.types';
import type { PlatformFailureCode } from '../../../core/agents-providers/platformAdapter.types';
import { SlackRequestError } from './SlackRequestError';
import type { SlackMethod } from './slackRequest.types';

const ambiguousErrors = new Set([
	'fatal_error',
	'internal_error',
	'request_timeout',
	'service_unavailable'
]);

const reads = new Set<SlackMethod>([
	'users.conversations',
	'conversations.history',
	'conversations.replies'
]);

const expired = new Set(['invalid_auth', 'token_revoked', 'token_expired', 'account_inactive']);

export async function slackRequest(
	fetchImpl: typeof fetch,
	method: SlackMethod,
	token: string,
	options: { body?: object; userGrant?: boolean } = {}
): Promise<UntrustedValue> {
	const unavailable = method === 'chat.postMessage' ? 'delivery-unknown' : 'provider-unavailable';
	const request = requestFor(method, options.body);
	let response: Response;
	try {
		response = await fetchImpl(request.url, {
			method: request.method,
			redirect: 'error',
			signal: AbortSignal.timeout(10_000),
			headers: {
				authorization: 'Bearer ' + token,
				'content-type': request.body ? 'application/json' : 'application/x-www-form-urlencoded'
			},
			body: request.body
		});
	} catch {
		throw new SlackRequestError(unavailable);
	}
	if (response.status === 429)
		throw new SlackRequestError('rate-limited', retryAfter(response.headers));
	if (response.status >= 500) throw new SlackRequestError(unavailable);
	if (!response.ok) throw new SlackRequestError('provider-refused');
	return readReply(response, unavailable, options.userGrant === true);
}

function requestFor(method: SlackMethod, body: object | undefined) {
	const url = new URL('https://slack.com/api/' + method);
	if (reads.has(method)) {
		for (const [key, value] of Object.entries(body ?? {})) {
			if (value !== undefined) url.searchParams.set(key, String(value));
		}
		return { url: url.href, method: 'GET' };
	}
	return { url: url.href, method: 'POST', body: body && JSON.stringify(body) };
}

function retryAfter(headers: Headers): number {
	const value = headers.get('retry-after');
	if (!value || !/^\d+$/.test(value)) return 1000;
	return Math.min(Number.MAX_SAFE_INTEGER - Date.now(), Math.max(1000, Number(value) * 1000));
}

async function readReply(
	response: Response,
	unavailable: PlatformFailureCode,
	userGrant: boolean
): Promise<UntrustedValue> {
	const decoded = (await response.json().catch(() => null)) as UntrustedValue;
	const code = errorCode(decoded);
	if (code === null) return decoded;
	if (ambiguousErrors.has(code)) throw new SlackRequestError(unavailable);
	if (userGrant && expired.has(code)) throw new SlackRequestError('credential-unavailable');
	throw new SlackRequestError('provider-refused');
}

function errorCode(reply: UntrustedValue): string | null {
	if (!reply || typeof reply !== 'object' || !('ok' in reply) || reply.ok !== false) return null;
	return 'error' in reply && typeof reply.error === 'string' ? reply.error : '';
}
