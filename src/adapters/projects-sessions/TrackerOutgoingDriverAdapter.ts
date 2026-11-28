// @harness-uid u_6x5aw74rep
import type { TrackerOutgoingDriverAdapterConfig } from './TrackerOutgoingDriverAdapter.types';

export class TrackerOutgoingDriverAdapter {
	constructor(private readonly config: TrackerOutgoingDriverAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'tracker-outgoing-driver';
	}
}

export type { TrackerOutgoingDriverAdapterConfig } from './TrackerOutgoingDriverAdapter.types';
