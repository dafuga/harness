import type { ProjectSnapshot } from '../models/Desktop.types';
import type { EntityEvidenceQuery } from '../models/DesktopEvidence.types';
import type { ProjectContext } from '../models/ProjectContext.types';

/** What of a workspace says where an entity is shown in history. */
export interface EvidenceView {
	snapshot: ProjectSnapshot | null;
	/** True while the address names a commit, also when that commit is the tip. */
	pinned: boolean;
	context: ProjectContext;
}

/**
 * What is asked of a backend for the recorded evidence of one entity as it is shown: the tip of
 * the branch alone, or the commit the address names beside its first parent, also when that
 * commit is the tip. Null while no project is shown.
 */
export function evidenceQuery(view: EvidenceView, entityId: string): EntityEvidenceQuery | null {
	const revision = view.snapshot?.revision;
	if (!revision) return null;
	const mode = view.pinned ? 'commit' : 'current';
	return { entityId, commit: revision.commit, branch: revision.branch, mode, ...view.context };
}
