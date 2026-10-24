import type { UnitsConfig } from '../../../core/development-tooling/unitsConfig';
import type { SourceIndex } from '../../../services/development-tooling/source-index-service/SourceIndexService';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { ScenarioManifest } from '../../../core/development-tooling/unitTypes';
import type { UnitIndexResult } from './unit-index-service/UnitIndexService';
import type { UnitRegistryRepository } from '../../../repositories/verification-evidence/UnitRegistryRepository';

export interface LoadedUnits {
	root: string;
	config: UnitsConfig;
	index: SourceIndex;
	/** Manifests exactly as stored. */
	stored: ComponentManifest[];
	scenarios: ScenarioManifest[];
	/** Schema problems and config controls that cannot be read from their declared source. */
	errors: string[];
	/** Units whose stored file is not in canonical form. */
	unformatted: string[];
	/** What the registry should contain for this source tree. */
	fresh: UnitIndexResult;
	repository: UnitRegistryRepository;
}
