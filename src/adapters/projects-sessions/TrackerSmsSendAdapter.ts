// @harness-uid u_bng5whqki7
import type { TrackerSmsSendAdapterConfig } from './TrackerSmsSendAdapter.types';

export class TrackerSmsSendAdapter {
	constructor(private readonly config: TrackerSmsSendAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'tracker-sms-send';
	}
}

export type { TrackerSmsSendAdapterConfig } from './TrackerSmsSendAdapter.types';
