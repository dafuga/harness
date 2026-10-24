import type { RoutePreview } from './routePages.types';
import { ids } from '../../../../test/entityUnits';
import { openRoute, page } from './router.svelte';
import { routeIds } from './routeUnits';
import { text, type PreviewProps } from './shared';
/** Where the route history is shown: the tip of its feature branch, where the explorer opens. */
const branch = '/harness/branch/feature%2Forders';
/** The entity each category opens on; Layouts and Models open the synthetic route units. */
const opened: Record<string, string> = {
	pages: ids.page,
	layouts: routeIds.shell,
	components: ids.list,
	functions: ids.filter,
	configs: ids.settings,
	services: ids.store,
	models: routeIds.model,
	types: routeIds.types
};
/** The index of a category, the entity it opens on, and the history of that entity. */
function category([name, entity]: [string, string]): Array<[string, RoutePreview]> {
	const unit = `reports.page.harness-branch-branch-at-${name}`;
	const route = `/harness/branch/[branch]/[...at]/${name}`;
	const listed = `${branch}/${name}`;
	const shown = `${listed}/${encodeURIComponent(entity)}`;
	return [
		[unit, { route, path: listed }],
		[`${unit}-entity`, { route: `${route}/[entity]`, path: shown }],
		[`${unit}-entity-history`, { route: `${route}/[entity]/history`, path: `${shown}/history` }]
	];
}
export const routePreviews: Record<string, RoutePreview> = {
	'reports.page.harness-branch-branch-at-translations': {
		route: '/harness/branch/[branch]/[...at]/translations',
		path: `${branch}/translations`
	},
	'reports.page.harness-branch-branch-at-platforms': {
		route: '/harness/branch/[branch]/[...at]/platforms',
		path: `${branch}/platforms`
	},
	'reports.page.harness-branch-branch-at-platforms-entity': {
		route: '/harness/branch/[branch]/[...at]/platforms/[entity]',
		path: `${branch}/platforms/web`
	},
	'reports.page.harness-branch-branch-at-styles': {
		route: '/harness/branch/[branch]/[...at]/styles',
		path: `${branch}/styles`
	},
	// No route of its own serves a callable of a function: the catch-all shows it, exactly.
	'reports.page.harness-view': {
		route: '/harness/[...view]',
		path: `${branch}/helpers/filterOrders`
	},
	...Object.fromEntries(Object.entries(opened).flatMap(category)),
	// The layout frames every page; under a branch address it also offers the console chat.
	'reports.layout.root': {
		route: '/harness/branch/[branch]/[...at]/components',
		path: `${branch}/components`
	}
};
/** SYNTHETIC fixture input: what the layout is given in place of a page, said so where drawn. */
export const syntheticLayoutChild = text(
	'<p>Synthetic layout child: a fixture stands in for the page this layout frames.</p>'
);
/**
 * Opens a route module at its address and gives it what SvelteKit gives it there: none of these
 * routes loads data or posts a form, and the layout is given its synthetic child.
 */
export function routeFixture(id: string): PreviewProps | undefined {
	const preview = routePreviews[id];
	if (!preview) return undefined;
	openRoute(preview.route, preview.path);
	const given = { data: {}, form: null, params: { ...page.params } };
	return id === 'reports.layout.root' ? { ...given, children: syntheticLayoutChild } : given;
}
