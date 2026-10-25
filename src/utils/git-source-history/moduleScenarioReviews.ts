import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';
import type { ModuleReviewInput } from '../../repositories/git-source-history/ModuleDataReviewRepository.types';
import { ScenarioManifestValidator } from '../../validators/verification-evidence/ScenarioManifestValidator';

/** Amend wanted evidence declarations, retaining the original test targets, states and observations. */
export function moduleScenarioReviews(scenarios: ScenarioManifest[], reviews: ModuleReviewInput[]) {
	const validator = new ScenarioManifestValidator();
	const superseded = new Set<string>();
	const reviewed = new Set<string>();
	for (const review of reviews) {
		for (const requested of review.scenarios ?? []) {
			if (reviewed.has(requested.id)) throw new Error(`Duplicate review scenario: ${requested.id}`);
			reviewed.add(requested.id);
			const scenario = scenarios.find((item) => item.id === requested.id);
			if (!scenario?.units.includes(review.unit))
				throw new Error(`Unknown review scenario for ${review.unit}: ${requested.id}`);
			const file = `${scenario.id}.json`;
			for (const error of validator.validate(scenario, file).errors) superseded.add(error);
			const checked = validator.validate({ ...scenario, evidence: requested.evidence }, file);
			if (checked.errors.length) throw new Error(checked.errors.join('\n'));
			scenario.evidence = globalThis.structuredClone(requested.evidence);
		}
	}
	return superseded;
}
