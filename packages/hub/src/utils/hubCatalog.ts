import { catalogUnit, planCatalog } from '../../../desktop/src/utils/catalogUnit';
import { categoryOf } from '../../../desktop/src/utils/categoryOf';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import type { CatalogEntity, Relationship } from '../../../desktop/src/models/Desktop.types';
import type { HubSourceContext } from './hubSource';
import { hubPlans, hubPlanRecord } from './hubPlans';
import { hubRecords } from './hubRecords';
import { hubFail } from './hubJson';
import type { HubPlan } from './hubSchemas';
export async function hubCatalog(context: HubSourceContext) {
	const [units, plans, changedPaths] = await Promise.all([
		hubRecords(context),
		hubPlans(context),
		context.source.changed(context.repository, context.commit)
	]);
	const changed = new Set(changedPaths),
		items = new Map<string, CatalogEntity>();
	units.forEach((u) => {
		const item = catalogUnit(u, changed);
		if (item) items.set(u.id, item);
	});
	const records = await Promise.all(
		plans.map(async (plan) => {
			const unit = units.find((u) => u.id === plan.unitId);
			hubAttestPlan(plan, unit);
			return hubPlanRecord(context, plan);
		})
	);
	records.forEach((plan) =>
		items.set(plan.id, planCatalog(plan, items.get(plan.id) ?? null, changed))
	);
	return {
		items: [...items.values()].sort((a, b) => a.title.localeCompare(b.title)),
		units,
		plans,
		records
	};
}
export function hubAttestPlan(plan: HubPlan, unit: ComponentManifest | undefined) {
	if (unit && unit.kind !== plan.category) return hubFail();
	if (!unit && plan.unitId !== `${plan.category}.${plan.slug}`) return hubFail();
}
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
export function hubOwnedPaths(context: HubSourceContext, unit: ComponentManifest) {
	return context.entries
		.filter(
			(e) =>
				e.type === 'blob' &&
				unit.owns.source.some((p) => e.path === p || e.path.startsWith(p.replace(/\/$/, '') + '/'))
		)
		.map((e) => e.path);
}
