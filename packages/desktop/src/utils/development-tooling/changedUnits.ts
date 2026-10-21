import { isUnitId } from '../explorer-ui/entityReferences';

/** How many units one notice names; the rest are counted. */
const most = 40;

/** The registered owners of the paths, each once and sorted, and how many paths have none. */
function owned(paths: string[], owners: (path: string) => string[]) {
	const units = new Set<string>();
	let outside = 0;
	for (const path of paths) {
		const held = owners(path);
		if (!held.length) outside++;
		for (const id of held) if (isUnitId(id)) units.add(id);
	}
	return { units: [...units].sort(), outside };
}

function counted(outside: number): string {
	if (!outside) return '';
	return `${outside} ${outside === 1 ? 'file' : 'files'} outside any unit`;
}

/**
 * What a change says of its files: the units whose registered source owns them, each once and
 * as a reference, and how many files no unit owns. No path is repeated and none is guessed.
 */
export function changedUnits(paths: string[], owners: (path: string) => string[]): string {
	const { units, outside } = owned(paths, owners);
	const rest = counted(outside);
	if (!units.length) return rest && `${rest}.`;
	const named = units.slice(0, most).map((id) => `[[unit:${id}]]`);
	const more = units.length > most ? `, and ${units.length - most} more` : '';
	return `Units changed: ${named.join(', ')}${more}${rest && `; ${rest}`}.`;
}
