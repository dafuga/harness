// @harness-uid u_mzypaxxnyu
/** The verification that let a review accept a submission, kept with the verdict. */
export interface TaskAcceptanceEvidence {
	commit: string;
	record: string;
	scope: 'full' | 'entity';
	checks: number;
}

/** How one record relates to the task's module: the scope it proves, or why it proves nothing. */
export type EvidenceScope =
	| { scope: TaskAcceptanceEvidence['scope']; problem?: never }
	| { scope?: never; problem: string };
