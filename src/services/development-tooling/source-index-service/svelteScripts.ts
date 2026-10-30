export function svelteScripts(code: string): string[] {
	return [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}
