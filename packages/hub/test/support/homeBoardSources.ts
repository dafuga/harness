import type {
	TrackerItemRecord,
	TrackerRunRecord,
	TrackerSources
} from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';

export const boardNow = Date.parse('2026-11-28T19:00:00.000Z');

export function item(id: string, fields: Partial<TrackerItemRecord> = {}): TrackerItemRecord {
	return {
		id,
		title: `Sample task ${id}`,
		status: 'open',
		agent: 'harness',
		updated_at: new Date(boardNow - 3_600_000).toISOString(),
		...fields
	};
}

export function run(
	id: number,
	itemId: string,
	fields: Partial<TrackerRunRecord> = {}
): TrackerRunRecord {
	return {
		id,
		item_id: itemId,
		node: 'studio-mac',
		state: 'running',
		started_at: boardNow - 600_000,
		ended_at: null,
		model: 'claude-sonnet-5-5',
		effort: 'high',
		...fields
	};
}

export function boardSources(items: TrackerItemRecord[], runs: TrackerRunRecord[]): TrackerSources {
	return { items, runs, machines: [] };
}
