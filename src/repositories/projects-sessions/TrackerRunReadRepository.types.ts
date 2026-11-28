// @harness-uid u_lahmutfc24
import type { TrackerRunRow } from '../../utils/agents-providers/trackerRunReport.types';

export interface TrackerRunFilters {
	itemId?: string;
	limit?: string | number;
	includeActive?: boolean;
}

export interface TrackerListedRun extends TrackerRunRow {
	queued_at: number | null;
	failure_reason?: string | null;
	tmux?: string | null;
	source_repo?: string | null;
}

export type TrackerRunTable = 'runs' | 'remote_runs';
