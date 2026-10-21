import type { ExplorerEntity, ExplorerLocation } from '../../models/explorer-ui/Explorer.types';

/**
 * The address of an entity under the category it has at the shown revision, when its address
 * names another: an old Components address of a unit that is now a shell leads to Shells, with
 * its branch, commit, section and tab kept. Null when the address is right, names no entity, or
 * names one the revision does not list.
 */
export function correctedLocation(
	at: ExplorerLocation,
	entities: Pick<ExplorerEntity, 'id' | 'category'>[]
): ExplorerLocation | null {
	const found = at.entity ? entities.find((item) => item.id === at.entity) : undefined;
	return found && found.category !== at.category ? { ...at, category: found.category } : null;
}
