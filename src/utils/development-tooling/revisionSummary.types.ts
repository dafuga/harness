import type { IndexedRevision } from '../../core/git-source-history/historyIndexTypes';
import type { RecordView } from './recordView';

/** What the records attached to one commit come to: its coverage, its gaps and each record. */
export type RevisionRecords = Pick<IndexedRevision, 'coverage' | 'gaps' | 'records'>;

export type Viewed = Pick<RecordView, 'id' | 'profile' | 'finishedAt' | 'source'>;
