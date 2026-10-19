import type { ComponentManifest } from '../../../../src/lib/contracts';
import { categories, type CatalogEntity } from '../models/Desktop.types';
import type { ProjectRunRequest } from '../models/DesktopBridge.types';

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

/** Put units named in the question, or described by it, ahead of the bounded prompt list. */
export function taskUnits(units: ComponentManifest[], text: string): string[] {
	const words = (value: string) =>
		value
			.toLowerCase()
			.replace(/chat/g, 'conversation')
			.match(/[a-z0-9]+/g) ?? [];
	const ignored = new Set([
		'the',
		'and',
		'which',
		'what',
		'with',
		'from',
		'this',
		'that',
		'its',
		'for',
		'you',
		'unit',
		'registered',
		'component',
		'function',
		'page'
	]);
	const terms = new Set(words(text).filter((word) => word.length > 2 && !ignored.has(word)));
	const score = (unit: ComponentManifest) => {
		if (text.includes(unit.id)) return 10000;
		return (
			words(unit.title).reduce((sum, word) => sum + (terms.has(word) ? 8 : 0), 0) +
			words(unit.responsibility).reduce((sum, word) => sum + (terms.has(word) ? 1 : 0), 0)
		);
	};
	return [...units]
		.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
		.map((unit) => unit.id);
}
