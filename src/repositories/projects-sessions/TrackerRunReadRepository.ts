// @harness-uid u_lahmutfc24
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { TrackerRunRow } from '../../utils/agents-providers/trackerRunReport.types';
import type { TrackerRunFilters } from './TrackerRunReadRepository.types';

export class TrackerRunReadRepository {
	constructor(_database: SqliteDatabase, _node: string) {}

	list(_filters: TrackerRunFilters = {}): TrackerRunRow[] {
		return [];
	}

	finished(): TrackerRunRow[] {
		return [];
	}
}
