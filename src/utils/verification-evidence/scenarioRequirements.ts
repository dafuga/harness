import type { ScenarioRequirements, RequiredCapture } from './scenarioRequirements.types';
import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';

/** Expands a scenario contract into the exact captures it demands. */
export function scenarioRequirements(scenario: ScenarioManifest): ScenarioRequirements {
	const coverage = new Map(scenario.states.map((state) => [state.id, state.coverage]));
	const required = scenario.evidence
		.filter((evidence) => evidence.required)
		.flatMap((evidence) =>
			evidence.states
				.filter((state) => coverage.get(state) === 'required')
				.flatMap((state): RequiredCapture[] => {
					const base = { evidence: evidence.id, kind: evidence.kind, state };
					if (evidence.viewports.length === 0) return [base];
					return evidence.viewports.map((viewport) => ({ ...base, viewport }));
				})
		);
	const declared = (kind: 'missing' | 'inapplicable') =>
		scenario.states
			.filter((state) => state.coverage === kind)
			.map((state) => ({ state: state.id, reason: state.reason ?? '' }));
	return { required, unproven: declared('missing'), excluded: declared('inapplicable') };
}

export type { RequiredCapture, ScenarioRequirements } from './scenarioRequirements.types';
