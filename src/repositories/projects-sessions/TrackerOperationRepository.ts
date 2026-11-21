// @harness-uid u_c5mwmd6z6z
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerAppliedOperations,
	TrackerOperation
} from './TrackerOperationRepository.types';

export class TrackerOperationRepository {
	constructor(_database: SqliteDatabase, _now = Date.now) {}

	applyOps(
		_operations: readonly TrackerOperation[],
		_persist?: () => void
	): TrackerAppliedOperations {
		return { operations: [], itemIds: [] };
	}
}

export type {
	TrackerAppliedOperations,
	TrackerOperation
} from './TrackerOperationRepository.types';
