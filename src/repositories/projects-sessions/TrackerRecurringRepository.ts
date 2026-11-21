// @harness-uid u_7ryrqak22k
import type { RepositoryRecord } from './TrackerRecurringRepository.types';

export class TrackerRecurringRepository<T extends RepositoryRecord> {
	private readonly records = new Map<number, T>();

	find(id: number): T | undefined {
		return this.records.get(id);
	}

	save(record: T): T {
		this.records.set(record.id, record);
		return record;
	}
}

export type { RepositoryRecord } from './TrackerRecurringRepository.types';
