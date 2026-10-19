import type { CatalogRow, CatalogOrder, CatalogFilter } from '../../../utils/entityCatalog';
import { byName } from '../../../utils/entityCatalog';

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
			(row) =>
				!filter.verification ||
				filter.verification === 'all' ||
				row.verdict.passed === (filter.verification === 'passed')
		)
		.filter(
			(row) => !filter.usage || filter.usage === 'all' || row.shared === (filter.usage === 'shared')
		)
		.filter((row) => {
			const symbols = row.helper?.name ?? '';
			return (
				!wanted ||
				`${row.name} ${row.entity.name} ${row.summary} ${symbols}`.toLowerCase().includes(wanted)
			);
		})
		.sort(orders[filter.order]);
}
