import type { EvidenceView } from './evidenceQuery.types';
import type { EntityEvidenceQuery } from '../../models/verification-evidence/DesktopEvidence.types';

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

export type { EvidenceView } from './evidenceQuery.types';
