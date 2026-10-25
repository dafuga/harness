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
		const metadata = globalThis.structuredClone(review.metadata);
		if (metadata.preview === null) {
			delete unit.preview;
			delete metadata.preview;
		}
		Object.assign(unit, metadata);
		if (review.metadata.responsibility) unit.responsibilityOrigin = 'declared';
	}
}

/** Authored reviews supersede only the corresponding stale historical manifest diagnostics. */
export function unresolvedReviewIssues(issues: string[], reviews: ModuleReview[]) {
	const repaired = reviews.flatMap((review) => [
		...(review.metadata.runtime
			? [`${review.unit}: runtime.targets must include the default `]
			: []),
		...(review.metadata.preview === null
			? [
					`${review.unit}: only page and component units may declare a preview`,
					`${review.unit}: unknown preview scenario `,
					`${review.unit}: preview state `
				]
			: []),
		...(review.metadata.responsibility
			? [
					`${review.unit}: responsibility differs from the derived text; set responsibilityOrigin to "declared"`
				]
			: [])
	]);
	return issues.filter((issue) => !repaired.some((prefix) => issue.startsWith(prefix)));
}
