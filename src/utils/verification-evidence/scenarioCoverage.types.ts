import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';
import type { Gathered } from './gatherCaptures';
import type { ScenarioResult } from '../../core/verification-evidence/verificationTypes';

export interface CoverageInput {
	scenario: ScenarioManifest;
	/** The exact commit being verified; captures must come from a build of it. */
	commit: string;
	gathered: Gathered[];
	/** True when a check that produced these captures failed or timed out. */
	checkFailed: boolean;
	/** The builds the project declares, and the identity of each one setup compiled. */
	builds?: { declared: string[]; compiled: Map<string, string> };
}

export interface CoverageResult {
	states: ScenarioResult['states'];
	failures: string[];
}

export type Evidence = ScenarioManifest['evidence'][number];

export type Viewport = ScenarioManifest['viewports'][number];
