import type { CatalogSection } from './catalogGroups.types';
import type { CatalogRow } from '../../../utils/explorer-ui/entityCatalog';

const ungrouped = { id: 'uncategorized', title: 'Uncategorized' };

/** Build sections from only eligible catalog rows, keeping requested order within each group. */
export function catalogSections(rows: CatalogRow[]): CatalogSection[] {
	const sections = new Map<string, CatalogSection>();
	for (const row of rows) {
		const group = row.group ?? ungrouped;
		const section = sections.get(group.id) ?? { ...group, rows: [] };
		section.rows.push(row);
		sections.set(group.id, section);
	}
	return [...sections.values()].sort((left, right) => {
		if (left.id === ungrouped.id) return 1;
		if (right.id === ungrouped.id) return -1;
		return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' });
	});
}

/** Filter counts use the complete catalog, so search does not remove an available category. */
export function catalogGroups(
	rows: CatalogRow[]
): Array<{ id: string; title: string; count: number }> {
	return catalogSections(rows).map(({ id, title, rows }) => ({ id, title, count: rows.length }));
}
