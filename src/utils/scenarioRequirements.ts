import type { ScenarioManifest } from '../core/unitTypes';

export interface RequiredCapture {
	evidence: string;
	kind: ScenarioManifest['evidence'][number]['kind'];
	state: string;
	viewport?: string;
}

export interface ScenarioRequirements {
	/** Every capture a passing verification must contain. */
	required: RequiredCapture[];
	/** Applicable states nothing proves yet; a scenario with any of these cannot pass. */
	unproven: Array<{ state: string; reason: string }>;
	/** States that cannot occur for this scenario, with the reason. */
	excluded: Array<{ state: string; reason: string }>;
}

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
