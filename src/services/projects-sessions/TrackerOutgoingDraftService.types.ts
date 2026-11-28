// @harness-uid u_4usb4rrlje
import type {
	TrackerOutgoingMessage,
	TrackerOutgoingResult
} from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

/** Created at a trusted transport boundary, never read from an incoming JSON body. */
export interface TrackerOutgoingActor {
	kind: 'agent' | 'owner';
	by: string;
}

export type TrackerOutgoingSender = (
	message: TrackerOutgoingMessage,
	attempt: string
) => Promise<TrackerOutgoingResult>;

export interface TrackerOutgoingDraftServiceOptions {
	now?: () => number;
	provider?: (message: TrackerOutgoingMessage) => TrackerOutgoingSender | undefined;
}
