import { AuthFailure, authFail } from './authFail';

const MAX_BODY = 16384;
const OPAQUE_BEARER = /^Bearer ([A-Za-z0-9_-]{32,128})$/;
const baseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export interface AuthHttpOptions {
	status?: number;
	cookies?: string[];
}

function withCookies(response: Response, cookies: string[] = []): Response {
	for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
	return response;
}

/** JSON response that is never cached. Cookies are appended one header each. */
export function authHttp(body: unknown, options: AuthHttpOptions = {}): Response {
	const headers = { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' };
	const response = new Response(JSON.stringify(body), { status: options.status ?? 200, headers });
	return withCookies(response, options.cookies);
}

export function authRedirect(location: string, cookies: string[] = []): Response {
	const headers = { ...baseHeaders, Location: location, 'Referrer-Policy': 'no-referrer' };
	return withCookies(new Response(null, { status: 303, headers }), cookies);
}

/** Anything that is not an AuthFailure becomes an opaque 500. */
export function authFailure(error: unknown): Response {
	const failure = error instanceof AuthFailure ? error : new AuthFailure('auth-unavailable');
	return authHttp({ error: failure.code }, { status: failure.status });
}

export function sameOrigin(request: Request, origin: string): boolean {
	return request.headers.get('origin') === origin;
}

export function hasAuthorization(request: Request): boolean {
	return request.headers.has('authorization');
}

export function bearerToken(request: Request): string | null {
	return OPAQUE_BEARER.exec(request.headers.get('authorization') ?? '')?.[1] ?? null;
}

function jsonObject(text: string): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(text);
		const plain = typeof value === 'object' && value !== null && !Array.isArray(value);
		return plain ? (value as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function joined(chunks: Uint8Array[], size: number): Uint8Array {
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

/**
 * Reads a body chunk by chunk and cancels the stream as soon as it holds more than `limit`
 * bytes. Null for an oversized body, bytes that are not UTF-8, or a stream that fails.
 */
export async function boundedText(
	body: ReadableStream<Uint8Array> | null,
	limit: number
): Promise<string | null> {
	const reader = body?.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (let part = await reader?.read(); part && !part.done; part = await reader?.read()) {
			size += part.value.byteLength;
			if (size > limit) {
				await reader?.cancel();
				return null;
			}
			chunks.push(part.value);
		}
		return new TextDecoder('utf-8', { fatal: true }).decode(joined(chunks, size));
	} catch {
		return null;
	}
}

/** A JSON content type is required, which also forces a preflight on cross-origin callers. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
	const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (type !== 'application/json' || declared > MAX_BODY) {
		await request.body?.cancel().catch(() => undefined);
		return authFail('invalid-request');
	}
	const text = await boundedText(request.body, MAX_BODY);
	return (text === null ? null : jsonObject(text)) ?? authFail('invalid-request');
}

export type AuthRoute = (request: Request) => Promise<Response>;
/** Keyed by `METHOD /path`. */
export type AuthRoutes = Record<string, AuthRoute>;

/** The request path when it is inside the namespaces authentication owns, else null. */
export function authPath(request: Request): string | null {
	const path = new URL(request.url).pathname;
	return path.startsWith('/api/auth/') || path.startsWith('/api/github/') ? path : null;
}
