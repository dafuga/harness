import type { CacheIdentity } from '../../../../collaboration/src/models/Collaboration.types';
import type { ExplorerScope } from '../../../../reports/src/models/Explorer.types';
import type {
	ExplorerBehavior,
	ExplorerEvidence
} from '../../../../reports/src/models/ExplorerEvidence.types';
import type { EntityQuery } from '../development-tooling/DesktopBridge.types';

/**
 * Recorded runtime evidence of one entity: what verification captured from running software.
 * It is not a planning design. `current` is the branch tip alone; `commit` compares the named
 * commit with its exact first parent, also when that commit is the tip.
 */
export interface EntityEvidenceQuery extends EntityQuery {
	branch: string;
	mode: 'current' | 'commit';
}

/**
 * `identity` says what the answer was read at: the source commit and tree, and the pinned notes
 * and evidence revisions. Either revision is null where the repository has no such ref, and the
 * evidence then says so in its gaps.
 */
export interface EntityEvidenceResult {
	scope: ExplorerScope;
	identity: CacheIdentity;
	evidence: ExplorerEvidence;
	behavior: ExplorerBehavior;
}

/**
 * One capture named by its binding: the record, scenario, state, evidence and viewport of one
 * side of an evidence answer, with the hash that answer gave and the revisions it was pinned
 * to. There is no path and no address: the backend finds the bytes and checks all of it.
 */
export interface EvidenceArtifactQuery extends EntityEvidenceQuery {
	side: 'before' | 'after';
	recordId: string;
	scenarioId: string;
	state: string;
	evidenceId: string;
	viewport: string | null;
	sha256: string;
	notesRevision: string | null;
	evidenceRevision: string | null;
}

export interface EvidenceArtifactResult {
	bytes: Uint8Array;
	mediaType: string;
	sha256: string;
}
