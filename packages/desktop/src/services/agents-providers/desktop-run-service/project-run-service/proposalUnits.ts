import {
	categories,
	type CatalogEntity
} from '../../../../models/development-tooling/Desktop.types';
import type { ProjectRunRequest } from '../../../../models/development-tooling/DesktopBridge.types';

/** Every word of a text that has the unit id grammar, a reference marker's id included. */
const written = /[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+/g;

/**
 * The registered ids a creation prompt lists, in order: those the request names, then the
 * catalog it was made in, then the other catalogs. That catalog is a hint, so a page may name a
 * component or a function. A planned draft has no registry entry and is never listed.
 */
export function proposalUnits(
	listed: CatalogEntity[],
	request: Pick<ProjectRunRequest, 'category' | 'text'>
): string[] {
	const registered = listed.filter((unit) => !unit.planned);
	const known = new Set(registered.map((unit) => unit.id));
	const named = (request.text.match(written) ?? []).filter((id) => known.has(id));
	const order = [request.category, ...categories.filter((item) => item !== request.category)];
	const ranked = order.flatMap((category) =>
		registered.filter((unit) => unit.category === category).map((unit) => unit.id)
	);
	return [...new Set([...named, ...ranked])];
}
