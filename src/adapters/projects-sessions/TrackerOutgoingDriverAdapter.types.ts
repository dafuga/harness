// @harness-uid u_6x5aw74rep
import type { TrackerOutgoingChannel } from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

export interface TrackerOutgoingDriverAdapterConfig {
	channel: Exclude<TrackerOutgoingChannel, 'gmail' | 'slack'>;
	account: string;
	destinations: readonly string[];
	executable: string;
	receiptOrigins: readonly string[];
}
