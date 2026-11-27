// @harness-uid u_eug7dfr5kp
import type { GithubIssueIntakeSource } from '../../helpers/planning-collaboration/planGithubIssueIntake.types';

export interface TrackerAdapterSource extends GithubIssueIntakeSource {
	id: string;
	type: 'github';
	agent: string;
	project: string;
	owner: string | null;
	model: string | null;
	computer: string;
	every?: string;
	every_tz?: string;
	cursor: number;
	paused: boolean;
}

export type TrackerAdapterSourceAction = 'pause' | 'resume' | 'remove';

export type TrackerAdapterRemoteState = 'open' | 'closed';

export interface TrackerAdapterLink {
	source_id: string;
	external_id: string;
	external_key: string;
	item_id: string;
	remote_state: TrackerAdapterRemoteState | null;
	events_after: number;
	owned: number;
	sync_pending: number;
}

export interface TrackerAdapterItem {
	id: string;
	status: string | null;
	deleted: number;
	launch_source: string | null;
}

export interface TrackerAdapterCandidate {
	id: string;
	kind: string | null;
	notes: string | null;
	adapter_instructions: string | null;
	title: string;
	agent: string | null;
	project: string | null;
}

export interface TrackerAdapterSourceRow {
	config: string;
	enabled_at: number;
	cursor: number;
	paused: number;
}

export interface TrackerAdapterListRow extends TrackerAdapterSourceRow {
	id: string;
	last_run: number | null;
	last_error: string | null;
}
