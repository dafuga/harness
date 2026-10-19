import { explorerCategory } from "./explorerCategory";
import type { ExplorerCategory, ExplorerEntity, ExplorerRelations, ExplorerVerdict } from "../models/Explorer.types";

type Relations = Pick<ExplorerRelations, 'pages' | 'usedBy' | 'components'>;

export interface CatalogRow {
	helper?: NonNullable<ExplorerEntity['unit']['helpers']>[number];
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
	verification?: string;
	usage?: string;
}

const names = (entities: ExplorerEntity[]) => entities.map((entity) => entity.name);

// An entity that is only reached by a change of something it uses did not change itself.
const own = ['direct', 'added'];

/** True when more than one entity uses it itself, or more than one page shows it. */
export function isShared(related: Relations, unit?: ExplorerEntity['unit']): boolean {
	if (unit && explorerCategory(unit) === 'functions')
		return (unit.helpers ?? []).some((helper) => sharedHelper(helper));
	return related.usedBy.length > 1 || related.pages.length > 1;
}

function rowOf(entity: ExplorerEntity, related: Relations): CatalogRow {
	return {
		entity,
		id: entity.id,
		name: entity.name,
		summary: entity.purpose,
		changed: own.includes(entity.change ?? ''),
		shared: isShared(related, entity.unit),
		verdict: entity.verdict,
		usedOn: names(related.pages),
		usedBy: names(related.usedBy),
		contains: names(related.components),
		targets: entity.unit.runtime.targets.map((target) => target.kind),
		components: related.components.length
	};
}

function sharedHelper(helper: NonNullable<CatalogRow['helper']>): boolean {
	return (
		new Set(helper.consumers?.map((consumer) => `${consumer.unit}#${consumer.symbol ?? ''}`))
			.size >= 2
	);
}

/** The callable name shown on a function card, before its example arguments. */
export function functionName(unit: CatalogRow['entity']['unit']): string {
	return unit.helpers?.[0]?.name ?? '';
}

const sortName = (row: CatalogRow) => row.helper?.name ?? row.name;

export const byName = (left: CatalogRow, right: CatalogRow) =>
	sortName(left).localeCompare(sortName(right), 'en', { sensitivity: 'base' });

/**
 * One collection of the explorer: the entities of a category, each with the name, the
 * relations and the verdict a card or a table row shows, in order of name. Shared helper
 * exports become separate cards pointing to their owning entity; unrecorded exports stay absent.
 */
export function entityCatalog(
	entities: ExplorerEntity[],
	category: ExplorerCategory,
	relations: (id: string) => Relations
): CatalogRow[] {
	return entities
		.filter((entity) => entity.category === category)
		.flatMap((entity) => {
			const row = rowOf(entity, relations(entity.id));
			if (category !== 'functions') return [row];
			const helpers = (entity.unit.helpers ?? []).filter(sharedHelper);
			return helpers.map((helper) => ({
				...row,
				shared: true,
				helper,
				name: helper.name,
				id: helpers.length === 1 ? entity.id : `${entity.id}#${helper.source}:${helper.name}`
			}));
		})
		.sort(byName);
}

/** Names in a cell: none, the first few, and how many more there are. */
export function listed(names: string[], most = 1): string {
	if (names.length === 0) return 'none';
	if (names.length <= most) return names.join(' · ');
	return `${names.slice(0, most).join(' · ')} + ${names.length - most} more`;
}

export { catalogFilter } from '../components/harness/explorer-index/entityCatalog';
