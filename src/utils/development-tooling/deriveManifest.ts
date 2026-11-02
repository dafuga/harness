// @harness-uid u_adiz32coug
import type { SourceFile } from '../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

export interface DeriveInput {
	id: string;
	kind: string;
	/** The stable uid of the unit, from the registry or the annotation of its files. */
	uid?: string;
	files: SourceFile[];
	/** Active unit that owns each repository-relative source path. */
	owners: ReadonlyMap<string, string>;
	/** Retired identities this unit is known to continue. */
	predecessors?: string[];
	previous?: ComponentManifest;
}

export { deriveManifest } from '../../workflows/development-tooling/load-units/unit-index-service/deriveManifest';
