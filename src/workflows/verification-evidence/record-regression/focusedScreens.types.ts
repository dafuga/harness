import type { ScenarioManifest } from '../../../core/unitTypes';

export interface FocusedContext {
	commit: string;
	scenarios: ScenarioManifest[];
	knownUnits?: string[];
}
