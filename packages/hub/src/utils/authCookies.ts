export const SESSION_COOKIE = '__Host-harness_session';
export const CHALLENGE_COOKIE = '__Host-harness_challenge';
export const EMAIL_PROOF_COOKIE = '__Host-harness_email_proof';

const OPAQUE = /^[A-Za-z0-9_-]{32,128}$/;

export interface CookieOptions {
	maxAge: number;
	sameSite: 'Lax' | 'Strict';
}

/** Reads one opaque cookie. A duplicated or malformed value reads as absent. */
export function authCookies(request: Request, name: string): string | null {
	const values = (request.headers.get('cookie') ?? '')
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part.startsWith(`${name}=`))
		.map((part) => part.slice(name.length + 1));
	return values.length === 1 && OPAQUE.test(values[0]) ? values[0] : null;
}

/** Host-only (`__Host-` prefix, no Domain), HttpOnly and always Secure. */
export function issueCookie(name: string, value: string, options: CookieOptions): string {
	return `${name}=${value}; Path=/; Max-Age=${options.maxAge}; HttpOnly; Secure; SameSite=${options.sameSite}`;
}

export function clearCookie(name: string, sameSite: CookieOptions['sameSite']): string {
	return issueCookie(name, '', { maxAge: 0, sameSite });
}
