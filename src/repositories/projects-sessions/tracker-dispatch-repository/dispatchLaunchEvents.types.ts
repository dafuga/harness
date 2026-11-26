// @harness-uid u_ksy76trvsj
export interface TrackerLaunchEvent {
	kind: 'launched' | 'done' | 'blocked' | 'failed' | 'escalated' | 'gave_up' | 'launch_failed';
	itemId: string;
	runId: number;
	text: string;
}

export type EventDetail = [TrackerLaunchEvent['kind'], string];

export interface TrackerLaunchEventRow {
	id: number;
	at: number;
	kind: TrackerLaunchEvent['kind'];
	item_id: string;
	run_id: number;
	text: string;
}
