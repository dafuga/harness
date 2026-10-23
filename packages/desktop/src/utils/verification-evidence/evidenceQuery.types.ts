import type { ProjectSnapshot } from '../../models/development-tooling/Desktop.types';
import type { ProjectContext } from '../../models/projects-sessions/ProjectContext.types';

/** What of a workspace says where an entity is shown in history. */
export interface EvidenceView {
	snapshot: ProjectSnapshot | null;
	/** True while the address names a commit, also when that commit is the tip. */
	pinned: boolean;
	context: ProjectContext;
}
