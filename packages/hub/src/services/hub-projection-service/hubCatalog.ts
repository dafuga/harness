import { categoryOf } from '../../../../desktop/src/utils/categoryOf';
import type { ComponentManifest } from '../../../../../src/core/unitTypes';
import type { CatalogEntity, Relationship } from '../../../../desktop/src/models/Desktop.types';

export function hubRelationships(
	unit: ComponentManifest,
	units: ComponentManifest[],
	items: CatalogEntity[]
): Relationship[] {
	return units.flatMap((candidate) => {
		if (candidate.id === unit.id) return [];
		const usedBy = candidate.dependencies.some((d) => d.unit === unit.id);
		if (!usedBy && !unit.dependencies.some((d) => d.unit === candidate.id)) return [];
		const related = items.find((i) => i.id === candidate.id);
		return [
			{
				id: candidate.id,
				title: candidate.title,
				category: categoryOf(candidate.kind),
				direction: usedBy ? ('used-by' as const) : ('uses' as const),
				hasPlan: Boolean(related?.hasPlan),
				verification: related?.verification ?? 'unknown'
			}
		];
	});
}
