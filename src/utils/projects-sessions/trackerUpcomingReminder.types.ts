// @harness-uid u_brjohnzsom
export interface TrackerReminderSource {
	title?: string | null;
	agent?: string | null;
	owner?: string | null;
	kind?: string | null;
	status?: string | null;
	/** A launch has been requested, so an agent works this item. */
	autoLaunch?: boolean;
	remindAt?: string | null;
	due?: string | null;
	every?: string | null;
}

export interface TrackerReminderTime {
	/** The listed time, as an ISO timestamp. Done and snooze name it. */
	at: string;
	/** "Daily", "Weekly" and so on; null for a reminder that happens once. */
	repeats: string | null;
	group: 'work' | 'personal';
	/** The deadline, when the item has one. */
	due?: string;
	/** The deadline names a day without a clock time. */
	allDay?: true;
}
