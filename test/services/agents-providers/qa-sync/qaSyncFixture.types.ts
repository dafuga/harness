import type {
	QaSlackMessage,
	QaSyncState,
	QaTrackerItem
} from '../../../../src/core/agents-providers/qaSync.types';

export interface QaSyncWorld {
	parents: QaSlackMessage[];
	replies: QaSlackMessage[];
	labels: Map<number, string[]>;
	items: QaTrackerItem[];
	notes: { id: string; text: string }[];
	failNotes: boolean;
	/** Seconds since the epoch. */
	clock: number;
	state: QaSyncState | undefined;
}
