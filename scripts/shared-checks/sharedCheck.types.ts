// @harness-uid u_sbz3zzk4fx
import type { SharedCheckCache } from './checkCache';
import type { CheckQueue } from './checkQueue';

export type CheckPriority = 'urgent' | 'normal' | 'low';

export interface CheckRequest {
	id: string;
	repo: string;
	commit: string;
	base?: string;
	item?: string;
	release: boolean;
	exact?: boolean;
	priority: CheckPriority;
}

export interface CandidateTree {
	repo: string;
	base: string;
	commit: string;
	tree: string;
}

export interface SharedCheck {
	id: string;
	command: string[];
	cwd?: string;
	timeoutMs?: number;
	browser?: boolean;
}

export interface CheckPlan {
	mode: 'focused' | 'release' | 'unknown';
	checks: SharedCheck[];
	reason?: string;
	setup?: SharedCheck[];
}

export interface CheckObservation {
	id: string;
	key?: string;
	source: 'executed' | 'local-cache' | 'shared-cache' | 'github-ci';
	ms?: number;
	log?: string;
}

export interface CheckResult {
	status: 'passed' | 'failed' | 'blocked';
	mode?: CheckPlan['mode'];
	base?: string;
	testedCommit?: string;
	workerRssBytes?: number;
	tree?: string;
	batch: string[];
	checks: CheckObservation[];
	elapsedMs: number;
	detail?: string;
}

export interface CheckWorkerDependencies {
	run: (tree: CandidateTree, release: boolean) => Promise<Omit<CheckResult, 'batch'>>;
	note: (item: string, text: string) => Promise<void>;
	signal: AbortSignal;
}

export interface CheckLeaseTarget {
	repo: string;
	remote: string;
	ref: string;
	owner: string;
}

export interface CheckCliDependencies {
	home: string;
	note: CheckWorkerDependencies['note'];
}

export interface CandidateRun {
	queue: CheckQueue;
	candidate: CandidateTree;
	plan: CheckPlan;
	cache: SharedCheckCache;
}
