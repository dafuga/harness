// @harness-uid u_o6i4mwa3wf
export interface GithubIssueIntakeSource {
	target: string;
	kind: string;
	auto_launch?: string;
	enabled_at: number;
	include_labels: string[];
	exclude_labels: string[];
}

export interface GithubIssueIntakeIssue {
	id: number;
	number: number;
	title: string;
	state: string;
	created_at: string;
	updated_at: string;
	labels: { name: string }[];
	pull_request?: unknown;
}

export interface GithubIssueIntakeEvent {
	id?: number | string;
	event?: string;
	created_at: string;
	label?: { name?: string };
}

export interface GithubIssueIntakeOptions {
	backfill?: boolean;
	mapped?: boolean;
}

export interface GithubIssueIntakeScope {
	historical: boolean;
	needsTimeline: boolean;
}

export interface GithubIssueStateEvent {
	id: string;
	time: number;
	state: 'open' | 'closed';
}

export interface GithubIssueIntakeRecord {
	externalId: string;
	key: string;
	title: string;
	url: string;
	state: string;
	historical: boolean;
	autoLaunch: boolean;
	syncBack: boolean;
	events: GithubIssueStateEvent[];
	snapshotAt: number;
}
