import googleSignIn from '../../../../../desktop/static/google-sign-in.svg?inline';

export const base = '';

/** The isolated fixture has no static asset server, so bundle the sign-in button image. */
export function asset(path: string): string {
	return path === '/google-sign-in.svg' ? googleSignIn : `${base}${path}`;
}

/** Deterministic SvelteKit path context for the real components in the isolated fixture. */
export function resolve(path: string, params: Record<string, string> = {}): string {
	return path.replace(/\[([^\]]+)\]/g, (_, key: string) => encodeURIComponent(params[key] ?? key));
}

/** Only the preview compiler includes this runtime mock; app compilers keep their own route IDs. */
declare module '$app/paths' {
	export function resolve(path: string, params?: Record<string, string>): string;
}
