import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import type { RecordView } from '../../../utils/development-tooling/recordView';
import type { FocusedRun } from './historySeries.types';
import type { UnitVersions } from '../../../utils/development-tooling/revisionChanges';
import type { HistoryIndex } from '../../../core/git-source-history/historyIndexTypes';
import type { LegacyEntry } from '../../../core/git-source-history/historyIndexTypes';
import type { HistoryMediaService } from './history-media-service/HistoryMediaService';
import type { SourceRevision } from '../../../repositories/git-source-history/source-history-repository/SourceHistoryRepository';
import type { BuiltRevision } from '../../../services/explorer-ui/revision-detail-service/RevisionDetailService';

export interface BuiltHistory {
	out: string;
	/** sha256 of `index.json`. */
	digest: string;
	media: { resolved: number; missing: number };
	problems: string[];
	index: HistoryIndex;
	/** Rebuildable local SQLite query index; portable consoles may keep using JSON. */
	catalog: string;
}

export type LegacyReader = (media: HistoryMediaService) => Promise<LegacyEntry[]>;

export type Built = Array<{ revision: SourceRevision; result: CompactRevision }>;

export type CompactRevision = Omit<BuiltRevision, 'detail' | 'side' | 'sound'> & {
	sound: Array<Pick<VerificationRecord, 'id' | 'profile' | 'measurements'>>;
	detail: Pick<BuiltRevision['detail'], 'commit' | 'sourceImpact' | 'explanations'> & {
		records: Array<Pick<RecordView, 'id' | 'profile' | 'finishedAt' | 'source'>>;
		regressions?: FocusedRun[];
		registry: UnitVersions;
	};
};
