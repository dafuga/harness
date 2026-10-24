import type {
	CatalogRow,
	CatalogOrder,
	CatalogFilter
} from '../../../utils/explorer-ui/entityCatalog';
import { byName } from '../../../utils/explorer-ui/entityCatalog';

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
		.filter(
			(row) => !filter.groups?.length || filter.groups.includes(row.group?.id ?? 'uncategorized')
		)
		.filter(
			(row) =>
				!filter.verification ||
				filter.verification === 'all' ||
				row.verdict.passed === (filter.verification === 'passed')
		)
		.filter(
			(row) => !filter.usage || filter.usage === 'all' || row.shared === (filter.usage === 'shared')
		)
		.filter((row) => {
			const symbols =
				row.setting?.value ??
				row.helper?.name ??
				(row.entity.category === 'apis' ? row.entity.unit.owns.symbols.join(' ') : '');
			const text = `${row.name} ${row.entity.name} ${row.entity.unit.title} ${row.summary} ${symbols} ${row.group?.title ?? ''}`;
			return (
				!wanted ||
				text.toLowerCase().includes(wanted) ||
				text
					.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
					.toLowerCase()
					.includes(wanted)
			);
		})
		.sort(orders[filter.order]);
}
