// @harness-uid u_sbz3zzk4fx
import type { CheckObservation } from './sharedCheck.types';

export interface GitHubJob {
	name: string;
	conclusion: string;
	steps: Array<{ name: string; conclusion: string }>;
}

export interface GitHubRun {
	id: number;
	head_sha: string;
	head_repository: { full_name: string };
}

export interface GitHubReceipt {
	status: 'passed';
	commit: string;
	tree: string;
	checks: CheckObservation[];
}

export interface GitHubCheckProof {
	url: string;
	keys: Set<string>;
}
