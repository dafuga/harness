// @harness-uid u_lahmutfc24
import type { TrackerRunRow } from '../../utils/agents-providers/trackerRunReport.types';

export interface TrackerRunFilters {
	itemId?: string;
	limit?: string | number;
}

export interface TrackerListedRun extends TrackerRunRow {
	queued_at: number | null;
	tmux?: string | null;
}

export type TrackerRunTable = 'runs' | 'remote_runs';
