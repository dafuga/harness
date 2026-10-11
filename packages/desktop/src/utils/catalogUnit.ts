import type { ComponentManifest } from '../../../../src/lib/contracts';
import type { CatalogEntity, DesignVersion } from '../models/Desktop.types';
import type { PlanRecord } from '../models/PlanningPort.types';
import { categoryOf } from './categoryOf';
function ownsChange(paths: string[], changed: Set<string>) {
	return paths.some((p) => [...changed].some((c) => c === p || c.startsWith(p + '/')));
}
export function catalogUnit(unit: ComponentManifest, changed: Set<string>): CatalogEntity | null {
	const category = categoryOf(unit.kind);
	if (!category || unit.status !== 'active') return null;
	return {
		id: unit.id,
		category,
		kind: unit.kind,
		title: unit.title,
		summary: unit.responsibility,
		changed: ownsChange(unit.owns.source, changed),
		planned: false,
		hasPlan: false,
		lifecycle: null,
		verification: 'unknown',
		verificationNote: 'No complete verification for this entity at this commit has been loaded.',
		latestVersion: null,
		approvedVersion: null,
		threadCount: 0,
		thumbnail: null
	};
}
function draftCatalog(plan: PlanRecord): CatalogEntity {
	return {
		id: plan.id,
		category: plan.category,
		kind: plan.category.slice(0, -1),
		title: plan.title,
		summary: plan.goal,
		changed: false,
		planned: true,
		hasPlan: true,
		lifecycle: plan.lifecycle,
		verification: 'unverified',
		verificationNote: 'This is a plan. Approval does not verify running behavior.',
		latestVersion: null,
		approvedVersion: null,
		threadCount: 0,
		thumbnail: null
	};
}
function latestDesign(latest: DesignVersion | undefined) {
	if (!latest) return { latestVersion: null, approvedVersion: null, thumbnail: null };
	const image = latest.images[0];
	return {
		latestVersion: latest.version,
		approvedVersion: latest.approval?.current ? latest.version : null,
		thumbnail: image
			? {
					version: latest.version,
					sha256: image.sha256,
					state: image.state,
					viewport: image.viewport
				}
			: null
	};
}
export function planCatalog(
	plan: PlanRecord,
	unit: CatalogEntity | null,
	changed: Set<string>
): CatalogEntity {
	const base = unit ?? draftCatalog(plan);
	return {
		...base,
		summary: plan.goal,
		changed: base.changed || ownsChange([plan.path], changed),
		hasPlan: true,
		lifecycle: plan.lifecycle,
		threadCount: plan.threads.length,
		...latestDesign(plan.versions.at(-1))
	};
}
