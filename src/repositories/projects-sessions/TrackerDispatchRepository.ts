// @harness-uid u_ksy76trvsj
import type { RepositoryRecord } from './TrackerDispatchRepository.types';

export class TrackerDispatchRepository<T extends RepositoryRecord> {
	private readonly records = new Map<number, T>();

	find(id: number): T | undefined {
		return this.records.get(id);
	}

	save(record: T): T {
		this.records.set(record.id, record);
		return record;
	}
}

export type { RepositoryRecord } from './TrackerDispatchRepository.types';
