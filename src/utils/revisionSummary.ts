import type { IndexedRevision } from '../core/historyIndexTypes';
import type { CommitStatus } from '../services/HistoryStatusService';
import type { RecordView } from './recordView';

/** What the records attached to one commit come to: its coverage, its gaps and each record. */
export type RevisionRecords = Pick<IndexedRevision, 'coverage' | 'gaps' | 'records'>;
type Viewed = Pick<RecordView, 'id' | 'profile' | 'finishedAt' | 'source'>;

const unverified = 'no verification record is attached to this commit';
const short = (id: string): string => id.slice(0, 12);

/** Verified needs a usable passing record; records that cannot be used prove nothing. */
function coverageOf(attached: number, usable: string[]): IndexedRevision['coverage'] {
	if (attached === 0) return 'unverified';
	if (usable.includes('passed')) return 'verified';
	return usable.length > 0 ? 'failed' : 'invalid';
}

/**
 * The records of one commit as a history lists them, from what Git proves about each and what
 * the record itself states. A record that could not be read states nothing, so its profile and
 * its date are unknown; every problem of an unusable record is a gap named by that record.
 */
export function revisionSummary(
	status: Pick<CommitStatus, 'records'>,
	views: Viewed[]
): RevisionRecords {
	const records = status.records.map((item) => {
		const view = views.find((record) => record.id === item.record);
		return {
			id: item.record,
			status: item.status,
			profile: view?.profile ?? 'unknown',
			finishedAt: view?.finishedAt ?? 'unknown',
			base: view?.source.base ?? null,
			valid: item.valid,
			problems: item.problems
		};
	});
	const usable = records.filter((record) => record.valid).map((record) => record.status);
	const invalid = records
		.filter((record) => !record.valid)
		.flatMap((record) =>
			record.problems.map((problem) => `record ${short(record.id)}: ${problem}`)
		);
	return {
		coverage: coverageOf(records.length, usable),
		gaps: records.length === 0 ? [unverified] : invalid,
		records
	};
}
