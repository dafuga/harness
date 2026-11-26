// @harness-uid u_hs46i3q25s
import type { VerificationNote } from '../../../core/git-source-history/historyTypes.types';

import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
export interface RecordDependency {
	record: VerificationRecord;
	problems: string[];
	clipProblems: string[];
	full: boolean;
}

export interface RecordStatus {
	record: string;
	status: 'passed' | 'failed';
	/** True when the record, its files and everything it inherits are intact. */
	valid: boolean;
	problems: string[];
	evidence: VerificationNote['evidence'];
}

export interface CommitStatus {
	commit: string;
	/** True when a passing record with intact files and lineage is attached to this commit. */
	verified: boolean;
	records: RecordStatus[];
	problems: string[];
}

/** The notes commit and the evidence commit a history is read at; null where there is none. */
export interface PinnedHistory {
	notes: string | null;
	evidence: string | null;
}
