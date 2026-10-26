import type { ComponentManifest } from '../../../../../core/development-tooling/unitTypes';
import type { ScenarioManifest } from '../../../../../core/development-tooling/unitTypes';

export interface Registry {
	/** Manifests exactly as stored at the revision. */
	stored: ComponentManifest[];
	scenarios?: ScenarioManifest[];
	errors?: string[];
}
