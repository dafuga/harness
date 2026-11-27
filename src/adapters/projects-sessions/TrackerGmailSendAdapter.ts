// @harness-uid u_nchu7tvx63
import type { TrackerGmailSendAdapterConfig } from './TrackerGmailSendAdapter.types';

export class TrackerGmailSendAdapter {
	constructor(private readonly config: TrackerGmailSendAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'tracker-gmail-send';
	}
}

export type { TrackerGmailSendAdapterConfig } from './TrackerGmailSendAdapter.types';
