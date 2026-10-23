import type { ComponentManifest } from '../../../../core/development-tooling/unitTypes';
import type { SourceFile } from '../../../../core/development-tooling/sourceTypes';

export interface UnitMove {
	id: string;
	from: string;
	to: string;
}

export interface UnitIndexResult {
	manifests: ComponentManifest[];
	added: string[];
	updated: string[];
	moved: UnitMove[];
	revived: string[];
	orphaned: string[];
}

export interface Group {
	id: string;
	kind: string;
	files: SourceFile[];
}

export interface Registry {
	byId: Map<string, ComponentManifest>;
	/** Active owner of each source path. */
	owners: Map<string, string>;
	groups: Map<string, Group>;
	result: UnitIndexResult;
}
