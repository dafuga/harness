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
