import { onDestroy } from 'svelte';
type Leaving = { cancel: () => void; willUnload: boolean };
/** The route given to components mounted without the SvelteKit application shell. */
export const page = $state({
	url: new URL('http://component.fixture/harness/branch/feature%2Forders/components')
});
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
	page.url = new URL(path, location.origin);
	if (options.replaceState) history.replaceState({}, '', page.url);
	else history.pushState({}, '', page.url);
}
