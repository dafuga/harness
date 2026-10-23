import { helperContract } from '../../../../../src/utils/helperContract';
import { explorerName } from '../../../../reports/src/utils/explorerName';
import type { ComponentManifest } from '../../../../../src/lib/contracts';
import type { CatalogEntity, DesignVersion } from '../../models/development-tooling/Desktop.types';
import type { PlanRecord } from '../../models/planning-collaboration/PlanningPort.types';
import { explorerCategory } from '../../../../reports/src/utils/explorerCategory';
import { categoryOf } from '../development-tooling/categoryOf';
function ownsChange(paths: string[], changed: Set<string>) {
	return paths.some((p) => [...changed].some((c) => c === p || c.startsWith(p + '/')));
}
export function catalogUnit(unit: ComponentManifest, changed: Set<string>): CatalogEntity | null {
	const classified = unit.kind === 'layout' ? explorerCategory(unit) : categoryOf(unit.kind);
	const category = classified === 'platforms' || classified === 'types' ? null : classified;
	if (!category || unit.status !== 'active') return null;
	const preview = catalogPreview(unit, category);
	return {
		...(unit.helperContracts?.length ? { helperContracts: unit.helperContracts } : {}),
		id: unit.id,
		category,
		kind: unit.kind,
		title: category === 'pages' ? unit.title : explorerName(unit),
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
		thumbnail: catalogThumbnail(preview, category)
	};
}
function catalogPreview(unit: ComponentManifest, category: CatalogEntity['category']) {
	return category === 'pages' || category === 'layouts' || category === 'components'
		? unit.preview
		: undefined;
}
function catalogThumbnail(
	preview: ComponentManifest['preview'],
	category: CatalogEntity['category']
) {
	return preview || category === 'pages' || category === 'layouts'
		? { source: 'recorded' as const, ...preview }
		: null;
}
/** The route files that load for an address and render nothing of it. */
const loader = /(^|\/)\+page(\.server)?\.[jt]s$/;
/**
 * What a catalog lists of a revision. A page manifest whose every file there is a page loader
 * only answers a request: the explorer calls it a route loader, not a page. It is left out and
 * stays an entity that is opened by its identity. A title or a sentence is never read.
 */
export function catalogListed(units: ComponentManifest[], items: CatalogEntity[]): CatalogEntity[] {
	const loaders = new Set(
		units
			.filter((unit) => unit.kind === 'page' && unit.owns.source.length > 0)
			.filter((unit) => unit.owns.source.every((path) => loader.test(path)))
			.map((unit) => unit.id)
	);
	return items
		.filter((item) => !loaders.has(item.id))
		.flatMap((item) => {
			if (item.category !== 'functions' || item.planned) return [item];
			const helpers = (item.helperContracts ?? []).filter(helperContract);
			return helpers.length
				? [
						{
							...item,
							title: helpers
								.map(
									(helper) =>
										`${helper.name}(${helper.inputs.map((input) => input.name.split('.').at(-1)).join(', ')})`
								)
								.join('\n')
						}
					]
				: [];
		});
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
	const design = latestDesign(plan.versions.at(-1));
	return {
		...base,
		summary: plan.goal,
		changed: base.changed || ownsChange([plan.path], changed),
		hasPlan: true,
		lifecycle: plan.lifecycle,
		threadCount: plan.threads.length,
		...design,
		thumbnail: design.thumbnail ?? base.thumbnail
	};
}
