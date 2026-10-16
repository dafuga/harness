/** What the facade reads back: revisions, snapshots, history, images and failures. */

import type { CommitId, IsoTime, PlanDetail, PlanViewport, Sha256 } from './Planning.types';

export type PlanningErrorCode =
	| 'invalid-input'
	| 'invalid-image'
	| 'invalid-region'
	| 'not-a-repository'
	| 'repository-busy'
	| 'unknown-revision'
	| 'not-found'
	| 'already-exists'
	| 'unsafe-path'
	| 'artifact-missing'
	| 'artifact-corrupt'
	| 'artifact-tampered'
	| 'artifact-dirty'
	| 'stale-version'
	| 'approval-required'
	| 'approval-mismatch'
	| 'conflict'
	| 'git-failed';

/** A failure as plain data. `path` is relative to the repository root when one is involved. */
export interface PlanningFailure {
	code: PlanningErrorCode;
	message: string;
	path: string | null;
}

export interface RevisionInfo {
	/** What the caller asked for; `null` means the checked-out commit. */
	requested: string | null;
	commit: CommitId;
	/** The checked-out branch when `commit` is its tip, otherwise `null`. */
	branch: string | null;
	/** Whether `commit` is the checked-out commit. Only then can it be written to. */
	head: boolean;
	committedAt: IsoTime;
	subject: string;
}

export interface BranchInfo {
	name: string;
	tip: CommitId;
	current: boolean;
	committedAt: IsoTime;
	subject: string;
}

export interface CommitInfo {
	commit: CommitId;
	parents: CommitId[];
	author: string;
	committedAt: IsoTime;
	subject: string;
}

/** A plan folder that was refused, with the reason. It is never shown as a plan. */
export interface RejectedPlan {
	path: string;
	unitId: string | null;
	code: PlanningErrorCode;
	message: string;
}

export interface ProjectSnapshot {
	revision: RevisionInfo;
	plans: PlanDetail[];
	rejected: RejectedPlan[];
}

export type HistoryEvent =
	| { kind: 'plan-created' }
	| { kind: 'design-added'; version: string }
	| { kind: 'design-approved'; approvalId: string }
	| { kind: 'thread-opened'; threadId: string }
	| { kind: 'message-appended'; threadId: string }
	| { kind: 'other'; path: string };

export interface HistoryEntry extends CommitInfo {
	/** What the commit did to this entity; paths of other entities never appear. */
	events: HistoryEvent[];
}

export interface EntityHistory {
	unitId: string;
	revision: RevisionInfo;
	/** Newest first. Only commits that touched this entity's folder. */
	entries: HistoryEntry[];
}

/** One immutable image, read from the commit and checked against its recorded hash. */
export interface ImageContent {
	unitId: string;
	version: string;
	file: string;
	state: string;
	viewport: PlanViewport;
	sha256: Sha256;
	width: number;
	height: number;
	mediaType: 'image/png';
	bytes: Uint8Array;
	/** The option holding the image, when its version has options. */
	option?: string;
	/** The commit that added the version. */
	commit: CommitId;
}

/** A mutation and the single commit that holds it. */
export interface Committed<T> {
	value: T;
	commit: CommitId;
	parent: CommitId;
	branch: string;
	/** Exactly the paths the commit changed. */
	paths: string[];
}
