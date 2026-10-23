import type { FileClass } from '../../../core/development-tooling/sourceTypes';
import type { UnitIdentity } from '../unitIdentity';

export interface PathClass {
	classification: FileClass;
	/** Name of the workspace that owns the path. */
	workspace: string;
	workspaceRoot: string;
	/** Path relative to its workspace root. */
	relative: string;
	identity?: UnitIdentity;
}
