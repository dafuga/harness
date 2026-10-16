import type { RelayErrorCode } from '../../../remote/src/index';

const jsonHeaders = {
	'Content-Type': 'application/json',
	'Cache-Control': 'no-store',
	'X-Content-Type-Options': 'nosniff'
};

/** Every answer of the relay that has a body: JSON that is never cached and never sniffed. */
export function relayResponse(
	status: number,
	body: unknown,
	headers: Record<string, string> = {}
): Response {
	return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...headers } });
}

/** A failure is its code and nothing else. */
export function relayError(
	status: number,
	error: RelayErrorCode,
	headers: Record<string, string> = {}
): Response {
	return relayResponse(status, { error }, headers);
}
