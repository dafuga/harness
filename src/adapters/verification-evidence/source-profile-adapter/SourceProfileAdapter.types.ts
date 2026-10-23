import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';

export interface SourceProfileAdapterConfig {
	root: string;
	units: ComponentManifest[];
}
