import type { Leaving } from './router.svelte.types';
import { onDestroy } from 'svelte';
/**
 * The route given to components mounted without the SvelteKit application shell. A route module
 * is opened under its route, and its params are read from the address as SvelteKit reads them.
 */
export const page = $state({
	url: new URL('http://component.fixture/harness/branch/feature%2Forders/components'),
	route: { id: null as string | null },
	params: {} as Record<string, string>
});
/** Opens a route module at an address it serves, in place of the address the preview opened at. */
export function openRoute(id: string, path: string) {
	page.route.id = id;
	place(new URL(path, location.origin));
	history.replaceState(history.state, '', page.url);
}
/** An address the open route does not serve leaves that route, so no params are read from it. */
function place(url: URL) {
	const params = page.route.id ? routeParams(page.route.id, url.pathname) : null;
	if (!params) page.route.id = null;
	page.url = url;
	page.params = params ?? {};
}
/** A route id's params in a pathname, decoded; a rest param may be empty. Null if unserved. */
export function routeParams(id: string, pathname: string): Record<string, string> | null {
	const names: string[] = [];
	const pattern = id
		.split('/')
		.filter(Boolean)
		.map((part) => {
			const [, rest, name] = /^\[(\.\.\.)?(\w+)\]$/.exec(part) ?? [];
			if (!name) return '/' + part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			names.push(name);
			return rest ? '(?:/(.*))?' : '/([^/]+)';
		})
		.join('');
	const found = new RegExp(`^${pattern}/?$`).exec(pathname);
	if (!found) return null;
	return Object.fromEntries(
		names.map((name, at) => [name, decodeURIComponent(found[at + 1] ?? '')])
	);
}
/** What mounted components register to be asked before the fixture navigates, as in SvelteKit. */
const guards = new Set<(leaving: Leaving) => void>();
export function beforeNavigate(guard: (leaving: Leaving) => void) {
	guards.add(guard);
	onDestroy(() => guards.delete(guard));
}
export async function goto(path: string, options: { replaceState?: boolean } = {}) {
	let cancelled = false;
	for (const guard of guards) guard({ cancel: () => (cancelled = true), willUnload: false });
	if (cancelled) return;
	place(new URL(path, location.origin));
	if (options.replaceState) history.replaceState({}, '', page.url);
	else history.pushState({}, '', page.url);
}
