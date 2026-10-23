import type { VerificationRecord } from '../../../../src/core/verificationTypes';
import type { HistoryNote } from '../../../../src/core/historyTypes';

export type Files = Map<string, Uint8Array>;

export type Scenario = VerificationRecord['scenarios'][number];

export type Test = VerificationRecord['tests'][number];

export interface Drafted {
	source: { commit: string; tree: string };
	base: { commit: string; record: string } | null;
	finishedAt: string;
	scenarios: Scenario[];
	tests: Test[];
	/** The units the change reaches, as the record states its impact. */
	direct: string[];
}

export interface Stored {
	record: VerificationRecord;
	/** The original bytes of every capture and log, by the path the record names. */
	files: Files;
	/** The directory as the evidence branch holds it: media as LFS pointers. */
	tree: Files;
	/** The original bytes of what goes through LFS, by hash. */
	lfs: Files;
	manifest: string;
}

export type VerificationLine = Extract<HistoryNote, { kind: 'verification' }>;
