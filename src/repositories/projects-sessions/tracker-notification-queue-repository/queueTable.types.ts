// @harness-uid u_e7x5dhawh4
import type { SqliteValue } from '../../../core/development-tooling/sqliteTypes';

export interface QueueTable<Row, Stored> {
	name: string;
	key?: string;
	columns: readonly string[];
	read(row: Stored): Row;
	values(row: Row): SqliteValue[];
}
