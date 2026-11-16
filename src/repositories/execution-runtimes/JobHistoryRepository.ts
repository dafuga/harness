// @harness-uid u_tjf4wq5l2c
import type { RepositoryRecord } from './JobHistoryRepository.types';

export class JobHistoryRepository<T extends RepositoryRecord> {
	private readonly records = new Map<number, T>();

	find(id: number): T | undefined {
		return this.records.get(id);
	}

	save(record: T): T {
		this.records.set(record.id, record);
		return record;
	}
}

export type { RepositoryRecord } from './JobHistoryRepository.types';
