import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

export interface RegistryRead {
	manifests: ComponentManifest[];
	/** Problems with stored manifests; the registry is unusable for gating while any exist. */
	errors: string[];
	/** Units whose stored file is not in canonical form. */
	unformatted: string[];
}
