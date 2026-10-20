export const base = '';
/** Deterministic SvelteKit path context for the real Hub component in the isolated fixture. */
export function resolve(path: string, params: Record<string, string> = {}): string {
	return path.replace(/\[([^\]]+)\]/g, (_, key: string) => encodeURIComponent(params[key] ?? key));
}
