import { isScopeId } from './syncScope';

/** Every answer is private, never stored and never cross-origin: no CORS header is ever written. */
const privateHeaders = {
	'Cache-Control': 'private, no-store',
	'X-Content-Type-Options': 'nosniff'
};

export const SYNC_PREFIX = '/api/sync/v1/';

export function syncJson(body: unknown, status = 200): Response {
	return Response.json(body, { status, headers: privateHeaders });
}

export function syncProblem(
	status: number,
	error: string,
	extra: Record<string, unknown> = {}
): Response {
	return syncJson({ error, ...extra }, status);
}

export function syncText(body: BodyInit, headers: Record<string, string>): Response {
	return new Response(body, {
		headers: { ...privateHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...headers }
	});
}

/** The body as text, or null when it is longer than `limit` bytes. It is abandoned at the first byte over. */
export async function readSyncText(request: Request, limit: number): Promise<string | null> {
	if (Number(request.headers.get('Content-Length') ?? 0) > limit) return null;
	if (!request.body) return '';
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, at);
		at += chunk.length;
	}
	return new TextDecoder().decode(bytes);
}

/** A JSON value from the body, or undefined when it is too long or not JSON. */
export async function readSyncJson(request: Request, limit: number): Promise<unknown> {
	const text = await readSyncText(request, limit);
	if (text === null) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/** A non-negative safe integer from a query parameter, or the fallback when it is absent. */
export function queryNumber(url: URL, name: string, fallback: number): number | null {
	const raw = url.searchParams.get(name);
	if (raw === null) return fallback;
	return /^-?\d{1,15}$/.test(raw) ? Number(raw) : null;
}

/** A device id: 16 random bytes, base64url. */
export function isDeviceId(value: unknown): value is string {
	return isScopeId(value);
}
