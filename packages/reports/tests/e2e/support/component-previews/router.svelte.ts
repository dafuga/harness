/** The route given to components mounted without the SvelteKit application shell. */
export const page = $state({
	url: new URL('http://component.fixture/harness/branch/feature%2Forders/components')
});
export async function goto(path: string, options: { replaceState?: boolean } = {}) {
	page.url = new URL(path, location.origin);
	if (options.replaceState) history.replaceState({}, '', page.url);
	else history.pushState({}, '', page.url);
}
