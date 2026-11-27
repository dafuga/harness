// @harness-uid u_kg5hqw3mno
import type { UntrustedValue } from './projectAssistant.types';

/** One decoded GitHub REST object. */
export type QaGitHubRow = Record<string, UntrustedValue>;

export type QaThreadOutcome =
	| { status: 'posted'; channelId: string; parentTs: string; linkBackFailed?: true }
	| { status: 'skipped'; reason: string }
	| { status: 'unknown'; reason: 'post-failed-after-reservation' };
export interface QaLabelEvent {
	/** GitHub label event id; the ledger key. */
	eventId: string;
	issue: number;
	deployedRevision?: string;
}

export interface QaTask {
	issue: number;
	title: string;
	issueUrl: string;
	fixPr: number;
	fixPrUrl: string;
	mergeSha: string;
	/** A maintainer's retest instructions, or the issue's reproduction steps. */
	instructions: string;
	instructionsSource: 'retest-comment' | 'issue-steps';
}

export type QaEligibility =
	| { eligible: true; task: QaTask }
	| {
			eligible: false;
			reason:
				| 'issue-closed'
				| 'label-missing'
				| 'no-merged-fix'
				| 'fix-not-on-staging'
				| 'no-instructions';
	  };

export interface QaRunbookStep {
	action: string;
	expected: string;
}

export interface QaThreadPorts {
	stillLive?(event: QaLabelEvent): Promise<boolean>;
	writeSteps(task: QaTask): Promise<readonly QaRunbookStep[]>;
	/** Records a short walkthrough on the target environment and returns the local MP4 path. */
	record(task: QaTask, steps: readonly QaRunbookStep[], deployedRevision?: string): Promise<string>;
	post(thread: QaThreadPost): Promise<{ channelId: string; parentTs: string }>;
	linkBack(task: QaTask, permalink: string): Promise<void>;
}

export interface QaThreadPost {
	parent: string;
	steps: string;
	videoPath: string;
}
