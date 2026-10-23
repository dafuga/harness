import { helperContract } from '../../../../../src/utils/helperContract';
import { explorerCategory } from './explorerCategory';
import type { CatalogOrder, CatalogRow, Relations } from './entityCatalog.types';
export type { CatalogFilter, CatalogOrder, CatalogRow } from './entityCatalog.types';
import type { ExplorerCategory, ExplorerEntity } from '../../models/explorer-ui/Explorer.types';

export const catalogOrders = ['name', 'name-desc', 'changed', 'failed'] as const;

export const orderLabels: Record<CatalogOrder, string> = {
	name: 'Name (A → Z)',
	'name-desc': 'Name (Z → A)',
	changed: 'Changed first',
	failed: 'Failed first'
};

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
		...(entity.unit.group ? { group: entity.unit.group } : {}),
		id: entity.id,
		name: entity.name,
		summary: entity.purpose,
		changed: own.includes(entity.change ?? ''),
		shared: isShared(related, entity.unit),
		verdict: entity.verdict,
		usedIn: [
			...new Map(
				(entity.category === 'layouts' ? related.pages : [...related.usedBy, ...related.pages])
					.filter((item) => item.change !== 'removed')
					.map((item) => [item.id, item])
			).values()
		],
		usedOn: names(related.pages),
		usedBy: names(related.usedBy),
		contains: names(related.components),
		targets: entity.unit.runtime.targets.map((target) => target.kind),
		components: related.components.length
	};
}

const sharedHelper = helperContract;

/** The callable name shown on a function card, before its example arguments. */
export function functionName(unit: CatalogRow['entity']['unit']): string {
	return unit.helpers?.[0]?.name ?? '';
}

const sortName = (row: CatalogRow) => row.helper?.name ?? row.name;

function configRows(row: CatalogRow): CatalogRow[] {
	const values =
		row.entity.unit.configValues ??
		row.entity.unit.contract.outputs.map(({ name }) => ({
			name,
			value: 'Not recorded at this revision',
			source: ''
		}));
	return values.map((setting, index) => {
		const source = setting.source || row.entity.unit.owns.source[0] || row.entity.id;
		const title =
			source
				.split('/')
				.at(-1)
				?.replace(/\.[^.]+$/, '') || row.entity.name;
		return {
			...row,
			configFile: { source, title },
			id: `${row.entity.id}#config:${index}`,
			name: setting.name,
			setting
		};
	});
}

/** Global collections need shared owners; owner relationships retain one owner. */
function hasRequiredServiceOwners(count: number, options: { related?: boolean }): boolean {
	return count >= 2 || Boolean(options.related && count === 1);
}

export function byName(left: CatalogRow, right: CatalogRow): number {
	return sortName(left).localeCompare(sortName(right), 'en', { sensitivity: 'base' });
}

/** Resolve per-export runtime consumers; unrelated exports in the same module do not count. */
function helperConsumers(
	helper: NonNullable<CatalogRow['helper']>,
	entities: Map<string, ExplorerEntity>
): NonNullable<CatalogRow['usedIn']> {
	const usedIn: NonNullable<CatalogRow['usedIn']> = [];
	const seen = new Set<string>();
	for (const consumer of helper.consumers ?? []) {
		const entity = entities.get(consumer.unit);
		if (!entity || seen.has(entity.id) || entity.change === 'removed') continue;
		if (!['components', 'services', 'models'].includes(entity.category)) continue;
		seen.add(entity.id);
		usedIn.push(entity);
		if (usedIn.length === 3) break;
	}
	return usedIn;
}

/** Related cards retain private pure callees; public collections require shared ownership. */
function catalogHelpers(entity: ExplorerEntity, related?: boolean) {
	return (entity.unit.helpers ?? []).filter((helper) =>
		related ? helper.pure === true : sharedHelper(helper)
	);
}

/**
 * One collection of the explorer: the entities of a category, each with the name, the
 * relations and the verdict a card or a table row shows, in order of name. Shared helper
 * exports become separate cards pointing to their owning entity; unrecorded exports stay absent.
 */
export function entityCatalog(
	entities: ExplorerEntity[],
	category: ExplorerCategory,
	relations: (id: string) => Relations,
	options: { related?: boolean; consumers?: ExplorerEntity[] } = {}
): CatalogRow[] {
	const byId = new Map((options.consumers ?? entities).map((entity) => [entity.id, entity]));
	return entities
		.filter(
			(entity) =>
				entity.category === category && (category !== 'configs' || entity.unit.kind === 'config')
		)
		.flatMap((entity) => {
			const row = rowOf(entity, relations(entity.id));
			if (category === 'services') {
				if (entity.change === 'removed') return [];
				const service = entity.unit.serviceClasses?.find(
					(item) =>
						item.name === entity.name &&
						/^[A-Z][A-Za-z0-9]*$/.test(item.name) &&
						entity.unit.owns.source.includes(item.source) &&
						item.constructedBy.length > 0 &&
						new Set(item.methods).size >= 2
				);
				if (!service) return [];
				const usedIn = [...new Set(service.consumers.map((user) => user.unit))]
					.filter((id) => id !== entity.id)
					.map((id) => byId.get(id))
					.filter((owner): owner is ExplorerEntity =>
						Boolean(owner && owner.change !== 'removed' && owner.unit.status === 'active')
					)
					.slice(0, 3);
				const shared = usedIn.length >= 2;
				return hasRequiredServiceOwners(usedIn.length, options) ? [{ ...row, shared, usedIn }] : [];
			}
			if (category !== 'functions') return [row];
			const helpers = catalogHelpers(entity, options.related);
			if (options.related && helpers.length === 0) return [row];
			return helpers
				.map((helper) => ({
					...row,
					...(helper.group ? { group: helper.group } : {}),
					shared: true,
					helper,
					usedIn: helperConsumers(helper, byId),
					name: helper.name,
					id: helpers.length === 1 ? entity.id : `${entity.id}#${helper.source}:${helper.name}`
				}))
				.filter((item) => options.related || item.usedIn.length >= 2);
		})
		.flatMap((row) => (category === 'configs' ? configRows(row) : [row]))
		.sort(byName);
}

/** Names in a cell: none, the first few, and how many more there are. */
export function listed(names: string[], most = 1): string {
	if (names.length === 0) return 'none';
	if (names.length <= most) return names.join(' · ');
	return `${names.slice(0, most).join(' · ')} + ${names.length - most} more`;
}

export { catalogFilter } from '../../components/explorer-ui/explorer-index/entityCatalog';
