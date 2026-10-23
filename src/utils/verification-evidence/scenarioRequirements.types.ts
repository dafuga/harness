import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';

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
