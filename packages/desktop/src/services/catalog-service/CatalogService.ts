import type { CatalogEntity } from '../../models/Desktop.types.ts';
import type { PlanningPort } from '../../models/PlanningPort.types.ts';
import type { GitSourceAdapter } from '../../adapters/git-source-adapter/GitSourceAdapter';
import { catalogListed, catalogUnit, planCatalog } from '../../utils/catalogUnit';
import { catalogDetail } from './catalogDetail';

export class CatalogService {
	constructor(
		private source: GitSourceAdapter,
		private planning: PlanningPort
	) {}
	/** What a catalog shows of a revision; `entity` still opens what is left out of it. */
	async list(revision: string): Promise<CatalogEntity[]> {
		const { units, items } = await this.held(revision);
		return catalogListed(units, items);
	}
	async entity(id: string, revision: string) {
		const { units, items, plans } = await this.held(revision);
		return catalogDetail(
			{ source: this.source, planning: this.planning },
			{ id, revision, items, units, plan: plans.find((p) => p.id === id) }
		);
	}
	private async held(revision: string) {
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
		const items = [...catalog.values()].sort((a, b) => a.title.localeCompare(b.title));
		return { units, items, plans };
	}
}
