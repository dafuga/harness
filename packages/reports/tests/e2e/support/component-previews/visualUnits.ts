import { explorerCategory } from '../../../../src/utils/explorer-ui/explorerCategory';
/** A unit manifest, as far as choosing and mounting its preview reads it. */
export interface PreviewManifest {
	id: string;
	title: string;
	kind: string;
	status: string;
	owns: { source: string[]; symbols: string[] };
	runtime: { entry: string };
	catalog?: { visibility: 'public' | 'internal' };
}
/**
 * Whether the catalog draws a unit: an active component or shell, a page that renders its address
 * and a layout that frames pages. The explorer's own category decides route files, so a former
 * details address or a server-only route stays a Service and an options-only layout a Config.
 */
export function visualUnit(unit: PreviewManifest): boolean {
	if (unit.status !== 'active') return false;
	if (unit.kind === 'component' || unit.kind === 'shell') return true;
	if (unit.kind !== 'page' && unit.kind !== 'layout') return false;
	const category = explorerCategory(unit);
	return category === 'pages' || (unit.kind === 'layout' && category === 'layouts');
}
/**
 * A route module whose preview opens at its own address: a Reports page or layout over the route
 * history, a Desktop page over the synthetic bridge of the orders project, or a Hub page or layout
 * over the synthetic hosted API of a signed-in person.
 */
export const routePreview = (id: string) =>
	/^(?:(?:reports|hub)\.(?:page|layout)|desktop\.page)\./.test(id);
/** What the catalog previews so far: every visual component and shell, and those routes. */
export function catalogVisual(unit: PreviewManifest): boolean {
	if (!visualUnit(unit)) return false;
	return (
		unit.kind === 'component' ||
		unit.kind === 'shell' ||
		unit.kind === 'layout' ||
		routePreview(unit.id)
	);
}
