import type { HarnessRevisionSummary } from '../../../../../reports/src/models/Harness.types';
import type { HarnessRevision } from '../../../../../reports/src/models/Harness.types';
import type { RevisionRecords } from '../../../../../../src/utils/development-tooling/revisionSummary';
import type { HistoryStatusService } from '../../../../../../src/services/history-status-service/HistoryStatusService';

export type CommitFacts = Pick<
	HarnessRevisionSummary,
	'commit' | 'parents' | 'subject' | 'author' | 'committedAt'
>;

/** Everything stored for one commit, read at one pair of pinned revisions. */
export interface PinnedRevision {
	/** The commit as Git states it. */
	facts: CommitFacts;
	/** The stored revision, as the reports explorer reads it; no capture was written anywhere. */
	detail: HarnessRevision;
	/** What the records attached to the commit come to. */
	judged: RevisionRecords;
	/** The legacy reports its note names. */
	legacy: string[];
}

export type Known<Value> = Map<string, Value>;

export interface Pinned {
	history: HistoryStatusService;
	built: Known<Promise<PinnedRevision>>;
}
