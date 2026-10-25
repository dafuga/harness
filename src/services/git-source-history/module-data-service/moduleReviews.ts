import { moduleScenarioReviews } from '../../../utils/git-source-history/moduleScenarioReviews';
import type { ModuleData } from '../ModuleDataService.types';
import { ModuleDataSourceAdapter } from '../../../adapters/git-source-history/ModuleDataSourceAdapter';
import { ModuleDataReviewRepository } from '../../../repositories/git-source-history/ModuleDataReviewRepository';
import { ScenarioRepository } from '../../../repositories/ScenarioRepository';
import { revisionRegistry } from '../../../utils/revisionRegistry';
import { unitMetadata } from '../../explorer-ui/revision-detail-service/unitMetadata';
import { componentVersion } from '../../../utils/development-tooling/componentVersion';
import { UnitRegistryValidator } from '../../../validators/development-tooling/UnitRegistryValidator';
import { readFile } from 'node:fs/promises';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { ModuleReview } from '../../../repositories/git-source-history/ModuleDataReviewRepository.types';
import { moduleReviewDocument } from '../../../repositories/git-source-history/module-data-review-repository/moduleReviewSchema';
export async function readModuleReviews(path?: string) {
	if (!path) return [];
	const document = moduleReviewDocument.parse(JSON.parse(await readFile(path, 'utf8')));
	return Array.isArray(document) ? document : [document];
}
/** Reviews are declarations about this exact owned source, never borrowed implementation or evidence. */
export function applyModuleReviews(
	units: ComponentManifest[],
	reviews: ModuleReview[],
	blobs: Map<string, string>
) {
	for (const review of reviews) {
		const unit = units.find((unit) => unit.id === review.unit);
		if (
			unit?.owns.source.length !== Object.keys(review.files).length ||
			unit.owns.source.some((path) => blobs.get(path) !== review.files[path])
		)
			throw new Error(`Metadata review source changed: ${review.unit}`);
		Object.assign(unit, globalThis.structuredClone(review.metadata));
		if (review.metadata.responsibility) unit.responsibilityOrigin = 'declared';
	}
}

/** Re-author descriptions against cached, sealed source facts without indexing unchanged source. */
export async function reviewedModuleFacts(root: string, prior: ModuleData) {
	const tree = await ModuleDataSourceAdapter.open(root, prior.commit);
	const blobs = new Map((await tree.list()).map((entry) => [entry.path, entry.hash]));
	const reviews = await new ModuleDataReviewRepository(root).read(prior);
	const declarations = globalThis.structuredClone(prior.declarations);
	applyModuleReviews(declarations, reviews, blobs);
	const changed = new Set(reviews.map((review) => review.unit));
	const scenarios = await new ScenarioRepository(root).read(tree);
	const scenarioIssues = moduleScenarioReviews(scenarios.manifests, reviews);
	const fresh = revisionRegistry(declarations, scenarios.manifests, blobs);
	const old = new Map(prior.registry.units.map((unit) => [unit.id, unit]));
	const registry = {
		...prior.registry,
		scenarios: fresh.scenarios,
		units: fresh.units.map((unit) =>
			changed.has(unit.id) ? { ...old.get(unit.id), ...unit } : old.get(unit.id)!
		)
	};
	const enriched = registry.units.filter((unit) => changed.has(unit.id));
	await unitMetadata(tree, enriched);
	for (const unit of enriched)
		for (const helper of unit.helpers ?? []) {
			const existing = old
				.get(unit.id)
				?.helpers?.find((item) => item.source === helper.source && item.name === helper.name);
			if (existing) helper.consumers = globalThis.structuredClone(existing.consumers);
		}
	const files = new Map([...blobs].map(([path, hash]) => [path, { hash }]));
	const versions = { ...prior.versions };
	for (const declaration of declarations)
		if (changed.has(declaration.id))
			versions[declaration.id] = componentVersion(declaration, files);
	const validator = new UnitRegistryValidator();
	const oldIssues = new Set(validator.validate(prior.declarations, new Set(blobs.keys())));
	const sourceIssues = [
		...unresolvedReviewIssues(
			prior.sourceIssues.filter((issue) => !oldIssues.has(issue) && !scenarioIssues.has(issue)),
			reviews
		),
		...validator.validate(declarations, new Set(blobs.keys()))
	];
	return {
		declarations,
		reviews,
		registry,
		versions,
		sourceGraph: prior.sourceGraph,
		references: prior.references,
		relationships: prior.relationships,
		sourceIssues
	};
}

/** Authored reviews supersede only the corresponding stale historical manifest diagnostics. */
export function unresolvedReviewIssues(issues: string[], reviews: ModuleReview[]) {
	const repaired = reviews.flatMap((review) => [
		...(review.metadata.runtime
			? [`${review.unit}: runtime.targets must include the default `]
			: []),
		...(review.metadata.responsibility
			? [
					`${review.unit}: responsibility differs from the derived text; set responsibilityOrigin to "declared"`
				]
			: [])
	]);
	return issues.filter((issue) => !repaired.some((prefix) => issue.startsWith(prefix)));
}
