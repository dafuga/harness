import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';

export interface ScenarioRead {
	manifests: ScenarioManifest[];
	errors: string[];
}
