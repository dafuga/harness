import type { PreviewManifest } from './visualUnits.types';
import { explorerCategory } from '../../../../src/utils/explorer-ui/explorerCategory';
/**
 * Whether the catalog draws a unit: an active component or shell, a page that renders its address
 * and a layout that frames pages. The explorer's own category decides route files, so a former
 * details address or a server-only route stays a Service and an options-only layout a Config.
 */
export function visualUnit(unit: PreviewManifest): boolean {
	if (unit.status !== 'active') return false;
	// Document metadata and SVG definitions have no independent rendered surface to capture.
	if (internalAtom(unit)) return false;
	if (['component', 'shell'].includes(unit.kind)) return true;
	if (!['page', 'layout'].includes(unit.kind)) return false;
	const category = explorerCategory(unit);
	return category === 'pages' || (unit.kind === 'layout' && category === 'layouts');
}
function internalAtom(unit: PreviewManifest) {
	return unit.composition?.level === 'atom' && unit.catalog?.visibility === 'internal';
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

export type { PreviewManifest } from './visualUnits.types';
