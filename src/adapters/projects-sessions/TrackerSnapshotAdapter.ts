// @harness-uid u_earfvkmyr2
import type { TrackerSnapshotAdapterConfig } from './TrackerSnapshotAdapter.types';

export class TrackerSnapshotAdapter {
	constructor(private readonly config: TrackerSnapshotAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'tracker-snapshot';
	}
}

export type { TrackerSnapshotAdapterConfig } from './TrackerSnapshotAdapter.types';
