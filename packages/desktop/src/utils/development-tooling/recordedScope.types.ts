import type { HarnessRevisionSummary } from '../../../../reports/src/models/Harness.types';
import type { EntityEvidenceQuery } from '../../models/verification-evidence/DesktopEvidence.types';

/** What a backend knows of the commit an evidence read names, before any evidence is read. */
export interface ScopeFacts {
	/** The tip of the selected branch, which holds the commit. */
	tip: string;
	/** The kind of the unit registered under the entity at the commit; undefined when none is. */
	kind: string | undefined;
	/** The commit as Git states it. */
	revision: Pick<
		HarnessRevisionSummary,
		'commit' | 'parents' | 'subject' | 'author' | 'committedAt'
	>;
	/** What the records attached to this commit come to. */
	judged: Pick<HarnessRevisionSummary, 'coverage' | 'gaps' | 'records'>;
	/** The legacy reports noted on this commit. */
	legacy: string[];
}

export type Asked = Pick<EntityEvidenceQuery, 'entityId' | 'commit' | 'branch' | 'mode'>;
