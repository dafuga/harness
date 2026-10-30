import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { ComponentVersion } from '../../utils/development-tooling/componentVersion';
import type { TestAttribution } from './testAttribution.types';

export interface UnitDetail {
	manifest: ComponentManifest;
	/** Hashes identifying this exact version of the unit. */
	version: ComponentVersion;
	/** Units that depend on this unit, directly. */
	consumers: string[];
	/** Test files that import this unit's source, directly or transitively. */
	tests: string[];
	/** Additive attribution view; legacy tests remains the full conservative impact closure. */
	testAttribution?: TestAttribution;
	/** Public contracts of direct dependencies, so their implementations need not be read. */
	dependencies: Array<Pick<ComponentManifest, 'id' | 'responsibility' | 'contract'>>;
}
