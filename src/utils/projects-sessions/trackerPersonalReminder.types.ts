// @harness-uid u_2lqdb7qyy3
export interface TrackerReminderSource {
	agent?: string | null;
	status?: string | null;
	remindAt?: string | null;
	every?: string | null;
}

export interface TrackerReminderTime {
	/** The armed time, as an ISO timestamp. */
	at: string;
	/** "Daily", "Weekly" and so on; null for a reminder that happens once. */
	repeats: string | null;
}
