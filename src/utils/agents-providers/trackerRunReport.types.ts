// @harness-uid u_lst54o5ptr
export type TrackerRunOutcome =
	| 'done'
	| 'failed'
	| 'rejected'
	| 'blocked'
	| 'timed_out'
	| 'abandoned';

export interface TrackerRunRow {
	node: string;
	id: number;
	item_id: string;
	state: 'queued' | 'running' | 'verifying' | 'observed' | 'finished';
	cli: string;
	model: string;
	rung: string;
	kind?: string | null;
	project?: string | null;
	outcome?: TrackerRunOutcome | null;
	auto_token?: string | null;
	attempt?: number | null;
	effort?: string | null;
	pinned?: boolean | number | null;
	started_at?: number | null;
	ended_at?: number | null;
	escalated_from?: number | null;
	redone_by?: string | null;
	idle_nudges?: number | null;
	input_tokens?: number | null;
	output_tokens?: number | null;
	cache_read_tokens?: number | null;
	cache_write_tokens?: number | null;
	cost_usd?: number | null;
}

export interface TrackerHistoryScope {
	kind?: string | null;
	project?: string | null;
}
