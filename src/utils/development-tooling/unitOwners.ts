import type { OwnedSource } from './unitOwners.types';

/**
 * Tells which units own a path. A unit owns the files it lists and everything under a
 * directory it lists. A path nobody lists has no owner, and none is guessed from its name.
 */
export function unitOwners(units: OwnedSource[]): (path: string) => string[] {
	const files = new Map<string, string[]>();
	const directories: Array<[string, string]> = [];
	for (const unit of units) {
		for (const entry of unit.source) {
			if (entry.endsWith('/')) directories.push([entry, unit.id]);
			else files.set(entry, [...(files.get(entry) ?? []), unit.id]);
		}
	}
	return (path) => {
		const held = directories.filter(([directory]) => path.startsWith(directory));
		return [...new Set([...(files.get(path) ?? []), ...held.map(([, id]) => id)])].sort();
	};
}

export type { OwnedSource } from './unitOwners.types';
