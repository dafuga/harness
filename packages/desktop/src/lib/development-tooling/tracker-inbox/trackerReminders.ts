// @harness-uid u_saspvpttcc
import type {
	ConfirmedWrite,
	InboxHeader
} from '../../../models/development-tooling/TrackerInbox.types';

export function reminderHeaders(headers: readonly InboxHeader[]): InboxHeader[] {
	return headers
		.filter((header) => header.reminder)
		.sort((a, b) => a.reminder!.at.localeCompare(b.reminder!.at) || a.id.localeCompare(b.id));
}

/** A Done or Snooze tap. A snooze carries the new time; both name the armed time shown. */
export function reminderWrite(header: InboxHeader, until?: string): ConfirmedWrite {
	return {
		action: until ? 'remind' : 'done',
		id: header.id,
		text: until ?? 'Done',
		revision: null,
		armed: header.reminder?.at
	};
}
