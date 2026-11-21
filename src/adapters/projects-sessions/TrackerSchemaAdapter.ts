// @harness-uid u_tzqekyfiyf
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerDatabaseIdentity,
	TrackerSchemaAdapterConfig
} from './TrackerSchemaAdapter.types';

export class TrackerSchemaAdapter {
	constructor(_database: SqliteDatabase, _config: TrackerSchemaAdapterConfig = {}) {}

	initialize(): TrackerDatabaseIdentity {
		return { createdAt: 0, dbId: '' };
	}
}

export type {
	TrackerDatabaseIdentity,
	TrackerSchemaAdapterConfig
} from './TrackerSchemaAdapter.types';
