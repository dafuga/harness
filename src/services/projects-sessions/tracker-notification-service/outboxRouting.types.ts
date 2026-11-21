// @harness-uid u_vqnqshfas2
import type { TrackerDestination } from '../TrackerNotificationService.types';
import type { OutboxRow } from './notificationState.types';

export interface OutboxRecipient {
	destination: TrackerDestination;
	route: string | null;
}

export interface OutboxGroup extends OutboxRecipient {
	rows: OutboxRow[];
}
