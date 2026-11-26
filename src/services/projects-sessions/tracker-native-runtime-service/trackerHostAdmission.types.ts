// @harness-uid u_bl6xl2h4a3
export interface TrackerOccupiedRun {
	id: number;
	itemId: string;
	state: 'queued' | 'running' | 'verifying';
	cli: string | null;
	tmux: string | null;
	watchPane: string | null;
	startedAt: number | null;
	resumedAt: number | null;
	status: string | null;
	deleted: number | null;
	waiting: number | null;
}
