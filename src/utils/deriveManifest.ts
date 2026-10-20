import type { SourceFile } from '../core/sourceTypes';
import type { ComponentManifest } from '../core/unitTypes';

export interface DeriveInput {
	id: string;
	kind: string;
	files: SourceFile[];
	/** Active unit that owns each repository-relative source path. */
	owners: ReadonlyMap<string, string>;
	/** Retired identities this unit is known to continue. */
	predecessors?: string[];
	previous?: ComponentManifest;
}

export { deriveManifest } from '../workflows/load-units/unit-index-service/deriveManifest';
