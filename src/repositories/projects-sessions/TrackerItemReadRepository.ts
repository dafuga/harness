// @harness-uid u_xba7ieg4je
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerDigest,
	TrackerItem,
	TrackerItemListFilters
} from './TrackerItemReadRepository.types';

export class TrackerItemReadRepository {
	constructor(_database: SqliteDatabase) {}

	get(_idOrPrefix: string): TrackerItem {
		throw new Error('Tracker item lookup is not implemented');
	}

	list(_filters: TrackerItemListFilters = {}): TrackerItem[] {
		return [];
	}

	digest(_nowMs: number, _timeZone?: string): TrackerDigest {
		throw new Error('Tracker digest is not implemented');
	}

	digestText(_nowMs: number, _timeZone?: string): string {
		return '';
	}
}

export type { TrackerDigest, TrackerItem, TrackerItemListFilters };
