import type { CatalogEntity } from '../models/Desktop.types';
import type { PlanningPort } from '../models/PlanningPort.types';
import type { GitSourceAdapter } from '../adapters/GitSourceAdapter';
import { catalogUnit, planCatalog } from '../utils/catalogUnit';
import { catalogDetail } from '../utils/catalogDetail';
export class CatalogService {
	constructor(
		private source: GitSourceAdapter,
		private planning: PlanningPort
	) {}
	async list(revision: string): Promise<CatalogEntity[]> {
		const [units, plans, changed] = await Promise.all([
			this.source.units(revision),
			this.planning.plans(revision),
			this.source.changed(revision)
		]);
		const catalog = new Map(
			units.flatMap((u) => {
				const item = catalogUnit(u, changed);
				return item ? [[u.id, item] as const] : [];
			})
		);
		plans.forEach((plan) =>
			catalog.set(plan.id, planCatalog(plan, catalog.get(plan.id) ?? null, changed))
		);
		return [...catalog.values()].sort((a, b) => a.title.localeCompare(b.title));
	}
	async entity(id: string, revision: string) {
		const [items, units] = await Promise.all([this.list(revision), this.source.units(revision)]);
		return catalogDetail(
			{ source: this.source, planning: this.planning },
			{ id, revision, items, units }
		);
	}
}
