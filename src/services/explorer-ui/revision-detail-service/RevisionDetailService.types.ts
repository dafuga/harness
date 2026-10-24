import type { TranslationCatalog } from '../../../core/explorer-ui/Translation.types';
import type { PlatformCatalog } from '../../../core/explorer-ui/Platform.types';
import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import type { VerificationRecord } from '../../../core/verificationTypes';
import type * as sourceImpact from './source-impact-service/SourceImpactService';
import type { RecordView } from '../../../utils/recordView';
import type { Explanation } from '../../../core/explanationTypes';
import type { RegressionView } from '../../../core/regressionTypes';
import type { BudgetEvent } from '../../../core/budgetTypes';
import type { StoredSide } from '../../../utils/sideImpact';
import type { CommitStatus } from '../../history-status-service/HistoryStatusService';

export interface RevisionDetail {
	schemaVersion: 1;
	commit: string;
	platforms?: PlatformCatalog;
	translations?: TranslationCatalog;
	registry: RevisionRegistry;
	/** What the latest usable record compared this revision with, as that record stated it. */
	comparison: {
		base: string | null;
		record: string;
		units: VerificationRecord['impact']['units'];
		changed: VerificationRecord['impact']['changed'];
		/** Scenarios this record tested afresh because the change reached them. */
		scenarios: string[];
		/** References the impact analysis could not resolve, which widened what was rerun. */
		uncertain: VerificationRecord['impact']['uncertain'];
	} | null;
	/** Source changes against the first parent; null for unreadable trees. Needs no verification. */
	sourceImpact: sourceImpact.SourceImpact | null;
	/** Stored source-tree side, relative to the index; null when its tree cannot be read. */
	side: string | null;
	records: RecordView[];
	/** The reasons for what this commit itself changed against its first parent. */
	explanations: Explanation[];
	/**
	 * How many more reasons its notes and records hold that are not this commit's: a record may
	 * verify a longer range. They stay where they were written and are dated to no commit here.
	 */
	rangeReasons: number;
	/** Separate failing-test and fix commits, without granting a verification verdict. */
	regressions?: RegressionView[];
}

export interface Stored {
	platforms: PlatformCatalog;
	translations: TranslationCatalog;
	registry: RevisionRegistry;
	ledger: BudgetEvent[];
}

export interface BuiltRevision {
	detail: RevisionDetail;
	/** The stored side to write at `detail.side`; revisions with one tree share one. */
	side?: StoredSide;
	status: CommitStatus;
	/** Attached records of this commit that are intact, whatever their outcome. */
	sound: VerificationRecord[];
	/** The budget ledger as this revision stores it. */
	ledger: BudgetEvent[];
}
