import type {
	ExplorerCategory,
	ExplorerEntity,
	ExplorerRelations,
	ExplorerVerdict
} from '../models/Explorer.types';

export interface CatalogRow {
	entity: ExplorerEntity;
	id: string;
	name: string;
	summary: string;
	/** True when the shown commit changed or added the entity itself. */
	changed: boolean;
	/** True when more than one entity uses it itself, or more than one page shows it. */
	shared: boolean;
	verdict: ExplorerVerdict;
	/** Names of the pages that show it. */
	usedOn: string[];
	/** Names of what uses it directly and is not a page. */
	usedBy: string[];
	/** Names of the components it contains. */
	contains: string[];
	/** The execution targets it declares. */
	targets: string[];
	/** How many components it contains. */
	components: number;
}

export const catalogOrders = ['name', 'name-desc', 'changed', 'failed'] as const;
export type CatalogOrder = (typeof catalogOrders)[number];
export const orderLabels: Record<CatalogOrder, string> = {
	name: 'Name (A → Z)',
	'name-desc': 'Name (Z → A)',
	changed: 'Changed first',
	failed: 'Failed first'
};

export interface CatalogFilter {
	search: string;
	changedOnly: boolean;
	order: CatalogOrder;
}

const names = (entities: ExplorerEntity[]) => entities.map((entity) => entity.name);
// An entity that is only reached by a change of something it uses did not change itself.
const own = ['direct', 'added'];

/** True when more than one entity uses it itself, or more than one page shows it. */
export function isShared(related: ExplorerRelations): boolean {
	return related.usedBy.length > 1 || related.pages.length > 1;
}

function rowOf(entity: ExplorerEntity, related: ExplorerRelations): CatalogRow {
	return {
		entity,
		id: entity.id,
		name: entity.name,
		summary: entity.purpose,
		changed: own.includes(entity.change ?? ''),
		shared: isShared(related),
		verdict: entity.verdict,
		usedOn: names(related.pages),
		usedBy: names(related.usedBy),
		contains: names(related.components),
		targets: entity.unit.runtime.targets.map((target) => target.kind),
		components: related.components.length
	};
}

const byName = (left: CatalogRow, right: CatalogRow) =>
	left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });

/**
 * One collection of the explorer: the entities of a category, each with the name, the
 * relations and the verdict a card or a table row shows, in order of name. What an entity
 * relates to is asked once for each listed entity and for no other; a row holds no source path.
 */
export function entityCatalog(
	entities: ExplorerEntity[],
	category: ExplorerCategory,
	relations: (id: string) => ExplorerRelations
): CatalogRow[] {
	return entities
		.filter((entity) => entity.category === category)
		.map((entity) => rowOf(entity, relations(entity.id)))
		.sort(byName);
}

const first = (flag: (row: CatalogRow) => boolean) => (left: CatalogRow, right: CatalogRow) =>
	Number(flag(right)) - Number(flag(left)) || byName(left, right);
const orders: Record<CatalogOrder, (left: CatalogRow, right: CatalogRow) => number> = {
	name: byName,
	'name-desc': (left, right) => byName(right, left),
	changed: first((row) => row.changed),
	failed: first((row) => !row.verdict.passed)
};

/** The rows a person asked for: those a search matches, only the changed ones, in an order. */
export function catalogFilter(rows: CatalogRow[], filter: CatalogFilter): CatalogRow[] {
	const wanted = filter.search.trim().toLowerCase();
	return rows
		.filter((row) => !filter.changedOnly || row.changed)
		.filter((row) => !wanted || `${row.name} ${row.summary}`.toLowerCase().includes(wanted))
		.sort(orders[filter.order]);
}

/** Names in a cell: none, the first few, and how many more there are. */
export function listed(names: string[], most = 1): string {
	if (names.length === 0) return 'none';
	if (names.length <= most) return names.join(' · ');
	return `${names.slice(0, most).join(' · ')} + ${names.length - most} more`;
}
