import type { ExplorerEntity, ExplorerLocation } from '../../models/explorer-ui/Explorer.types';

/**
 * The address of an entity under the category it has at the shown revision, when its address
 * names another: an old Components address of a unit that is now a shell leads to Shells, with
 * its branch, commit, section and tab kept. Null when the address is right, names no entity, or
 * names one the revision does not list.
 */
export function correctedLocation(
	at: ExplorerLocation,
	entities: Array<Pick<ExplorerEntity, 'id' | 'category'> & Partial<Pick<ExplorerEntity, 'unit'>>>
): ExplorerLocation | null {
	if (at.category === 'functions' && at.helper && !at.entity) {
		const owners = helperOwners(at, entities);
		return owners.length === 1 ? { ...at, entity: owners[0].id } : null;
	}
	const found = at.entity ? entities.find((item) => item.id === at.entity) : undefined;
	return found && found.category !== at.category ? { ...at, category: found.category } : null;
}

/** Omit an owner only when this revision proves the callable name is unambiguous. */
export function compactHelperLocation(
	at: ExplorerLocation,
	entities: ExplorerEntity[]
): ExplorerLocation {
	if (at.category !== 'functions' || !at.helper || !at.entity) return at;
	const owners = helperOwners(at, entities);
	if (owners.length !== 1 || owners[0].id !== at.entity) return at;
	const compact = { ...at };
	delete compact.entity;
	return compact;
}

function helperOwners(
	at: ExplorerLocation,
	entities: Array<Pick<ExplorerEntity, 'id' | 'category'> & Partial<Pick<ExplorerEntity, 'unit'>>>
) {
	return entities.filter(
		(item) =>
			item.category === 'functions' &&
			item.unit?.helpers?.some((helper) => helper.name === at.helper)
	);
}
